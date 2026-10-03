import { Schema } from "effect"

export const ReviewUnit = Schema.Struct({
  unitId: Schema.NonEmptyString,
  revisionId: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
  lane: Schema.Literals([
    "static-automation",
    "agentic",
    "human-suggested",
    "human-required",
  ]),
  hunkIds: Schema.Array(Schema.NonEmptyString),
})
export const RegisteredBatch = Schema.Struct({
  revisionId: Schema.NonEmptyString,
  hunks: Schema.Array(
    Schema.Struct({
      hunkId: Schema.NonEmptyString,
      lane: ReviewUnit.fields.lane,
    })
  ),
})
export type RegisteredBatch = typeof RegisteredBatch.Type
export type ReviewUnit = typeof ReviewUnit.Type
export const DispositionCommand = Schema.Struct({
  commandId: Schema.NonEmptyString,
  unitId: Schema.NonEmptyString,
  revisionId: Schema.NonEmptyString,
  decision: Schema.Literals(["approve", "request-changes"]),
  rationale: Schema.NonEmptyString,
})
export type DispositionCommand = typeof DispositionCommand.Type
export const CommentCommand = Schema.Struct({
  commandId: Schema.NonEmptyString,
  unitId: Schema.NonEmptyString,
  revisionId: Schema.NonEmptyString,
  body: Schema.NonEmptyString,
  intent: Schema.Literals(["informational", "request-changes"]),
})
export type CommentCommand = typeof CommentCommand.Type
export type Principal = {
  readonly kind: "human" | "agent"
  readonly id: string
}
const HarnessCorrelation = {
  updateId: Schema.NonEmptyString,
  commandId: Schema.NonEmptyString,
  unitId: Schema.NonEmptyString,
  revisionId: Schema.NonEmptyString,
  sessionId: Schema.NonEmptyString,
}
export const HarnessUpdate = Schema.Union([
  Schema.Struct({
    ...HarnessCorrelation,
    kind: Schema.Literal("session-started"),
  }),
  Schema.Struct({
    ...HarnessCorrelation,
    kind: Schema.Literal("agent-message"),
    text: Schema.String,
    truncated: Schema.Boolean,
  }),
  Schema.Struct({
    ...HarnessCorrelation,
    kind: Schema.Literal("tool-status"),
    toolCallId: Schema.NonEmptyString,
    title: Schema.NullOr(Schema.String),
    status: Schema.NullOr(
      Schema.Literals(["pending", "in_progress", "completed", "failed"])
    ),
  }),
  Schema.Struct({
    ...HarnessCorrelation,
    kind: Schema.Literal("prompt-finished"),
    stopReason: Schema.NonEmptyString,
  }),
  Schema.Struct({
    ...HarnessCorrelation,
    kind: Schema.Literal("failed"),
    message: Schema.NonEmptyString,
  }),
])
export type HarnessUpdate = typeof HarnessUpdate.Type
export type Disposition = DispositionCommand & { readonly author: Principal }
export type Comment = CommentCommand & { readonly author: Principal } & (
    | { readonly dispatch: "pending" }
    | { readonly dispatch: "delivered" }
    | { readonly dispatch: "failed"; readonly dispatchDetail: string }
  )
export const BriefingReference = Schema.Struct({
  briefingId: Schema.NonEmptyString,
  captureId: Schema.NonEmptyString,
  unitId: Schema.NonEmptyString,
  revisionId: Schema.NonEmptyString,
})
export type BriefingReference = typeof BriefingReference.Type
export const CompleteUnitReview = Schema.Struct({
  commandId: Schema.NonEmptyString,
  unitId: Schema.NonEmptyString,
  revisionId: Schema.NonEmptyString,
  briefingId: Schema.NonEmptyString,
})
export type CompleteUnitReview = typeof CompleteUnitReview.Type
export const FinishAutomatedReview = Schema.Struct({
  commandId: Schema.NonEmptyString,
  revisionId: Schema.NonEmptyString,
})
export type FinishAutomatedReview = typeof FinishAutomatedReview.Type
export const ReviewReadiness = Schema.Literals([
  "processing",
  "awaiting-human",
  "changes-requested",
])
export type ReviewReadiness = typeof ReviewReadiness.Type
export const ReviewEvent = Schema.Union([
  Schema.Struct({
    sequence: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
    revisionId: Schema.String,
    kind: Schema.Literal("review-readiness-changed"),
    readiness: ReviewReadiness,
    commandId: Schema.String,
  }),
  Schema.Struct({
    sequence: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
    revisionId: Schema.String,
    kind: Schema.Literal("unit-review-completed"),
    unitId: Schema.String,
    commandId: Schema.String,
    briefingId: Schema.String,
  }),
  Schema.Struct({
    sequence: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
    revisionId: Schema.String,
    kind: Schema.Literal("briefing-saved"),
    briefingId: Schema.String,
    captureId: Schema.String,
    unitId: Schema.String,
  }),
  Schema.Struct({
    sequence: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
    revisionId: Schema.String,
    kind: Schema.Literals(["units-published", "batch-registered"]),
  }),
  Schema.Struct({
    sequence: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
    revisionId: Schema.String,
    kind: Schema.Literals([
      "disposition-submitted",
      "comment-recorded",
      "comment-dispatch",
      "harness-update",
    ]),
    unitId: Schema.String,
    commandId: Schema.String,
  }),
])
export type ReviewEvent = typeof ReviewEvent.Type
export type ReviewSnapshot = {
  readonly sequence: number
  readonly readiness: ReviewReadiness
  readonly completedUnitReviews: ReadonlyArray<CompleteUnitReview>
  readonly batch: RegisteredBatch | null
  readonly archivedBatches: ReadonlyArray<RegisteredBatch>
  readonly archivedUnits: ReadonlyArray<ReviewUnit>
  readonly historyLimitations: ReadonlyArray<string>
  readonly units: ReadonlyArray<ReviewUnit>
  readonly dispositions: ReadonlyArray<Disposition>
  readonly comments: ReadonlyArray<Comment>
  readonly briefings: ReadonlyArray<BriefingReference>
  readonly harnessUpdates: ReadonlyArray<HarnessUpdate>
}
