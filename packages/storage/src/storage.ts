import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { and, desc, eq } from "drizzle-orm"
import { Context, Effect, Layer, Schema } from "effect"
import { isAbsolute } from "node:path"
import { Briefing, QueryReceipt, type CapturedQuery } from "./domain"
import {
  StorageConflict,
  StorageError,
  StorageValidationError,
  StoredRecordNotFound,
  type StorageFailure,
} from "./errors"
import { briefings, captures, checkpoints } from "./tables"

export class ReviewStorage extends Context.Service<
  ReviewStorage,
  {
    readonly capture: (
      input: CapturedQuery
    ) => Effect.Effect<CapturedQuery, StorageFailure>
    readonly getCapture: (
      id: string
    ) => Effect.Effect<CapturedQuery, StorageFailure>
    readonly listCaptures: (
      sessionId: string
    ) => Effect.Effect<ReadonlyArray<CapturedQuery>, StorageFailure>
    readonly saveBriefing: (
      input: Briefing
    ) => Effect.Effect<Briefing, StorageFailure>
    readonly getBriefing: (input: {
      unitId: string
      revisionId: string
    }) => Effect.Effect<Briefing, StorageFailure>
    readonly getBriefingById: (
      briefingId: string
    ) => Effect.Effect<Briefing | undefined, StorageFailure>
    readonly loadCheckpoint: () => Effect.Effect<
      string | undefined,
      StorageError
    >
    readonly saveCheckpoint: (
      payload: string
    ) => Effect.Effect<void, StorageError>
  }
>()("@neuve/ReviewStorage") {}

export const StorageLive = ({ path }: { path: string }) =>
  Layer.effect(
    ReviewStorage,
    Effect.gen(function* () {
      const sqlite = yield* Effect.acquireRelease(
        Effect.try({
          try: () => new Database(path, { create: true }),
          catch: () =>
            new StorageError({
              operation: "open",
              message: "Cannot open review database",
            }),
        }),
        (value) => Effect.sync(() => value.close())
      )
      yield* Effect.try({
        try: () => {
          sqlite.exec(
            "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;"
          )
        },
        catch: () =>
          new StorageError({
            operation: "configure",
            message: "Cannot configure review database",
          }),
      })
      const db = drizzle(sqlite)
      const attempt = <A>(operation: string, body: () => A) =>
        Effect.try({
          try: body,
          catch: (error) =>
            error instanceof StorageConflict ||
            error instanceof StorageValidationError ||
            error instanceof StoredRecordNotFound
              ? error
              : new StorageError({
                  operation,
                  message: "Review database operation failed",
                }),
        })
      const captureFromRow = (
        row: typeof captures.$inferSelect
      ): CapturedQuery => {
        const result = QueryReceipt.safeParse(row.result)
        if (!result.success)
          throw new StorageValidationError({
            message: "Stored query receipt is invalid",
          })
        return {
          captureId: row.captureId,
          sessionId: row.sessionId,
          toolCallId: row.toolCallId,
          result: result.data,
        }
      }
      const getCapture = (id: string) =>
        attempt("get-capture", () => {
          const row = db
            .select()
            .from(captures)
            .where(eq(captures.captureId, id))
            .get()
          if (!row) throw new StoredRecordNotFound({ id })
          return captureFromRow(row)
        })
      return ReviewStorage.of({
        capture: (input) =>
          attempt("capture", () => {
            const decoded = QueryReceipt.safeParse(input.result)
            if (
              !input.captureId.trim() ||
              !input.sessionId.trim() ||
              !input.toolCallId.trim() ||
              !decoded.success ||
              !isAbsolute(decoded.data.source.repository)
            )
              throw new StorageValidationError({
                message:
                  "Capture requires identities and a normalized pinned query receipt",
              })
            const value: CapturedQuery = { ...input, result: decoded.data }
            return db.transaction(() => {
              const old = db
                .select()
                .from(captures)
                .where(eq(captures.captureId, value.captureId))
                .get()
              if (old) {
                if (
                  JSON.stringify(captureFromRow(old)) !== JSON.stringify(value)
                )
                  throw new StorageConflict({ id: value.captureId })
                return captureFromRow(old)
              }
              db.insert(captures)
                .values({
                  captureId: value.captureId,
                  sessionId: value.sessionId,
                  toolCallId: value.toolCallId,
                  repository: value.result.source.repository,
                  revision: value.result.source.revision,
                  result: value.result,
                  createdAt: Date.now(),
                })
                .run()
              return value
            })
          }),
        getCapture,
        listCaptures: (sessionId) =>
          attempt("list-captures", () =>
            db
              .select()
              .from(captures)
              .where(eq(captures.sessionId, sessionId))
              .orderBy(desc(captures.createdAt))
              .all()
              .map(captureFromRow)
          ),
        saveBriefing: (input) =>
          Effect.gen(function* () {
            const value = yield* Schema.decodeUnknownEffect(Briefing)(
              input
            ).pipe(
              Effect.mapError(
                () =>
                  new StorageValidationError({
                    message: "Briefing does not match its schema",
                  })
              )
            )
            const capture = yield* getCapture(value.captureId)
            if (value.revisionId !== capture.result.source.revision)
              return yield* new StorageValidationError({
                message: "Briefing revision must match its captured evidence",
              })
            const evidence = capture.result.source_evidence ?? []
            const ids = new Set(
              value.citations.map((citation) => citation.citationId)
            )
            if (
              ids.size !== value.citations.length ||
              value.citations.some(
                (citation) =>
                  citation.endLine < citation.startLine ||
                  !evidence.some(
                    (source) =>
                      source.path === citation.path &&
                      source.start_line <= citation.startLine &&
                      source.end_line >= citation.endLine
                  )
              ) ||
              value.segments.some(
                (segment) =>
                  segment.kind === "cite" && !ids.has(segment.citationId)
              )
            )
              return yield* new StorageValidationError({
                message:
                  "Every citation must resolve within captured pinned source text",
              })
            return yield* attempt("save-briefing", () =>
              db.transaction(() => {
                const old = db
                  .select()
                  .from(briefings)
                  .where(eq(briefings.briefingId, value.briefingId))
                  .get()
                if (old) {
                  if (JSON.stringify(old.briefing) !== JSON.stringify(value))
                    throw new StorageConflict({ id: value.briefingId })
                  return old.briefing
                }
                db.insert(briefings)
                  .values({
                    briefingId: value.briefingId,
                    captureId: value.captureId,
                    unitId: value.unitId,
                    revision: value.revisionId,
                    briefing: value,
                    createdAt: Date.now(),
                  })
                  .run()
                return value
              })
            )
          }),
        getBriefing: (input) =>
          attempt("get-briefing", () => {
            const row = db
              .select()
              .from(briefings)
              .where(
                and(
                  eq(briefings.unitId, input.unitId),
                  eq(briefings.revision, input.revisionId)
                )
              )
              .orderBy(desc(briefings.createdAt))
              .get()
            if (!row) throw new StoredRecordNotFound({ id: input.unitId })
            return Schema.decodeUnknownSync(Briefing)(row.briefing)
          }),
        getBriefingById: (briefingId) =>
          attempt("get-briefing", () => {
            const row = db
              .select()
              .from(briefings)
              .where(eq(briefings.briefingId, briefingId))
              .get()
            return row
              ? Schema.decodeUnknownSync(Briefing)(row.briefing)
              : undefined
          }),
        loadCheckpoint: () =>
          Effect.try({
            try: () =>
              db
                .select()
                .from(checkpoints)
                .where(eq(checkpoints.key, "review"))
                .get()?.payload,
            catch: () =>
              new StorageError({
                operation: "load-checkpoint",
                message: "Cannot load review checkpoint",
              }),
          }),
        saveCheckpoint: (payload) =>
          Effect.try({
            try: () => {
              db.insert(checkpoints)
                .values({ key: "review", payload })
                .onConflictDoUpdate({
                  target: checkpoints.key,
                  set: { payload },
                })
                .run()
            },
            catch: () =>
              new StorageError({
                operation: "save-checkpoint",
                message: "Cannot save review checkpoint",
              }),
          }),
      })
    })
  )
