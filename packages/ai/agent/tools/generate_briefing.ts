import { Effect } from "effect"
import { defineTool } from "eve/tools"
import { z } from "zod"
import { generateBriefing } from "../../src/briefing"
export default defineTool({
  description:
    "Generate and save an advisory contextual briefing from the latest captured Neuve query for this session and revision. Backend verifies source ranges against captured evidence.",
  inputSchema: z.object({
    unitId: z.string().min(1),
    revisionId: z.string().min(1),
  }),
  execute(input, ctx) {
    return Effect.runPromise(
      generateBriefing({
        ...input,
        sessionId: ctx.session.id,
        callId: ctx.callId,
      }),
      { signal: ctx.abortSignal }
    )
  },
})
