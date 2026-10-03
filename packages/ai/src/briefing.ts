import { briefingInstructions } from "./prompts/briefing"
import { Briefing, QueryReceipt } from "@workspace/storage/domain"
import { generateText, Output } from "ai"
import { Effect, Schema } from "effect"
import { z } from "zod"
import { createGeminiModel } from "./model"
import { publishReview, readBackend } from "./bridge"
import { HarnessConfigurationError, ModelUnavailableError } from "./errors"

const GeneratedBriefing = Schema.Struct({
  title: Briefing.fields.title,
  segments: Briefing.fields.segments,
  citations: Briefing.fields.citations,
  limitations: Briefing.fields.limitations,
})
const Captures = z.array(
  z.object({
    captureId: z.string(),
    sessionId: z.string(),
    toolCallId: z.string(),
    result: QueryReceipt,
  })
)
export function generateBriefing(input: {
  sessionId: string
  callId: string
  unitId: string
  revisionId: string
}) {
  return Effect.gen(function* () {
    const briefingId = `${input.sessionId}:${input.callId}`
    const existing = yield* readBackend(
      `briefings?briefingId=${encodeURIComponent(briefingId)}`
    )
    if (existing !== null) {
      const saved = yield* Schema.decodeUnknownEffect(Briefing)(existing).pipe(
        Effect.mapError(
          () =>
            new HarnessConfigurationError({
              setting: "saved briefing",
              message: "Backend returned an invalid saved briefing.",
            })
        )
      )
      if (
        saved.unitId !== input.unitId ||
        saved.revisionId !== input.revisionId
      )
        return yield* new HarnessConfigurationError({
          setting: "saved briefing",
          message:
            "Replay identity conflicts with the requested review unit or revision.",
        })
      return saved
    }
    const raw = yield* readBackend(
      `captures?sessionId=${encodeURIComponent(input.sessionId)}`
    )
    const parsed = Captures.safeParse(raw)
    if (!parsed.success)
      return yield* new HarnessConfigurationError({
        setting: "captured evidence",
        message: "Backend returned invalid captured query records.",
      })
    const capture = parsed.data.find(
      (value) =>
        value.result.source.revision === input.revisionId &&
        value.sessionId === input.sessionId
    )
    if (!capture)
      return yield* new HarnessConfigurationError({
        setting: "captured evidence",
        message: "Query the submitted revision before generating its briefing.",
      })
    const model = yield* createGeminiModel()
    const result = yield* Effect.tryPromise({
      try: (signal) =>
        generateText({
          model,
          abortSignal: signal,
          maxRetries: 0,
          maxOutputTokens: 2500,
          output: Output.object({
            schema: {
              "~standard": {
                ...Schema.toStandardSchemaV1(GeneratedBriefing)["~standard"],
                ...Schema.toStandardJSONSchemaV1(GeneratedBriefing)[
                  "~standard"
                ],
              },
            },
          }),
          system: briefingInstructions,
          prompt: JSON.stringify({
            unitId: input.unitId,
            capturedQuery: capture.result,
          }),
        }),
      catch: () =>
        new ModelUnavailableError({
          message: "Gemini briefing generation failed.",
        }),
    })
    const output = yield* Effect.try({
      try: () => result.output,
      catch: () =>
        new ModelUnavailableError({
          message: "Gemini returned no structured briefing.",
        }),
    })
    const content = yield* Schema.decodeUnknownEffect(GeneratedBriefing)(
      output
    ).pipe(
      Effect.mapError(
        () =>
          new ModelUnavailableError({
            message: "Generated briefing failed schema validation.",
          })
      )
    )
    const saved = yield* publishReview("briefings", {
      ...content,
      briefingId,
      captureId: capture.captureId,
      unitId: input.unitId,
      revisionId: input.revisionId,
    })
    return yield* Schema.decodeUnknownEffect(Briefing)(saved).pipe(
      Effect.mapError(
        () =>
          new HarnessConfigurationError({
            setting: "saved briefing",
            message: "Backend returned an invalid saved briefing.",
          })
      )
    )
  })
}
