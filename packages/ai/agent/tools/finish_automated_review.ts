import { FinishAutomatedReview } from "@workspace/backend/domain"
import { Effect } from "effect"
import { defineTool } from "eve/tools"
import { publishReview } from "../../src/bridge"
import { toolJsonSchema } from "../../src/schema"
export default defineTool({
  description:
    "Ask the backend to validate automated review completion for the submitted revision. Registered hunk coverage, advisory completions and agent dispositions must satisfy the gate. Outstanding change requests return work to the inner development loop.",
  inputSchema: toolJsonSchema(FinishAutomatedReview),
  execute: (input, ctx) =>
    Effect.runPromise(publishReview("finish-review", input), {
      signal: ctx.abortSignal,
    }),
})
