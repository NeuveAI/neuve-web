import { defineHook } from "eve/hooks"
import { Effect } from "effect"
export default defineHook({
  events: {
    "turn.completed": async (event, ctx) => {
      await Effect.runPromise(
        Effect.logInfo("Review harness turn completed", {
          sessionId: ctx.session.id,
          eventId: event.meta.id,
        })
      )
    },
    "turn.failed": async (event, ctx) => {
      await Effect.runPromise(
        Effect.logWarning("Review harness turn failed", {
          sessionId: ctx.session.id,
          eventId: event.meta.id,
        })
      )
    },
  },
})
