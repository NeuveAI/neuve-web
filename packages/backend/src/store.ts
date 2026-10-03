import {
  Context,
  Effect,
  Layer,
  PubSub,
  Schema,
  Semaphore,
  Stream,
} from "effect"
import { ReviewStorage, type StorageError } from "@workspace/storage"
import {
  CommentCommand,
  DispositionCommand,
  ReviewUnit,
  HarnessUpdate,
  RegisteredBatch,
  BriefingReference,
  CompleteUnitReview,
  FinishAutomatedReview,
  ReviewReadiness,
  type Comment,
  type Disposition,
  type Principal,
  ReviewEvent,
  type ReviewSnapshot,
} from "./domain"
import {
  AutomatedReviewPending,
  CommandConflict,
  HumanDecisionRequired,
  InvalidReviewInput,
  ReplayGap,
  StaleRevision,
  UnitNotFound,
  type ReviewError,
} from "./errors"

const Author = Schema.Struct({
  kind: Schema.Literals(["human", "agent"]),
  id: Schema.NonEmptyString,
})
const DispositionRecord = Schema.Struct({
  ...DispositionCommand.fields,
  author: Author,
})
const CommentRecord = Schema.Union([
  Schema.Struct({
    ...CommentCommand.fields,
    author: Author,
    dispatch: Schema.Literal("pending"),
  }),
  Schema.Struct({
    ...CommentCommand.fields,
    author: Author,
    dispatch: Schema.Literal("delivered"),
  }),
  Schema.Struct({
    ...CommentCommand.fields,
    author: Author,
    dispatch: Schema.Literal("failed"),
    dispatchDetail: Schema.NonEmptyString,
  }),
])
const Checkpoint = Schema.Struct({
  version: Schema.Literal(1),
  readiness: Schema.optionalKey(ReviewReadiness),
  completedUnitReviews: Schema.optionalKey(Schema.Array(CompleteUnitReview)),
  finishCommands: Schema.optionalKey(Schema.Array(FinishAutomatedReview)),
  archivedBatches: Schema.optionalKey(Schema.Array(RegisteredBatch)),
  archivedUnits: Schema.optionalKey(Schema.Array(ReviewUnit)),
  batch: Schema.NullOr(RegisteredBatch),
  units: Schema.Array(ReviewUnit),
  dispositions: Schema.Array(DispositionRecord),
  comments: Schema.Array(CommentRecord),
  briefings: Schema.Array(BriefingReference),
  harnessUpdates: Schema.Array(HarnessUpdate),
  sequence: Schema.Number,
  journal: Schema.Array(ReviewEvent),
  activeRevision: Schema.NullOr(Schema.String),
  previousRevisions: Schema.Array(Schema.String),
  commands: Schema.Array(
    Schema.Tuple([
      Schema.String,
      Schema.Union([
        Schema.Struct({
          fingerprint: Schema.String,
          kind: Schema.Literal("disposition"),
          value: DispositionRecord,
        }),
        Schema.Struct({
          fingerprint: Schema.String,
          kind: Schema.Literal("comment"),
          value: CommentRecord,
        }),
      ]),
    ])
  ),
})
const Batch = Schema.Struct({
  revisionId: Schema.NonEmptyString,
  units: Schema.Array(ReviewUnit),
})
type Batch = typeof Batch.Type
export class ReviewStore extends Context.Service<
  ReviewStore,
  {
    readonly completeUnitReview: (
      input: CompleteUnitReview
    ) => Effect.Effect<CompleteUnitReview, ReviewError>
    readonly finishAutomatedReview: (
      input: FinishAutomatedReview
    ) => Effect.Effect<ReviewReadiness, ReviewError>
    readonly registerBatch: (
      input: RegisteredBatch
    ) => Effect.Effect<void, InvalidReviewInput | StorageError>
    readonly publishUnits: (
      input: Batch
    ) => Effect.Effect<void, InvalidReviewInput | StorageError>
    readonly submitDisposition: (
      input: DispositionCommand,
      principal: Principal
    ) => Effect.Effect<Disposition, ReviewError>
    readonly addComment: (
      input: CommentCommand,
      principal: Principal
    ) => Effect.Effect<Comment, ReviewError>
    readonly recordDispatch: (input: {
      revisionId: string
      unitId: string
      commandId: string
      outcome: "delivered" | "failed"
      detail?: string
    }) => Effect.Effect<Comment, ReviewError>
    readonly recordBriefing: (
      input: BriefingReference
    ) => Effect.Effect<BriefingReference, ReviewError>
    readonly recordHarnessUpdate: (
      input: HarnessUpdate
    ) => Effect.Effect<HarnessUpdate, ReviewError>
    readonly snapshot: () => Effect.Effect<ReviewSnapshot>
    readonly subscribe: (
      afterSequence: number
    ) => Stream.Stream<ReviewEvent, ReplayGap>
  }
>()("@neuve/ReviewStore") {}

export const ReviewStoreLive = Layer.effect(
  ReviewStore,
  Effect.gen(function* () {
    const notifications = yield* PubSub.sliding<number>(1)
    yield* Effect.addFinalizer(() => PubSub.shutdown(notifications))
    const storage = yield* ReviewStorage
    const lock = yield* Semaphore.make(1)
    let readiness: ReviewReadiness = "processing"
    let completedUnitReviews: ReadonlyArray<CompleteUnitReview> = []
    let finishCommands: ReadonlyArray<FinishAutomatedReview> = []
    let archivedBatches: ReadonlyArray<RegisteredBatch> = []
    let archivedUnits: ReadonlyArray<ReviewUnit> = []
    let batch: RegisteredBatch | null = null
    let units: ReadonlyArray<ReviewUnit> = []
    let dispositions: ReadonlyArray<Disposition> = []
    let comments: ReadonlyArray<Comment> = []
    let briefings: ReadonlyArray<BriefingReference> = []
    let harnessUpdates: ReadonlyArray<HarnessUpdate> = []
    let sequence = 0
    let journal: ReadonlyArray<ReviewEvent> = []
    const commands = new Map<
      string,
      { fingerprint: string } & (
        | { kind: "disposition"; value: Disposition }
        | { kind: "comment"; value: Comment }
      )
    >()
    let activeRevision: string | undefined
    const previousRevisions = new Set<string>()
    const checkpoint = () => ({
      version: 1 as const,
      archivedBatches,
      archivedUnits,
      readiness,
      completedUnitReviews,
      finishCommands,
      batch,
      units,
      dispositions,
      comments,
      briefings,
      harnessUpdates,
      sequence,
      journal,
      commands: [...commands.entries()],
      activeRevision: activeRevision ?? null,
      previousRevisions: [...previousRevisions],
    })
    const restore = (state: typeof Checkpoint.Type) => {
      readiness = state.readiness ?? "processing"
      completedUnitReviews = state.completedUnitReviews ?? []
      finishCommands = state.finishCommands ?? []
      archivedBatches = state.archivedBatches ?? []
      archivedUnits = state.archivedUnits ?? []
      batch = state.batch
      if (
        readiness === "awaiting-human" &&
        batch?.hunks.some((hunk) => hunk.lane === "static-automation")
      )
        readiness = "processing"
      units = state.units
      dispositions = state.dispositions
      comments = state.comments
      briefings = state.briefings
      harnessUpdates = state.harnessUpdates
      sequence = state.sequence
      journal = state.journal.map((event) => Object.freeze(event))
      commands.clear()
      for (const [id, entry] of state.commands) commands.set(id, entry)
      activeRevision = state.activeRevision ?? undefined
      previousRevisions.clear()
      for (const revision of state.previousRevisions)
        previousRevisions.add(revision)
    }
    const saved = yield* storage.loadCheckpoint()
    if (saved !== undefined) {
      const state = yield* Effect.try({
        try: () => Schema.decodeUnknownSync(Checkpoint)(JSON.parse(saved)),
        catch: () =>
          new InvalidReviewInput({
            detail: "Persisted review checkpoint does not match its schema",
          }),
      })
      restore(state)
    }
    const transact = <A, E>(effect: Effect.Effect<A, E>) =>
      lock.withPermits(1)(
        Effect.uninterruptible(
          Effect.gen(function* () {
            const previous = checkpoint()
            return yield* effect.pipe(
              Effect.tap(() =>
                storage.saveCheckpoint(JSON.stringify(checkpoint()))
              ),
              Effect.tapError(() => Effect.sync(() => restore(previous)))
            )
          })
        )
      )
    const emit = (
      event:
        | {
            kind: "review-readiness-changed"
            revisionId: string
            readiness: ReviewReadiness
            commandId: string
          }
        | {
            kind: "unit-review-completed"
            revisionId: string
            unitId: string
            commandId: string
            briefingId: string
          }
        | {
            kind: "briefing-saved"
            revisionId: string
            unitId: string
            briefingId: string
            captureId: string
          }
        | { kind: "units-published" | "batch-registered"; revisionId: string }
        | {
            kind:
              | "disposition-submitted"
              | "comment-recorded"
              | "comment-dispatch"
              | "harness-update"
            revisionId: string
            unitId: string
            commandId: string
          }
    ) =>
      Effect.gen(function* () {
        sequence += 1
        journal = [...journal, Object.freeze({ ...event, sequence })].slice(
          -256
        )
        yield* PubSub.publish(notifications, sequence)
      })
    const checkUnit = (unitId: string, revisionId: string) =>
      Effect.gen(function* () {
        const unit = units.find((value) => value.unitId === unitId)
        if (!unit) return yield* Effect.fail(new UnitNotFound({ unitId }))
        if (unit.revisionId !== revisionId)
          return yield* Effect.fail(
            new StaleRevision({
              unitId,
              expected: unit.revisionId,
              received: revisionId,
            })
          )
        return unit
      })
    const decodeDisposition = Schema.decodeUnknownEffect(DispositionCommand)
    const decodeComment = Schema.decodeUnknownEffect(CommentCommand)
    const invalid = (error: { message: string }) =>
      new InvalidReviewInput({ detail: error.message })
    const submitDisposition = (
      input: DispositionCommand,
      principal: Principal
    ) =>
      transact(
        Effect.gen(function* () {
          if (!principal.id.trim())
            return yield* Effect.fail(
              new InvalidReviewInput({
                detail: "Principal identity is required",
              })
            )
          const command = yield* decodeDisposition(input).pipe(
            Effect.mapError(invalid)
          )
          const unit = yield* checkUnit(command.unitId, command.revisionId)
          if (
            (unit.lane === "human-required" ||
              dispositions
                .filter(
                  (value) =>
                    value.unitId === unit.unitId &&
                    value.revisionId === unit.revisionId &&
                    value.author.kind === "human"
                )
                .at(-1)?.decision === "request-changes") &&
            principal.kind !== "human" &&
            command.decision === "approve"
          )
            return yield* Effect.fail(
              new HumanDecisionRequired({ unitId: unit.unitId })
            )
          const fingerprint = JSON.stringify({
            kind: "disposition",
            command,
            principal,
          })
          const previous = commands.get(command.commandId)
          if (previous) {
            if (
              previous.fingerprint !== fingerprint ||
              previous.kind !== "disposition"
            )
              return yield* Effect.fail(
                new CommandConflict({ commandId: command.commandId })
              )
            return structuredClone(previous.value)
          }
          if (
            principal.kind === "human" &&
            command.decision === "approve" &&
            readiness !== "awaiting-human"
          )
            return yield* new AutomatedReviewPending({
              revisionId: command.revisionId,
              reason: "Automated review must finish before human approval",
            })
          const value: Disposition = Object.freeze({
            ...command,
            author: Object.freeze({ ...principal }),
          })
          dispositions = [...dispositions, value]
          commands.set(command.commandId, {
            fingerprint,
            kind: "disposition",
            value,
          })
          yield* emit({
            kind: "disposition-submitted",
            revisionId: command.revisionId,
            unitId: command.unitId,
            commandId: command.commandId,
          })
          if (command.decision === "request-changes") {
            readiness = "changes-requested"
            yield* emit({
              kind: "review-readiness-changed",
              revisionId: command.revisionId,
              commandId: command.commandId,
              readiness,
            })
          }
          return value
        })
      )
    const addComment = (input: CommentCommand, principal: Principal) =>
      transact(
        Effect.gen(function* () {
          if (!principal.id.trim())
            return yield* Effect.fail(
              new InvalidReviewInput({
                detail: "Principal identity is required",
              })
            )
          const command = yield* decodeComment(input).pipe(
            Effect.mapError(invalid)
          )
          yield* checkUnit(command.unitId, command.revisionId)
          const fingerprint = JSON.stringify({
            kind: "comment",
            command,
            principal,
          })
          const previous = commands.get(command.commandId)
          if (previous) {
            if (
              previous.fingerprint !== fingerprint ||
              previous.kind !== "comment"
            )
              return yield* Effect.fail(
                new CommandConflict({ commandId: command.commandId })
              )
            return structuredClone(previous.value)
          }
          const value: Comment = Object.freeze({
            ...command,
            author: Object.freeze({ ...principal }),
            dispatch: "pending",
          })
          comments = [...comments, value]
          commands.set(command.commandId, {
            fingerprint,
            kind: "comment",
            value,
          })
          yield* emit({
            kind: "comment-recorded",
            revisionId: command.revisionId,
            unitId: command.unitId,
            commandId: command.commandId,
          })
          if (command.intent === "request-changes") {
            readiness = "changes-requested"
            yield* emit({
              kind: "review-readiness-changed",
              revisionId: command.revisionId,
              commandId: command.commandId,
              readiness,
            })
            dispositions = [
              ...dispositions,
              {
                ...command,
                decision: "request-changes",
                rationale: command.body,
                author: Object.freeze({ ...principal }),
              },
            ]
            yield* emit({
              kind: "disposition-submitted",
              revisionId: command.revisionId,
              unitId: command.unitId,
              commandId: command.commandId,
            })
          }
          return value
        })
      )
    return ReviewStore.of({
      completeUnitReview: (input) =>
        transact(
          Effect.gen(function* () {
            const completion = yield* Schema.decodeUnknownEffect(
              CompleteUnitReview
            )(input).pipe(Effect.mapError(invalid))
            const unit = yield* checkUnit(
              completion.unitId,
              completion.revisionId
            )
            if (unit.lane === "static-automation")
              return yield* new AutomatedReviewPending({
                revisionId: completion.revisionId,
                reason:
                  "Static automation completion contract is not established",
              })
            const prior = completedUnitReviews.find(
              (value) => value.commandId === completion.commandId
            )
            if (prior) {
              if (JSON.stringify(prior) !== JSON.stringify(completion))
                return yield* new CommandConflict({
                  commandId: completion.commandId,
                })
              return structuredClone(prior)
            }
            const briefing = yield* storage
              .getBriefingById(completion.briefingId)
              .pipe(
                Effect.mapError((error) =>
                  error._tag === "StorageError"
                    ? error
                    : new InvalidReviewInput({
                        detail: "Cannot read completed review briefing",
                      })
                )
              )
            if (
              !briefing ||
              briefing.unitId !== completion.unitId ||
              briefing.revisionId !== completion.revisionId ||
              briefing.citations.length === 0 ||
              !briefing.segments.some((segment) => segment.kind === "cite")
            )
              return yield* new InvalidReviewInput({
                detail:
                  "Completed advisory review requires its persisted cited briefing",
              })
            completedUnitReviews = [
              ...completedUnitReviews,
              Object.freeze(completion),
            ]
            yield* emit({ kind: "unit-review-completed", ...completion })
            return completion
          })
        ),
      finishAutomatedReview: (input) =>
        transact(
          Effect.gen(function* () {
            const command = yield* Schema.decodeUnknownEffect(
              FinishAutomatedReview
            )(input).pipe(Effect.mapError(invalid))
            if (!batch || command.revisionId !== activeRevision)
              return yield* new AutomatedReviewPending({
                revisionId: command.revisionId,
                reason: "Submitted revision does not match current batch",
              })
            if (units.some((unit) => unit.lane === "static-automation"))
              return yield* new AutomatedReviewPending({
                revisionId: command.revisionId,
                reason:
                  "Static automation completion contract is not established",
              })
            const prior = finishCommands.find(
              (value) => value.commandId === command.commandId
            )
            if (prior) {
              if (JSON.stringify(prior) !== JSON.stringify(command))
                return yield* new CommandConflict({
                  commandId: command.commandId,
                })
              return readiness
            }
            const covered = new Set(units.flatMap((unit) => unit.hunkIds))
            if (
              covered.size !== batch.hunks.length ||
              batch.hunks.some((hunk) => !covered.has(hunk.hunkId))
            )
              return yield* new AutomatedReviewPending({
                revisionId: command.revisionId,
                reason:
                  "All registered responsibility hunks must have review units",
              })
            for (const unit of units) {
              if (unit.lane === "agentic" || unit.lane === "human-suggested") {
                if (
                  !dispositions.some(
                    (value) =>
                      value.unitId === unit.unitId &&
                      value.revisionId === unit.revisionId &&
                      value.author.kind === "agent"
                  )
                )
                  return yield* new AutomatedReviewPending({
                    revisionId: command.revisionId,
                    reason:
                      "Agent responsibility units require agent dispositions",
                  })
              } else if (
                !completedUnitReviews.some(
                  (value) =>
                    value.unitId === unit.unitId &&
                    value.revisionId === unit.revisionId
                )
              )
                return yield* new AutomatedReviewPending({
                  revisionId: command.revisionId,
                  reason:
                    "Human-required units require explicit completed advisory review records",
                })
            }
            const hasChanges = units.some(
              (unit) =>
                dispositions
                  .filter(
                    (value) =>
                      value.unitId === unit.unitId &&
                      value.revisionId === unit.revisionId
                  )
                  .at(-1)?.decision === "request-changes"
            )
            readiness = hasChanges ? "changes-requested" : "awaiting-human"
            finishCommands = [...finishCommands, Object.freeze(command)]
            yield* emit({
              kind: "review-readiness-changed",
              revisionId: command.revisionId,
              commandId: command.commandId,
              readiness,
            })
            return readiness
          })
        ),
      registerBatch: (input) =>
        transact(
          Effect.gen(function* () {
            const registered = yield* Schema.decodeUnknownEffect(
              RegisteredBatch
            )(input).pipe(Effect.mapError(invalid))
            if (
              new Set(registered.hunks.map((hunk) => hunk.hunkId)).size !==
              registered.hunks.length
            )
              return yield* new InvalidReviewInput({
                detail: "Registered hunk identities must be unique",
              })
            if (batch?.revisionId === registered.revisionId) {
              if (JSON.stringify(batch) !== JSON.stringify(registered))
                return yield* new InvalidReviewInput({
                  detail:
                    "A submitted revision cannot change its trusted hunk inventory",
                })
              return
            }
            if (previousRevisions.has(registered.revisionId))
              return yield* new InvalidReviewInput({
                detail: "Cannot register a superseded revision",
              })
            if (activeRevision !== undefined)
              previousRevisions.add(activeRevision)
            if (batch !== null) {
              archivedBatches = [...archivedBatches, batch]
              archivedUnits = [...archivedUnits, ...units]
            }
            batch = registered
            activeRevision = registered.revisionId
            units = []
            readiness = "processing"
            yield* emit({
              kind: "batch-registered",
              revisionId: registered.revisionId,
            })
          })
        ),
      publishUnits: (input) =>
        transact(
          Effect.gen(function* () {
            const batch = yield* Schema.decodeUnknownEffect(Batch)(input).pipe(
              Effect.mapError(invalid)
            )
            if (activeRevision !== batch.revisionId)
              return yield* new InvalidReviewInput({
                detail:
                  "Review units require the registered submitted revision",
              })
            const inventory = checkpoint().batch
            if (
              !inventory ||
              inventory.revisionId !== batch.revisionId ||
              batch.units.some((unit) =>
                unit.hunkIds.some(
                  (hunkId) =>
                    !inventory.hunks.some(
                      (hunk) =>
                        hunk.hunkId === hunkId && hunk.lane === unit.lane
                    )
                )
              )
            )
              return yield* new InvalidReviewInput({
                detail:
                  "Unit hunks and authority lane must match the trusted registered inventory",
              })
            if (
              batch.units.some(
                (unit) => unit.revisionId !== batch.revisionId
              ) ||
              new Set(batch.units.map((unit) => unit.unitId)).size !==
                batch.units.length
            )
              return yield* Effect.fail(
                new InvalidReviewInput({
                  detail:
                    "Units must have the batch revision and unique unit identities",
                })
              )
            if (
              activeRevision !== batch.revisionId &&
              previousRevisions.has(batch.revisionId)
            )
              return yield* Effect.fail(
                new InvalidReviewInput({
                  detail: "Cannot republish a superseded revision",
                })
              )
            const existing = activeRevision === batch.revisionId ? units : []
            const additions: Array<ReviewUnit> = []
            const assignedHunks = new Set(
              existing.flatMap((unit) => unit.hunkIds)
            )
            for (const unit of batch.units) {
              const prior = existing.find(
                (value) => value.unitId === unit.unitId
              )
              if (prior) {
                if (JSON.stringify(prior) !== JSON.stringify(unit))
                  return yield* Effect.fail(
                    new InvalidReviewInput({
                      detail:
                        "An existing review unit cannot be regrouped in the same revision",
                    })
                  )
                continue
              }
              if (
                unit.hunkIds.length === 0 ||
                new Set(unit.hunkIds).size !== unit.hunkIds.length ||
                unit.hunkIds.some((id) => assignedHunks.has(id))
              )
                return yield* Effect.fail(
                  new InvalidReviewInput({
                    detail:
                      "Review responsibility must have nonempty unique hunks without overlap",
                  })
                )
              for (const id of unit.hunkIds) assignedHunks.add(id)
              additions.push(
                Object.freeze({
                  ...unit,
                  hunkIds: Object.freeze([...unit.hunkIds]),
                })
              )
            }
            if (activeRevision === batch.revisionId && additions.length === 0)
              return
            if (
              finishCommands.some(
                (command) => command.revisionId === batch.revisionId
              )
            )
              return yield* new InvalidReviewInput({
                detail:
                  "Review units cannot be added after the automated review gate",
              })
            if (
              activeRevision !== undefined &&
              activeRevision !== batch.revisionId
            )
              previousRevisions.add(activeRevision)
            activeRevision = batch.revisionId
            units = [...existing, ...additions]
            yield* emit({
              kind: "units-published",
              revisionId: batch.revisionId,
            })
          })
        ),
      submitDisposition,
      addComment,
      recordDispatch: (input) =>
        transact(
          Effect.gen(function* () {
            const comment = comments.find(
              (value) =>
                value.commandId === input.commandId &&
                value.unitId === input.unitId &&
                value.revisionId === input.revisionId
            )
            if (!comment)
              return yield* Effect.fail(
                new CommandConflict({ commandId: input.commandId })
              )
            if (input.outcome !== "delivered" && input.outcome !== "failed")
              return yield* Effect.fail(
                new InvalidReviewInput({ detail: "Unknown dispatch outcome" })
              )
            if (input.outcome === "failed" && !input.detail?.trim())
              return yield* Effect.fail(
                new InvalidReviewInput({
                  detail: "Failed dispatch requires a reason",
                })
              )
            if (
              comment.dispatch === input.outcome &&
              (comment.dispatch !== "failed" ||
                comment.dispatchDetail === input.detail)
            )
              return structuredClone(comment)
            const value: Comment =
              input.outcome === "delivered"
                ? Object.freeze({ ...comment, dispatch: "delivered" })
                : Object.freeze({
                    ...comment,
                    dispatch: "failed",
                    dispatchDetail: input.detail ?? "Dispatch failed",
                  })
            comments = comments.map((existing) =>
              existing === comment ? value : existing
            )
            const entry = commands.get(comment.commandId)
            if (entry?.kind === "comment")
              commands.set(comment.commandId, { ...entry, value })
            yield* emit({
              kind: "comment-dispatch",
              revisionId: input.revisionId,
              unitId: input.unitId,
              commandId: input.commandId,
            })
            return value
          })
        ),
      recordBriefing: (input) =>
        transact(
          Effect.gen(function* () {
            const reference = yield* Schema.decodeUnknownEffect(
              BriefingReference
            )(input).pipe(Effect.mapError(invalid))
            yield* checkUnit(reference.unitId, reference.revisionId)
            const persisted = yield* storage
              .getBriefingById(reference.briefingId)
              .pipe(
                Effect.mapError((error) =>
                  error._tag === "StorageError"
                    ? error
                    : new InvalidReviewInput({
                        detail: "Persisted briefing cannot be read",
                      })
                )
              )
            if (
              !persisted ||
              persisted.captureId !== reference.captureId ||
              persisted.unitId !== reference.unitId ||
              persisted.revisionId !== reference.revisionId
            )
              return yield* new InvalidReviewInput({
                detail:
                  "Briefing reference requires the matching persisted artifact",
              })
            const previous = briefings.find(
              (value) => value.briefingId === reference.briefingId
            )
            if (previous) {
              if (JSON.stringify(previous) !== JSON.stringify(reference))
                return yield* new CommandConflict({
                  commandId: reference.briefingId,
                })
              return structuredClone(previous)
            }
            const value = Object.freeze(reference)
            briefings = [...briefings, value]
            yield* emit({ kind: "briefing-saved", ...reference })
            return value
          })
        ),
      recordHarnessUpdate: (input) =>
        transact(
          Effect.gen(function* () {
            const update = yield* Schema.decodeUnknownEffect(HarnessUpdate)(
              input
            ).pipe(Effect.mapError(invalid))
            const comment = comments.find(
              (value) =>
                value.commandId === update.commandId &&
                value.unitId === update.unitId &&
                value.revisionId === update.revisionId
            )
            if (!comment)
              return yield* new CommandConflict({ commandId: update.commandId })
            const previous = harnessUpdates.find(
              (value) => value.updateId === update.updateId
            )
            if (previous) {
              if (JSON.stringify(previous) !== JSON.stringify(update))
                return yield* new CommandConflict({
                  commandId: update.updateId,
                })
              return structuredClone(previous)
            }
            const value = Object.freeze(update)
            harnessUpdates = [...harnessUpdates, value]
            yield* emit({
              kind: "harness-update",
              revisionId: update.revisionId,
              unitId: update.unitId,
              commandId: update.commandId,
            })
            return value
          })
        ),
      snapshot: () =>
        lock.withPermits(1)(
          Effect.sync(() => ({
            sequence,
            readiness,
            completedUnitReviews: structuredClone(completedUnitReviews),
            batch: structuredClone(batch),
            archivedBatches: structuredClone(archivedBatches),
            archivedUnits: structuredClone(archivedUnits),
            historyLimitations:
              dispositions.some(
                (disposition) =>
                  ![...units, ...archivedUnits].some(
                    (unit) =>
                      unit.unitId === disposition.unitId &&
                      unit.revisionId === disposition.revisionId
                  )
              ) ||
              comments.some(
                (comment) =>
                  ![...units, ...archivedUnits].some(
                    (unit) =>
                      unit.unitId === comment.unitId &&
                      unit.revisionId === comment.revisionId
                  )
              )
                ? [
                    "Earlier checkpoints did not preserve all historical unit membership; unavailable hunk and lane attribution cannot be reconstructed.",
                  ]
                : [],
            units: structuredClone(units),
            dispositions: structuredClone(dispositions),
            comments: structuredClone(comments),
            harnessUpdates: structuredClone(harnessUpdates),
            briefings: structuredClone(briefings),
          }))
        ),
      subscribe: (afterSequence) =>
        Stream.unwrap(
          Effect.gen(function* () {
            const subscription = yield* PubSub.subscribe(notifications)
            let cursor = afterSequence
            let first = true
            return Stream.fromIterableEffectRepeat(
              Effect.gen(function* () {
                if (!first) yield* PubSub.take(subscription)
                first = false
                return yield* lock.withPermits(1)(
                  Effect.gen(function* () {
                    const oldestSequence = journal[0]?.sequence ?? sequence + 1
                    if (
                      !Number.isInteger(cursor) ||
                      cursor < oldestSequence - 1 ||
                      cursor > sequence
                    )
                      return yield* Effect.fail(
                        new ReplayGap({
                          afterSequence: cursor,
                          oldestSequence,
                          currentSequence: sequence,
                        })
                      )
                    const events = journal.filter(
                      (event) => event.sequence > cursor
                    )
                    cursor = sequence
                    return events
                  })
                )
              })
            )
          })
        ),
    })
  })
)
