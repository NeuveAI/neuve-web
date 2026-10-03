import type {
  ThreadEvent,
  ThreadEventSource,
} from "@workspace/ui/neuve/review-comments/thread"

/**
 * A scripted stand-in for the ACP relay, for stories and local demos. It
 * makes no real ACP calls: each script is a list of events with the delay
 * (ms) since the previous one.
 */
export interface ScriptStep {
  after: number
  event: ThreadEvent
}

export interface MockThreadRelayOptions {
  /** Played as soon as the desk subscribes. */
  autoplay?: ReadonlyArray<ScriptStep>
  /** Played when the reviewer sends a reply (or a new comment). */
  onReply?: (commentId: string) => ReadonlyArray<ScriptStep>
  /** Played after "Allow once" / "Deny". */
  onPermission?: (
    commentId: string,
    outcome: "allowed" | "denied"
  ) => ReadonlyArray<ScriptStep>
  /** Played after Retry. */
  onRetry?: (commentId: string) => ReadonlyArray<ScriptStep>
}

export function createMockThreadRelay(
  options: MockThreadRelayOptions = {}
): ThreadEventSource {
  const listeners = new Set<(event: ThreadEvent) => void>()
  const timers = new Set<ReturnType<typeof setTimeout>>()

  function play(script: ReadonlyArray<ScriptStep>) {
    let delay = 0
    for (const step of script) {
      delay += step.after
      const timer = setTimeout(() => {
        timers.delete(timer)
        for (const listener of listeners) listener(step.event)
      }, delay)
      timers.add(timer)
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      if (listeners.size === 1 && options.autoplay) play(options.autoplay)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          for (const timer of timers) clearTimeout(timer)
          timers.clear()
        }
      }
    },
    send(command) {
      if (command.type === "reply" && options.onReply) {
        play(options.onReply(command.commentId))
      } else if (command.type === "permission" && options.onPermission) {
        play(options.onPermission(command.commentId, command.outcome))
      } else if (command.type === "retry" && options.onRetry) {
        play(options.onRetry(command.commentId))
      }
    },
  }
}
