import { atom } from "jotai"

import {
  appendHumanReply,
  applyThreadEvent,
  emptyThread,
} from "@workspace/ui/neuve/review-comments/thread"
import type {
  ReviewThread,
  ThreadEvent,
  ThreadEventSource,
  ThreadMessage,
} from "@workspace/ui/neuve/review-comments/thread"

/**
 * Thread state for the review desk (jotai). The screen hydrates the threads
 * it was given and, when a relay is present, applies its events in order.
 */

/** Threads by comment record id. */
export const reviewThreadsAtom = atom<Record<string, ReviewThread>>({})

/** The relay the desk listens to and sends replies through (null: offline). */
export const threadEventSourceAtom = atom<ThreadEventSource | null>(null)

/** Unsent reply text per thread. */
export const threadReplyDraftsAtom = atom<Record<string, string>>({})

/** Expanded "working" step lists, by comment id. */
export const openStepsAtom = atom<ReadonlyArray<string>>([])

export const applyThreadEventAtom = atom(
  null,
  (get, set, event: ThreadEvent) => {
    const threads = get(reviewThreadsAtom)
    const thread = threads[event.commentId]
    if (!thread) return
    set(reviewThreadsAtom, {
      ...threads,
      [event.commentId]: applyThreadEvent(thread, event),
    })
  }
)

export const setReplyDraftAtom = atom(
  null,
  (get, set, commentId: string, text: string) => {
    set(threadReplyDraftsAtom, {
      ...get(threadReplyDraftsAtom),
      [commentId]: text,
    })
  }
)

function messageId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `tm_${Date.now().toString(36)}_${random}`
}

export interface SendReplyInput {
  commentId: string
  agentId: string
  author: { id: string; name: string; initials: string }
}

/** Send the reply draft: it joins the thread queued and goes to the relay. */
export const sendThreadReplyAtom = atom(
  null,
  (get, set, input: SendReplyInput) => {
    const body = (get(threadReplyDraftsAtom)[input.commentId] ?? "").trim()
    if (!body) return
    const message: ThreadMessage = {
      id: messageId(),
      author: { kind: "human", ...input.author },
      body,
      at: new Date().toISOString(),
    }
    const threads = get(reviewThreadsAtom)
    const thread =
      threads[input.commentId] ?? emptyThread(input.commentId, input.agentId)
    set(reviewThreadsAtom, {
      ...threads,
      [input.commentId]: appendHumanReply(thread, message),
    })
    set(setReplyDraftAtom, input.commentId, "")
    get(threadEventSourceAtom)?.send?.({
      type: "reply",
      commentId: input.commentId,
      message,
    })
  }
)

/** A new review comment opens a thread with the unit's agent, queued. */
export const openThreadAtom = atom(
  null,
  (get, set, commentId: string, agentId: string, message: ThreadMessage) => {
    const threads = get(reviewThreadsAtom)
    if (threads[commentId]) return
    set(reviewThreadsAtom, {
      ...threads,
      [commentId]: { ...emptyThread(commentId, agentId), state: "queued" },
    })
    get(threadEventSourceAtom)?.send?.({ type: "reply", commentId, message })
  }
)

/** "Allow once" / "Deny" on a permission request. */
export const answerPermissionAtom = atom(
  null,
  (get, set, commentId: string, outcome: "allowed" | "denied") => {
    const thread = get(reviewThreadsAtom)[commentId]
    const requestId = thread?.permission?.id
    if (!requestId) return
    set(applyThreadEventAtom, {
      type: "permission-resolved",
      commentId,
      requestId,
      outcome,
    })
    get(threadEventSourceAtom)?.send?.({
      type: "permission",
      commentId,
      requestId,
      outcome,
    })
  }
)

/** Retry a failed delivery. */
export const retryThreadAtom = atom(null, (get, set, commentId: string) => {
  set(applyThreadEventAtom, { type: "queued", commentId })
  get(threadEventSourceAtom)?.send?.({ type: "retry", commentId })
})

export const toggleStepsAtom = atom(null, (get, set, commentId: string) => {
  const open = get(openStepsAtom)
  set(
    openStepsAtom,
    open.includes(commentId)
      ? open.filter((id) => id !== commentId)
      : [...open, commentId]
  )
})

export function threadsHydration(
  threads: ReadonlyArray<ReviewThread> | undefined,
  source: ThreadEventSource | undefined
) {
  const byId: Record<string, ReviewThread> = {}
  for (const thread of threads ?? []) byId[thread.commentId] = thread
  return [
    [reviewThreadsAtom, byId],
    [threadEventSourceAtom, source ?? null],
  ] as const
}
