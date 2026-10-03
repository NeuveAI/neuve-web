import { toolJsonSchema } from "../../src/schema"
import { DispositionCommand } from "@workspace/backend/domain"
import { Effect, Schema } from "effect"
import { defineTool } from "eve/tools"
import { publishReview } from "../../src/bridge"
export default defineTool({
  description:
    "Record this agent's revision-bound disposition. Human-required units cannot receive agent approval.",
  inputSchema: toolJsonSchema(DispositionCommand),
  execute: (input, ctx) =>
    Effect.runPromise(publishReview("dispositions", input), {
      signal: ctx.abortSignal,
    }),
})
