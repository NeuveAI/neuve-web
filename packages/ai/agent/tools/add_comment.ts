import { toolJsonSchema } from "../../src/schema"
import { CommentCommand } from "@workspace/backend/domain"
import { Effect, Schema } from "effect"
import { defineTool } from "eve/tools"
import { publishReview } from "../../src/bridge"
export default defineTool({
  description:
    "Record a revision-bound comment. Request-changes comments create a disposition; informational comments do not. Backend owns ACP delivery.",
  inputSchema: toolJsonSchema(CommentCommand),
  execute: (input, ctx) =>
    Effect.runPromise(publishReview("comments", input), {
      signal: ctx.abortSignal,
    }),
})
