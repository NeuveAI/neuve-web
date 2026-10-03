import { randomUUID } from "node:crypto";
import { Context, Effect, Layer } from "effect";
import { ReviewStore, type Comment } from "@workspace/backend";
import { dispatchComment, type HarnessTarget } from "@workspace/editor";

export class HarnessRelay extends Context.Service<HarnessRelay, {
  readonly start: (comment: Comment, target: HarnessTarget) => Effect.Effect<{ accepted: true; attemptId: string | null }>;
}>()("@neuve/HarnessRelay") {}

export const HarnessRelayLive = Layer.effect(HarnessRelay, Effect.gen(function* () {
  const store = yield* ReviewStore;
  const scope = yield* Effect.scope;
  const active = new Map<string, string>();
  return HarnessRelay.of({ start: (comment, target) => Effect.uninterruptible(Effect.gen(function* () {
    const key = comment.commandId;
    const existing = active.get(key);
    if (existing) return { accepted: true, attemptId: existing };
    const attemptId = randomUUID();
    active.set(key, attemptId);
    let updateSequence = 0;
    const command = { commandId: comment.commandId, unitId: comment.unitId, revisionId: comment.revisionId };
    const job = dispatchComment(target, comment, {
      onUpdate: (update) => Effect.runPromise(store.recordHarnessUpdate({ ...update, updateId: `${attemptId}:${++updateSequence}` })).then(() => undefined),
    }).pipe(
      Effect.flatMap(() => store.recordDispatch({ ...command, outcome: "delivered" })),
      Effect.catchTag("HarnessDispatchError", (error) => store.recordDispatch({ ...command, outcome: "failed", detail: error.detail })),
      Effect.catchCause((cause) => Effect.logError("Comment dispatch failed", cause)),
      Effect.ensuring(Effect.sync(() => active.delete(key))),
    );
    yield* Effect.forkIn(job, scope);
    return { accepted: true, attemptId };
  })) });
}));
