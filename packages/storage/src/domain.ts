import { Schema } from "effect"
import { z } from "zod"

const line = z.number().int().positive()
const range = z
  .object({
    kind: z.literal("range"),
    path: z.string().min(1),
    start_line: line,
    end_line: line,
  })
  .passthrough()
  .refine((value) => value.end_line >= value.start_line)
const candidate = z
  .object({
    kind: z.enum(["region", "symbol", "partial_symbol"]),
    language: z.string().nullable(),
    source: range,
    contained_callables: z
      .object({ status: z.enum(["unavailable", "complete", "truncated"]) })
      .passthrough(),
  })
  .passthrough()
export const QueryReceipt = z
  .object({
    schema_version: z.literal(2),
    provider: z
      .object({
        name: z.literal("entire-graph"),
        version: z.string(),
        identity_revision: z.string(),
        capabilities: z
          .object({
            schema_version: z.string(),
            languages: z
              .object({
                supported: z.array(z.string()),
                semantic: z.array(z.string()),
                inventory_only: z.array(z.string()),
                unsupported_detected_hints: z.array(z.string()),
              })
              .passthrough(),
          })
          .passthrough(),
      })
      .passthrough(),
    query: z.string(),
    source: z
      .object({
        repository: z.string().min(1),
        revision: z.string().regex(/^[a-f0-9]{40,64}$/i),
      })
      .strict(),
    retrieval: z.discriminatedUnion("status", [
      z.object({ status: z.literal("error"), error: z.string() }).passthrough(),
      z
        .object({
          status: z.literal("ok"),
          coverage: z.string(),
          contained_callable_coverage: z.enum([
            "unavailable",
            "complete",
            "truncated",
          ]),
          candidates: z.array(candidate),
          warnings: z.array(z.unknown()),
          partial_failures: z.array(z.unknown()),
          limitations: z.array(z.unknown()),
          budget: z.record(z.string(), z.union([z.number(), z.boolean()])),
        })
        .passthrough(),
    ]),
    source_evidence: z
      .array(
        z
          .object({
            path: z.string().min(1),
            start_line: line,
            end_line: line,
            text: z.string(),
            blob_oid: z.string().regex(/^[a-f0-9]{40,64}$/i),
            revision: z.string().regex(/^[a-f0-9]{40,64}$/i),
          })
          .strict()
      )
      .optional(),
    source_evidence_limitations: z
      .array(
        z
          .object({
            path: z.string(),
            start_line: line,
            end_line: line,
            reason: z.string(),
          })
          .passthrough()
      )
      .optional(),
    source_evidence_budget: z
      .object({
        requested_bytes: z.number().int().nonnegative(),
        returned_bytes: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
    structural_observations: z.array(
      z
        .object({
          request_id: z.string(),
          status: z.enum(["ok", "error", "unavailable"]),
        })
        .passthrough()
    ),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    const candidates =
      value.retrieval.status === "ok" ? value.retrieval.candidates : []
    for (const evidence of value.source_evidence ?? []) {
      if (
        evidence.revision !== value.source.revision ||
        evidence.end_line < evidence.start_line ||
        !candidates.some(
          (candidate) =>
            candidate.source.path === evidence.path &&
            candidate.source.start_line <= evidence.start_line &&
            candidate.source.end_line >= evidence.end_line
        )
      )
        ctx.addIssue({
          code: "custom",
          message:
            "Pinned source evidence must match the receipt revision and candidate range",
        })
    }
  })
export type QueryReceipt = z.infer<typeof QueryReceipt>
export type CapturedQuery = {
  readonly captureId: string
  readonly sessionId: string
  readonly toolCallId: string
  readonly result: QueryReceipt
}
export const BriefingCitation = Schema.Struct({
  citationId: Schema.NonEmptyString,
  path: Schema.NonEmptyString,
  startLine: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
  endLine: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
  explanation: Schema.NonEmptyString,
})
export type BriefingCitation = typeof BriefingCitation.Type
export const Briefing = Schema.Struct({
  briefingId: Schema.NonEmptyString,
  captureId: Schema.NonEmptyString,
  unitId: Schema.NonEmptyString,
  revisionId: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
  segments: Schema.Array(
    Schema.Union([
      Schema.Struct({
        kind: Schema.Literal("text"),
        text: Schema.NonEmptyString,
      }),
      Schema.Struct({
        kind: Schema.Literal("cite"),
        label: Schema.NonEmptyString,
        citationId: Schema.NonEmptyString,
      }),
    ])
  ),
  citations: Schema.Array(BriefingCitation),
  limitations: Schema.Array(Schema.NonEmptyString),
})
export type Briefing = typeof Briefing.Type
