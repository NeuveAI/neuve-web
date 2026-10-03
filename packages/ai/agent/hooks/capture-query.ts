import { Effect } from "effect"
import { defineHook } from "eve/hooks"
import { toolResultFrom } from "eve/tools"
import neuve from "../connections/neuve"
import { publishReview } from "../../src/bridge"

export default defineHook({
  events: {
    async "action.result"(event, ctx) {
      const result = toolResultFrom(event.data.result, neuve)
      if (!result || result.connectionToolName !== "neuve_query") return
      try {
        await Effect.runPromise(
          publishReview("captures", {
            captureId: `${ctx.session.id}:${result.callId}`,
            sessionId: ctx.session.id,
            toolCallId: result.callId,
            result: result.output,
          })
        )
      } catch {
        await Effect.runPromise(
          Effect.logError("Neuve query capture failed", {
            sessionId: ctx.session.id,
            callId: result.callId,
          })
        )
        ctx.cancel()
      }
    },
  },
})
