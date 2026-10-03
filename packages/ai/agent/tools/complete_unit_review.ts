import { CompleteUnitReview } from "@workspace/backend/domain"
import { Effect } from "effect"
import { defineTool } from "eve/tools"
import { publishReview } from "../../src/bridge"
import { toolJsonSchema } from "../../src/schema"
export default defineTool({
  description:
    "Record completed automated advisory review of a unit using its stored cited briefing. This does not approve human-required work or advance the human gate.",
  inputSchema: toolJsonSchema(CompleteUnitReview),
  execute: (input, ctx) =>
    Effect.runPromise(publishReview("complete-unit-review", input), {
      signal: ctx.abortSignal,
    }),
})
