import { createHash, timingSafeEqual } from "node:crypto";
import { Cause, Effect, Exit, Option, Schema, Semaphore, Stream } from "effect";
import { CommentCommand, DispositionCommand, CompleteUnitReview, FinishAutomatedReview, InvalidReviewInput, RegisteredBatch, ReviewStore, type Principal, type ReviewUnit } from "@workspace/backend";
import { editorReference, type HarnessTarget } from "@workspace/editor";
import { ReviewStorage, Briefing, QueryReceipt } from "@workspace/storage";
import { reviewRuntime } from "./runtime";
import { HarnessRelay } from "./relay";
import { readJsonBody } from "./body";
const admission = Semaphore.makeUnsafe(1);
export { reviewRuntime } from "./runtime";

const Publication = Schema.Struct({ revisionId: Schema.NonEmptyString, units: Schema.Array(Schema.Struct({ unitId: Schema.NonEmptyString, revisionId: Schema.NonEmptyString, title: Schema.NonEmptyString, hunkIds: Schema.Array(Schema.NonEmptyString) })) });
const Dispatch = Schema.Struct({ commandId: Schema.NonEmptyString, unitId: Schema.NonEmptyString, revisionId: Schema.NonEmptyString });
const Capture = Schema.Struct({ captureId: Schema.NonEmptyString, sessionId: Schema.NonEmptyString, toolCallId: Schema.NonEmptyString, result: Schema.Unknown });

const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
const authenticate = (request: Request, audience: "harness" | "review"): Principal | undefined => {
  const secret = audience === "harness" ? process.env.NEUVE_HARNESS_TOKEN : process.env.NEUVE_REVIEW_TOKEN;
  if (!secret || secret.length < 32) return undefined;
  const received = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(secret), digest(received))) return undefined;
  return audience === "harness" ? { kind: "agent", id: "eve-reviewer" } : { kind: "human", id: "local-reviewer" };
};

const targetFromEnvironment = (): HarnessTarget | undefined => {
  const command = process.env.NEUVE_ACP_COMMAND;
  const cwd = process.env.NEUVE_ACP_CWD;
  if (!command || !cwd) return undefined;
  const args: unknown = JSON.parse(process.env.NEUVE_ACP_ARGS ?? "[]");
  const env: Record<string, string> = {};
  for (const key of ["GEMINI_KEY", "NEUVE_HARNESS_TOKEN", "NEUVE_MCP_TOKEN", "NEUVE_BFF_URL", "NEUVE_MCP_URL", "NEUVE_GEMINI_MODEL"]) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return { command, cwd, args: Schema.decodeUnknownSync(Schema.Array(Schema.String))(args), env };
};

const failureResponse = (error: unknown) => {
  if (typeof error !== "object" || error === null || !("_tag" in error)) return json({ error: "InternalError" }, 500);
  const tag = error._tag;
  switch (tag) {
    case "StoredRecordNotFound": case "UnitNotFound": return json({ error: tag }, 404);
    case "AutomatedReviewPending": case "StorageConflict": case "StaleRevision": case "CommandConflict": case "ReplayGap": return json({ error: tag }, 409);
    case "HumanDecisionRequired": return json({ error: tag }, 403);
    case "StorageValidationError": case "InvalidReviewInput": return json({ error: tag }, 400);
    default: return json({ error: "InternalError" }, 500);
  }
};

async function handleAuthenticatedRequest(request: Request, audience: "harness" | "review", operation: string) {
  const principal = authenticate(request, audience);
  if (!principal) return json({ error: "Unauthorized" }, 401);
  if (request.method === "GET" && operation === "snapshot") {
    return reviewRuntime.runPromise(ReviewStore.use((store) => store.snapshot().pipe(Effect.map((snapshot) => json(snapshot)))), { signal: request.signal });
  }
  if (request.method === "GET" && operation === "events") {
    const cursor = Number(new URL(request.url).searchParams.get("after"));
    if (!Number.isSafeInteger(cursor) || cursor < 0) return json({ error: "InvalidCursor" }, 400);
    const stream = await reviewRuntime.runPromise(ReviewStore.use((store) => Effect.succeed(
      store.subscribe(cursor).pipe(
        Stream.interruptWhen(Effect.callback<void>((resume) => {
          const abort = () => resume(Effect.void);
          if (request.signal.aborted) abort();
          else request.signal.addEventListener("abort", abort, { once: true });
          return Effect.sync(() => request.signal.removeEventListener("abort", abort));
        })),
        Stream.map((event) => JSON.stringify(event) + "\n"),
        Stream.catchTag("ReplayGap", (error) => Stream.succeed(JSON.stringify({ kind: "resnapshot-required", ...error }) + "\n")),
      ),
    )), { signal: request.signal });
    return new Response(Stream.toReadableStream(stream), { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
  }
  if (request.method === "GET" && (operation === "captures" || operation === "briefings" || operation === "reference")) {
    const url = new URL(request.url);
    return reviewRuntime.runPromise(Effect.gen(function* () {
      const storage = yield* ReviewStorage;
      if (operation === "captures") return json(yield* storage.listCaptures(url.searchParams.get("sessionId") ?? ""));
      if (operation === "reference") {
        const briefing = yield* storage.getBriefingById(url.searchParams.get("briefingId") ?? "");
        const citation = briefing?.citations.find((value) => value.citationId === url.searchParams.get("citationId"));
        if (!briefing || !citation) return json({ error: "ReferenceNotFound" }, 404);
        const capture = yield* storage.getCapture(briefing.captureId);
        return json(yield* editorReference({ source: capture.result.source, citation }));
      }
      const briefingId = url.searchParams.get("briefingId");
      return json(briefingId ? (yield* storage.getBriefingById(briefingId)) ?? null : yield* storage.getBriefing({ unitId: url.searchParams.get("unitId") ?? "", revisionId: url.searchParams.get("revisionId") ?? "" }));
    }).pipe(Effect.catch((error) => Effect.succeed(failureResponse(error)))), { signal: request.signal });
  }
  if (request.method !== "POST") return json({ error: "MethodNotAllowed" }, 405);
  const size = Number(request.headers.get("content-length") ?? "0");
  if (size > 128_000) return json({ error: "PayloadTooLarge" }, 413);
  const body = await Effect.runPromiseExit(readJsonBody(request), { signal: request.signal });
  if (Exit.isFailure(body)) {
    const error = Cause.findErrorOption(body.cause);
    return Option.isSome(error) && error.value.reason === "payload-too-large" ? json({ error: "PayloadTooLarge" }, 413) : json({ error: "InvalidJson" }, 400);
  }
  const input = body.value;
  const program = Effect.gen(function* () {
    const store = yield* ReviewStore;
    const invalid = () => new InvalidReviewInput({ detail: "Invalid request" });
    switch (operation) {
      case "batch": {
        if (principal.kind !== "human") return json({ error: "Forbidden" }, 403);
        const registered = yield* Schema.decodeUnknownEffect(RegisteredBatch)(input).pipe(Effect.mapError(invalid));
        yield* store.registerBatch(registered);
        return json({ registered: true });
      }
      case "units": {
        const publication = yield* Schema.decodeUnknownEffect(Publication)(input).pipe(Effect.mapError(invalid));
        const inventory = (yield* store.snapshot()).batch;
        if (!inventory || publication.revisionId !== inventory.revisionId) return yield* Effect.fail(invalid());
        const units: ReviewUnit[] = [];
        for (const unit of publication.units) {
          const first = inventory.hunks.find((hunk) => hunk.hunkId === unit.hunkIds[0]);
          if (!first || unit.revisionId !== inventory.revisionId || unit.hunkIds.some((id) => !inventory.hunks.some((hunk) => hunk.hunkId === id && hunk.lane === first.lane))) return yield* Effect.fail(invalid());
          units.push({ ...unit, lane: first.lane });
        }
        yield* store.publishUnits({ revisionId: publication.revisionId, units });
        return json({ accepted: true });
      }
      case "complete-unit-review": {
        if (principal.kind !== "agent") return json({ error: "Forbidden" }, 403);
        const command = yield* Schema.decodeUnknownEffect(CompleteUnitReview)(input).pipe(Effect.mapError(invalid));
        return json(yield* store.completeUnitReview(command));
      }
      case "finish-review": {
        if (principal.kind !== "agent") return json({ error: "Forbidden" }, 403);
        const command = yield* Schema.decodeUnknownEffect(FinishAutomatedReview)(input).pipe(Effect.mapError(invalid));
        return json(yield* store.finishAutomatedReview(command));
      }
      case "dispositions": {
        const command = yield* Schema.decodeUnknownEffect(DispositionCommand)(input).pipe(Effect.mapError(invalid));
        return json(yield* store.submitDisposition(command, principal));
      }
      case "comments": {
        const command = yield* Schema.decodeUnknownEffect(CommentCommand)(input).pipe(Effect.mapError(invalid));
        return json(yield* store.addComment(command, principal), 201);
      }
      case "dispatch": {
        if (principal.kind !== "human") return json({ error: "Forbidden" }, 403);
        const command = yield* Schema.decodeUnknownEffect(Dispatch)(input).pipe(Effect.mapError(invalid));
        const snapshot = yield* store.snapshot();
        const comment = snapshot.comments.find((value) => value.commandId === command.commandId && value.unitId === command.unitId && value.revisionId === command.revisionId);
        if (!comment) return json({ error: "CommentNotFound" }, 404);
        if (comment.dispatch === "delivered") return json(comment);
        if (snapshot.batch?.revisionId !== command.revisionId) return json({ error: "StaleRevision" }, 409);
        const target = yield* Effect.try({ try: targetFromEnvironment, catch: invalid });
        if (!target) return json({ error: "AcpTargetNotConfigured" }, 503);
        const relay = yield* HarnessRelay;
        return json(yield* relay.start(comment, target), 202);
      }
      case "captures": {
        if (principal.kind !== "agent") return json({ error: "Forbidden" }, 403);
        const capture = yield* Schema.decodeUnknownEffect(Capture)(input).pipe(Effect.mapError(invalid));
        const parsed = QueryReceipt.safeParse(capture.result);
        if (!parsed.success || parsed.data.source.repository !== process.env.NEUVE_REPOSITORY) return yield* Effect.fail(invalid());
        const snapshot = yield* store.snapshot();
        if (snapshot.batch && parsed.data.source.revision !== snapshot.batch.revisionId) return yield* Effect.fail(invalid());
        const storage = yield* ReviewStorage;
        return json(yield* storage.capture({ ...capture, result: parsed.data }), 201);
      }
      case "briefings": {
        const briefing = yield* Schema.decodeUnknownEffect(Briefing)(input).pipe(Effect.mapError(invalid));
        const snapshot = yield* store.snapshot();
        if (!snapshot.units.some((unit) => unit.unitId === briefing.unitId && unit.revisionId === briefing.revisionId)) return yield* Effect.fail(invalid());
        const storage = yield* ReviewStorage;
        const saved = yield* storage.saveBriefing(briefing);
        yield* store.recordBriefing({ briefingId: saved.briefingId, captureId: saved.captureId, unitId: saved.unitId, revisionId: saved.revisionId });
        return json(saved, 201);
      }
      default: return json({ error: "NotFound" }, 404);
    }
  }).pipe(Effect.catch((error) => Effect.succeed(failureResponse(error))));
  return reviewRuntime.runPromise(admission.withPermits(1)(program), { signal: request.signal });
}




export async function handleReviewRequest(request: Request, audience: "harness" | "review", operation: string) {
  try { return await handleAuthenticatedRequest(request, audience, operation); }
  catch { return json({ error: "ServiceUnavailable" }, 503); }
}
