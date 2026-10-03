/**
 * Review comment threads: the comment, the replies, and where the latest
 * message is on its way to the agent.
 *
 * A saved review comment opens a thread with the agent that owns the unit
 * (the implementer, a working label that vocabulary.md does not define yet).
 * The relay (ACP through the harness) reports progress as events; there are
 * no read receipts in ACP, so "picked up" (the agent's turn started) is the
 * closest signal to "read".
 *
 *   queued ─▶ sent ─▶ picked up ─▶ working ─▶ replied
 *                                    │  ▲
 *                                    ▼  │ Allow once / Deny
 *                               needs your input
 *   any state before replied ─▶ failed (Retry → queued)
 *
 * Only the agent's final reply becomes a message. Narration and tool calls
 * collapse under "working" as steps. A commit made inside the agent's inner
 * loop is thread activity (a step, then a chip on the reply), never a new
 * review cycle.
 */

export type ThreadState =
  | "queued"
  | "sent"
  | "picked-up"
  | "working"
  | "replied"
  | "needs-input"
  | "failed"

export type ThreadAuthor =
  | { kind: "human"; id: string; name: string; initials: string }
  | { kind: "agent"; agentId: string; name: string; short: string }

export interface ThreadMessage {
  id: string
  author: ThreadAuthor
  body: string
  /** ISO-8601. */
  at: string
  /** Chips on an agent reply, e.g. the commit it made and "+1 test". */
  chips?: Array<{ text: string; tone: "neutral" | "agt" }>
}

export interface ThreadStep {
  id: string
  kind: "narration" | "tool" | "commit"
  text: string
}

export interface PermissionRequest {
  id: string
  /** One plain sentence: what the agent wants to do. */
  request: string
  detail?: string
}

export interface ReviewThread {
  commentId: string
  /** The agent the thread routes to (the unit's owner). */
  agentId: string
  state: ThreadState
  /** Replies after the comment itself (the record holds the first message). */
  messages: Array<ThreadMessage>
  /** The current turn's narration and tool calls, collapsed under "working". */
  steps: Array<ThreadStep>
  permission?: PermissionRequest
  failure?: string
}

/** Events from the relay (and the reviewer's own actions), in order. */
export type ThreadEvent =
  | { type: "queued"; commentId: string }
  | { type: "sent"; commentId: string }
  | { type: "picked-up"; commentId: string }
  | { type: "narration"; commentId: string; stepId: string; text: string }
  | { type: "tool-call"; commentId: string; stepId: string; text: string }
  | {
      type: "commit"
      commentId: string
      stepId: string
      commit: string
      text: string
    }
  | {
      type: "permission-requested"
      commentId: string
      permission: PermissionRequest
    }
  | {
      type: "permission-resolved"
      commentId: string
      requestId: string
      outcome: "allowed" | "denied"
    }
  | { type: "replied"; commentId: string; message: ThreadMessage }
  | { type: "failed"; commentId: string; reason: string }

export function emptyThread(commentId: string, agentId: string): ReviewThread {
  return { commentId, agentId, state: "replied", messages: [], steps: [] }
}

/** Pure reducer: one event applied to one thread. */
export function applyThreadEvent(
  thread: ReviewThread,
  event: ThreadEvent
): ReviewThread {
  switch (event.type) {
    case "queued":
      return {
        ...thread,
        state: "queued",
        steps: [],
        failure: undefined,
        permission: undefined,
      }
    case "sent":
      return { ...thread, state: "sent" }
    case "picked-up":
      return { ...thread, state: "picked-up" }
    case "narration":
    case "tool-call":
      return {
        ...thread,
        state: thread.state === "needs-input" ? thread.state : "working",
        steps: [
          ...thread.steps,
          {
            id: event.stepId,
            kind: event.type === "narration" ? "narration" : "tool",
            text: event.text,
          },
        ],
      }
    case "commit":
      return {
        ...thread,
        state: "working",
        steps: [
          ...thread.steps,
          {
            id: event.stepId,
            kind: "commit",
            text: `${event.commit} · ${event.text}`,
          },
        ],
      }
    case "permission-requested":
      return { ...thread, state: "needs-input", permission: event.permission }
    case "permission-resolved":
      if (thread.permission?.id !== event.requestId) return thread
      return {
        ...thread,
        state: "working",
        permission: undefined,
        steps: [
          ...thread.steps,
          {
            id: `${event.requestId}:${event.outcome}`,
            kind: "narration",
            text:
              event.outcome === "allowed"
                ? `You allowed: ${thread.permission.request}`
                : `You denied: ${thread.permission.request}`,
          },
        ],
      }
    case "replied":
      return {
        ...thread,
        state: "replied",
        messages: [...thread.messages, event.message],
        permission: undefined,
        failure: undefined,
      }
    case "failed":
      return {
        ...thread,
        state: "failed",
        failure: event.reason,
        permission: undefined,
      }
  }
}

/** The reviewer replied: the message joins the thread and is queued. */
export function appendHumanReply(
  thread: ReviewThread,
  message: ThreadMessage
): ReviewThread {
  return {
    ...thread,
    state: "queued",
    messages: [...thread.messages, message],
    steps: [],
    failure: undefined,
    permission: undefined,
  }
}

/**
 * The relay boundary. Today a mock (stories) or nothing; later the BFF's
 * ACP relay. `subscribe` delivers events; `send` hands it a reviewer reply
 * or a permission answer.
 */
export interface ThreadEventSource {
  subscribe: (listener: (event: ThreadEvent) => void) => () => void
  send?: (
    command:
      | { type: "reply"; commentId: string; message: ThreadMessage }
      | {
          type: "permission"
          commentId: string
          requestId: string
          outcome: "allowed" | "denied"
        }
      | { type: "retry"; commentId: string }
  ) => void
}

/** "now", "4 min", "2 h", "Oct 2". */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const at = new Date(iso)
  const minutes = Math.round((now.getTime() - at.getTime()) / 60000)
  if (Number.isNaN(minutes)) return iso
  if (minutes < 1) return "now"
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h`
  return at.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
