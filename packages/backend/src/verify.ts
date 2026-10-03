import { Effect, Stream, Layer } from "effect"
import { StorageLive, ReviewStorage, QueryReceipt } from "@workspace/storage"
import { migrateDatabase } from "../../storage/src/migrate"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ReviewStore, ReviewStoreLive } from "./store"

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message)
}
const revision1 = "a".repeat(40)
const revision2 = "b".repeat(40)
const revision3 = "c".repeat(40)
const program = Effect.gen(function* () {
  const store = yield* ReviewStore
  const agent = { kind: "agent", id: "reviewer" } as const
  const human = { kind: "human", id: "local-user" } as const
  const unit = {
    unitId: "u1",
    revisionId: revision1,
    title: "Permission change",
    lane: "human-required",
    hunkIds: ["h1"],
  } as const
  yield* store.registerBatch({
    revisionId: revision1,
    hunks: [
      { hunkId: "h1", lane: "human-required" },
      { hunkId: "h2", lane: "human-required" },
    ],
  })
  yield* store.publishUnits({
    revisionId: revision1,
    units: [{ ...unit, hunkIds: ["h1", "h2"] }],
  })
  const command = {
    commandId: "d1",
    unitId: "u1",
    revisionId: revision1,
    decision: "approve",
    rationale: "Inspected evidence",
  } as const
  const forbidden = yield* store
    .submitDisposition(command, agent)
    .pipe(Effect.flip)
  assert(
    forbidden._tag === "HumanDecisionRequired",
    "Agent cannot approve human-required work"
  )
  const earlyHuman = yield* store
    .submitDisposition(command, human)
    .pipe(Effect.flip)
  assert(
    earlyHuman._tag === "AutomatedReviewPending",
    "Human approval waits for automated review gate"
  )
  const storage = yield* ReviewStorage
  const result = QueryReceipt.parse({
    schema_version: 2,
    provider: {
      name: "entire-graph",
      version: "1",
      identity_revision: "fixture",
      capabilities: {
        schema_version: "1",
        languages: {
          supported: [],
          semantic: [],
          inventory_only: [],
          unsupported_detected_hints: [],
        },
      },
    },
    query: "Explain permission",
    source: { repository: "/tmp/fixture", revision: revision1 },
    retrieval: {
      status: "ok",
      coverage: "candidate scope",
      contained_callable_coverage: "unavailable",
      candidates: [
        {
          kind: "region",
          language: null,
          source: { kind: "range", path: "policy", start_line: 1, end_line: 1 },
          contained_callables: { status: "unavailable" },
        },
      ],
      warnings: [],
      partial_failures: [],
      limitations: [],
      budget: { returned_results: 1 },
    },
    structural_observations: [],
    source_evidence: [
      {
        path: "policy",
        start_line: 1,
        end_line: 1,
        text: "owner permission",
        blob_oid: "d".repeat(40),
        revision: revision1,
      },
    ],
  })
  yield* storage.capture({
    captureId: "gate-capture",
    sessionId: "gate-session",
    toolCallId: "gate-call",
    result,
  })
  yield* storage.saveBriefing({
    briefingId: "gate-briefing",
    captureId: "gate-capture",
    unitId: "u1",
    revisionId: revision1,
    title: "Permission",
    segments: [{ kind: "cite", label: "Policy", citationId: "source" }],
    citations: [
      {
        citationId: "source",
        path: "policy",
        startLine: 1,
        endLine: 1,
        explanation: "Permission source",
      },
    ],
    limitations: ["No test execution"],
  })
  yield* store.recordBriefing({
    briefingId: "gate-briefing",
    captureId: "gate-capture",
    unitId: "u1",
    revisionId: revision1,
  })
  yield* store.completeUnitReview({
    commandId: "complete-u1",
    unitId: "u1",
    revisionId: revision1,
    briefingId: "gate-briefing",
  })
  const ready = yield* store.finishAutomatedReview({
    commandId: "finish-r1",
    revisionId: revision1,
  })
  assert(
    ready === "awaiting-human",
    "Explicit complete advisory review opens human gate"
  )
  const gateRestart = yield* Effect.gen(function* () {
    const reopened = yield* ReviewStore
    const snapshot = yield* reopened.snapshot()
    const events = yield* Stream.runCollect(
      reopened.subscribe(0).pipe(Stream.take(snapshot.sequence))
    )
    return { snapshot, events }
  }).pipe(
    Effect.provide(ReviewStoreLive.pipe(Layer.provide(StorageLive({ path }))))
  )
  assert(
    gateRestart.snapshot.readiness === "awaiting-human" &&
      gateRestart.events.some((event) => event.kind === "briefing-saved") &&
      gateRestart.events.some(
        (event) => event.kind === "unit-review-completed"
      ) &&
      gateRestart.events.some(
        (event) => event.kind === "review-readiness-changed"
      ),
    "Persisted shared event schema roundtrips artifact, readiness and unit completion after restart"
  )
  yield* store.submitDisposition(command, human)
  const beforeDuplicate = yield* store.snapshot()
  yield* store.submitDisposition(command, human)
  const snapshot = yield* store.snapshot()
  assert(
    snapshot.dispositions.length === 1 &&
      snapshot.sequence === beforeDuplicate.sequence,
    "Duplicate commands have no additional effects"
  )
  const replay = yield* Stream.runCollect(
    store.subscribe(0).pipe(Stream.take(snapshot.sequence))
  )
  assert(
    replay.length === snapshot.sequence &&
      replay.at(-1)?.sequence === snapshot.sequence,
    "Reconnect replays sequence without loss"
  )
  yield* store.addComment(
    {
      commandId: "c1",
      unitId: "u1",
      revisionId: revision1,
      body: "Helpful context",
      intent: "informational",
    },
    human
  )
  yield* store.recordDispatch({
    commandId: "c1",
    unitId: "u1",
    revisionId: revision1,
    outcome: "failed",
    detail: "Editor disconnected",
  })
  const correlation = {
    commandId: "c1",
    unitId: "u1",
    revisionId: revision1,
    sessionId: "acp-session",
  }
  yield* store.recordHarnessUpdate({
    ...correlation,
    updateId: "update-start",
    kind: "session-started",
  })
  yield* store.recordHarnessUpdate({
    ...correlation,
    updateId: "update-message",
    kind: "agent-message",
    text: "Inspecting correction",
    truncated: false,
  })
  yield* store.recordHarnessUpdate({
    ...correlation,
    updateId: "update-end",
    kind: "prompt-finished",
    stopReason: "end_turn",
  })
  yield* store.recordHarnessUpdate({
    ...correlation,
    updateId: "update-end",
    kind: "prompt-finished",
    stopReason: "end_turn",
  })
  const phantom = yield* store
    .recordBriefing({
      briefingId: "missing",
      captureId: "missing",
      unitId: "u1",
      revisionId: revision1,
    })
    .pipe(Effect.flip)
  assert(
    phantom._tag === "InvalidReviewInput",
    "Only persisted matching briefings become visible artifacts"
  )
  const commented = yield* store.snapshot()
  assert(
    commented.dispositions.length === 1 &&
      commented.comments[0]?.dispatch === "failed" &&
      commented.harnessUpdates.length === 3,
    "Informational comment preserves disposition and reports dispatch failure"
  )
  yield* store.registerBatch({
    revisionId: revision2,
    hunks: [
      { hunkId: "h1", lane: "human-required" },
      { hunkId: "h2", lane: "human-required" },
    ],
  })
  yield* store.publishUnits({
    revisionId: revision2,
    units: [{ ...unit, revisionId: revision2 }],
  })
  const stale = yield* store
    .submitDisposition({ ...command, commandId: "d2" }, human)
    .pipe(Effect.flip)
  assert(stale._tag === "StaleRevision", "New revision rejects old decisions")
  const invalidRevision = yield* store
    .publishUnits({
      revisionId: revision2,
      units: [{ ...unit, revisionId: revision2, title: "Changed identity" }],
    })
    .pipe(Effect.flip)
  assert(
    invalidRevision._tag === "InvalidReviewInput",
    "Existing unit identity cannot be reassigned"
  )
  yield* store.publishUnits({
    revisionId: revision2,
    units: [{ ...unit, unitId: "u2", revisionId: revision2, hunkIds: ["h2"] }],
  })
  const incremental = yield* store.snapshot()
  assert(
    incremental.units.length === 2,
    "Same revision can append review units"
  )
  const overlap = yield* store
    .publishUnits({
      revisionId: revision2,
      units: [{ ...unit, unitId: "u3", revisionId: revision2 }],
    })
    .pipe(Effect.flip)
  assert(
    overlap._tag === "InvalidReviewInput",
    "Appended responsibility cannot overlap existing hunks"
  )
  yield* store.registerBatch({
    revisionId: revision3,
    hunks: [{ hunkId: "h1", lane: "human-suggested" }],
  })
  yield* store.publishUnits({
    revisionId: revision3,
    units: [{ ...unit, revisionId: revision3, lane: "human-suggested" }],
  })
  yield* store.submitDisposition(
    {
      ...command,
      commandId: "human-change",
      revisionId: revision3,
      decision: "request-changes",
    },
    human
  )
  const overridden = yield* store
    .submitDisposition(
      { ...command, commandId: "agent-override", revisionId: revision3 },
      agent
    )
    .pipe(Effect.flip)
  assert(
    overridden._tag === "HumanDecisionRequired",
    "Agent cannot overwrite human corrections"
  )
  for (let index = 0; index < 260; index++) {
    yield* store.addComment(
      {
        commandId: `overflow-${index}`,
        unitId: "u1",
        revisionId: revision3,
        body: "Context",
        intent: "informational",
      },
      agent
    )
  }
  const gap = yield* Stream.runCollect(
    store.subscribe(0).pipe(Stream.take(1))
  ).pipe(Effect.flip)
  assert(
    gap._tag === "ReplayGap",
    "Overflow requires resnapshot rather than silent event loss"
  )
  const staticRevision = "e".repeat(40)
  yield* store.registerBatch({
    revisionId: staticRevision,
    hunks: [{ hunkId: "static-hunk", lane: "static-automation" }],
  })
  yield* store.publishUnits({
    revisionId: staticRevision,
    units: [
      {
        unitId: "static-unit",
        revisionId: staticRevision,
        title: "Generated data",
        lane: "static-automation",
        hunkIds: ["static-hunk"],
      },
    ],
  })
  yield* storage.capture({
    captureId: "static-capture",
    sessionId: "static-session",
    toolCallId: "static-query",
    result: {
      ...result,
      source: { ...result.source, revision: staticRevision },
      source_evidence: result.source_evidence?.map((evidence) => ({
        ...evidence,
        revision: staticRevision,
      })),
    },
  })
  yield* storage.saveBriefing({
    briefingId: "static-briefing",
    captureId: "static-capture",
    unitId: "static-unit",
    revisionId: staticRevision,
    title: "Static advisory",
    segments: [{ kind: "cite", label: "Policy", citationId: "source" }],
    citations: [
      {
        citationId: "source",
        path: "policy",
        startLine: 1,
        endLine: 1,
        explanation: "Captured source metadata is not static verification",
      },
    ],
    limitations: ["Static automation completion contract is not established"],
  })
  const advisory = yield* store
    .completeUnitReview({
      commandId: "static-advisory",
      unitId: "static-unit",
      revisionId: staticRevision,
      briefingId: "static-briefing",
    })
    .pipe(Effect.flip)
  assert(
    advisory._tag === "AutomatedReviewPending" &&
      advisory.reason ===
        "Static automation completion contract is not established",
    "AI advisory cannot discharge static automation responsibility"
  )
  const staticFinish = yield* store
    .finishAutomatedReview({
      commandId: "static-finish",
      revisionId: staticRevision,
    })
    .pipe(Effect.flip)
  assert(
    staticFinish._tag === "AutomatedReviewPending" &&
      staticFinish.reason ===
        "Static automation completion contract is not established",
    "Static responsibility keeps the human gate pending until its completion contract is established"
  )
  yield* Effect.log("Backend executable scenarios passed")
})
const directory = mkdtempSync(join(tmpdir(), "neuve-review-"))
const path = join(directory, "review.sqlite")
migrateDatabase(path)
const storage = StorageLive({ path })
try {
  await Effect.runPromise(
    program.pipe(
      Effect.provide(
        Layer.merge(storage, ReviewStoreLive.pipe(Layer.provide(storage)))
      )
    )
  )
  const restored = await Effect.runPromise(
    Effect.gen(function* () {
      const store = yield* ReviewStore
      return yield* store.snapshot()
    }).pipe(
      Effect.provide(ReviewStoreLive.pipe(Layer.provide(StorageLive({ path }))))
    )
  )
  const oldUnit = restored.archivedUnits.find(
    (unit) => unit.unitId === "u1" && unit.revisionId === revision1
  )
  const changedUnit = restored.archivedUnits.find(
    (unit) => unit.unitId === "u1" && unit.revisionId === revision3
  )
  assert(
    oldUnit?.lane === "human-required" &&
      oldUnit.hunkIds.join(",") === "h1,h2" &&
      changedUnit?.lane === "human-suggested" &&
      changedUnit.hunkIds.join(",") === "h1" &&
      restored.archivedBatches.length === 3 &&
      restored.historyLimitations.length === 0,
    "Restart preserves original revision unit lane/hunks independently of same unit identity reused later"
  )
  assert(
    restored.comments.length === 261 &&
      restored.batch?.revisionId === "e".repeat(40) &&
      restored.harnessUpdates.length === 3 &&
      restored.completedUnitReviews.length === 1 &&
      restored.briefings.length === 1 &&
      restored.readiness === "processing",
    "Review records and trusted inventory survive restart"
  )
} finally {
  rmSync(directory, { recursive: true, force: true })
}
