import { defineAgent, defineDynamic } from "eve"
import { Effect } from "effect"
import { createGeminiModel } from "../src/model"

export default defineAgent({
  defaultTools: false,
  model: defineDynamic({
    events: { "step.started": () => Effect.runPromise(createGeminiModel()) },
  }),
  limits: {
    maxInputTokensPerSession: 200_000,
    maxOutputTokensPerSession: 20_000,
  },
})
