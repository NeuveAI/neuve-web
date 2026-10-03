import { toolJsonSchema } from "../../src/schema"
import { ReviewUnit } from "@workspace/backend/domain"
import { Effect, Schema } from "effect"
import { defineTool } from "eve/tools"
import { publishReview } from "../../src/bridge"
const Batch = Schema.Struct({
  revisionId: Schema.NonEmptyString,
  units: Schema.Array(
    Schema.Struct({
      unitId: ReviewUnit.fields.unitId,
      revisionId: ReviewUnit.fields.revisionId,
      title: ReviewUnit.fields.title,
      hunkIds: ReviewUnit.fields.hunkIds,
    })
  ),
})
export default defineTool({
  description:
    "Propose review units grouped from the submitted revision's supplied hunk identities.",
  inputSchema: toolJsonSchema(Batch),
  execute: (input, ctx) =>
    Effect.runPromise(publishReview("units", input), {
      signal: ctx.abortSignal,
    }),
})
