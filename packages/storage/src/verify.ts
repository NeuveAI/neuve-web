import { strict as assert } from "node:assert"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect } from "effect"
import { migrateDatabase } from "./migrate"
import { ReviewStorage, StorageLive } from "./storage"
import { QueryReceipt } from "./domain"

const revision = "a".repeat(40)
const result = QueryReceipt.parse({
  schema_version: 2,
  provider: {
    name: "entire-graph",
    version: "1",
    identity_revision: "fixture",
    capabilities: {
      schema_version: "1",
      languages: {
        supported: ["arbitrary"],
        semantic: ["arbitrary"],
        inventory_only: [],
        unsupported_detected_hints: [],
      },
    },
  },
  query: "Explain authorization",
  source: { repository: "/tmp/fixture", revision },
  retrieval: {
    status: "ok",
    coverage: "candidate scope",
    contained_callable_coverage: "unavailable",
    candidates: [
      {
        kind: "region",
        language: "arbitrary",
        source: {
          kind: "range",
          path: "policy.unusual",
          start_line: 1,
          end_line: 2,
        },
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
      path: "policy.unusual",
      start_line: 1,
      end_line: 2,
      text: "allow owner\nreject viewer",
      blob_oid: "b".repeat(40),
      revision,
    },
  ],
  source_evidence_limitations: [],
  source_evidence_budget: { requested_bytes: 100, returned_bytes: 25 },
})
const capture = {
  captureId: "capture-1",
  sessionId: "session-1",
  toolCallId: "call-1",
  result,
}
const briefing = {
  briefingId: "briefing-1",
  captureId: capture.captureId,
  unitId: "unit-1",
  revisionId: revision,
  title: "Authorization boundary",
  segments: [
    { kind: "text" as const, text: "Owner authorization is explicit." },
    { kind: "cite" as const, label: "Policy", citationId: "citation-1" },
  ],
  citations: [
    {
      citationId: "citation-1",
      path: "policy.unusual",
      startLine: 1,
      endLine: 2,
      explanation: "The captured policy separates owner and viewer access.",
    },
  ],
  limitations: ["This receipt does not establish runtime verification."],
}
const directory = mkdtempSync(join(tmpdir(), "neuve-storage-"))
const path = join(directory, "review.sqlite")
try {
  migrateDatabase(path)
  await Effect.runPromise(
    Effect.gen(function* () {
      const storage = yield* ReviewStorage
      yield* storage.capture(capture)
      yield* storage.capture(capture)
      yield* storage.saveBriefing(briefing)
      yield* storage.saveBriefing(briefing)
      assert.equal((yield* storage.listCaptures("session-1")).length, 1)
      const conflict = yield* storage
        .capture({
          ...capture,
          result: { ...result, query: "Different query" },
        })
        .pipe(Effect.flip)
      assert.equal(conflict._tag, "StorageConflict")
      const fabricated = yield* storage
        .saveBriefing({
          ...briefing,
          briefingId: "fabricated",
          citations: [{ ...briefing.citations[0]!, endLine: 3 }],
        })
        .pipe(Effect.flip)
      assert.equal(fabricated._tag, "StorageValidationError")
      assert.equal(yield* storage.getBriefingById("missing"), undefined)
    }).pipe(Effect.provide(StorageLive({ path })))
  )
  await Effect.runPromise(
    Effect.gen(function* () {
      const storage = yield* ReviewStorage
      assert.deepEqual(yield* storage.getCapture(capture.captureId), capture)
      assert.deepEqual(
        yield* storage.getBriefingById(briefing.briefingId),
        briefing
      )
    }).pipe(Effect.provide(StorageLive({ path })))
  )
  process.stdout.write(
    "Verified migrated SQLite capture/briefing persistence, idempotency, provenance and citation rejection.\n"
  )
} finally {
  rmSync(directory, { recursive: true, force: true })
}
