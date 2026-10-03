/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — Comment thread (Threads.dc.html, Main.dc.html)
 *
 *    0ms   thread opens from its pin: opacity 0 → 1, y -4 → 0
 *          (card 220ms, emphasized decelerate)
 *    0ms   a message arrives (yours or the agent's reply): opacity 0 → 1,
 *          y 6 → 0 (message 260ms, emphasized decelerate)
 *    0ms   delivery line swaps text (queued → sent → picked up): crossfade
 *          (reduced 150ms)
 *  loop    working: three dots pulse 0.3 → 1 → 0.3, 180ms apart
 *          (working 1100ms, ease-in-out); steps collapse under "working"
 *    0ms   needs your input / failed: the row rises (message 260ms)
 *  close   thread exits: opacity → 0, y → -4 (cardExit 160ms, accelerate)
 *
 * Reduced motion: opacity-only 150ms; the dots stay still at 60%.
 * ───────────────────────────────────────────────────────── */

import { useAtomValue, useSetAtom } from "jotai"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  CheckIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  GitCommitHorizontalIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import { EASE, REDUCED_TRANSITION, TIMING, ms } from "@workspace/ui/lib/motion"
import { cn } from "@workspace/ui/lib/utils"
import { agentByIdAtom } from "@workspace/ui/neuve/agents/atoms"
import type { ReviewCommentRecord } from "@workspace/ui/neuve/review-comments/record"
import { relativeTime } from "@workspace/ui/neuve/review-comments/thread"
import type {
  ReviewThread,
  ThreadAuthor,
  ThreadMessage,
  ThreadState,
} from "@workspace/ui/neuve/review-comments/thread"
import {
  answerPermissionAtom,
  openStepsAtom,
  retryThreadAtom,
  sendThreadReplyAtom,
  setReplyDraftAtom,
  threadReplyDraftsAtom,
  toggleStepsAtom,
} from "@workspace/ui/neuve/review-comments/threads"

const THREAD = {
  offsetY: -4,
  enter: { duration: ms(TIMING.card), ease: EASE.emphasizedDecelerate },
  exit: { duration: ms(TIMING.cardExit), ease: EASE.emphasizedAccelerate },
} as const

const MESSAGE = {
  offsetY: 6,
  enter: { duration: ms(TIMING.message), ease: EASE.emphasizedDecelerate },
} as const

const DOTS = {
  stagger: 0.18,
  loop: { duration: ms(TIMING.working), ease: "easeInOut" },
} as const

/** Human: a speech bubble with initials. Agent: a rounded square. */
export function MessageAvatar({ author }: { author: ThreadAuthor }) {
  return author.kind === "agent" ? (
    <span
      aria-hidden="true"
      className="inline-flex size-[22px] items-center justify-center rounded-[7px] bg-agt-tint font-mono text-[9.5px] font-semibold text-agt-fg"
    >
      {author.short}
    </span>
  ) : (
    <span
      aria-hidden="true"
      className="inline-flex size-[22px] items-center justify-center rounded-[11px_11px_11px_3px] bg-raised-2 text-[9.5px] font-semibold text-ink-2"
    >
      {author.initials}
    </span>
  )
}

function MessageRow({
  message,
  delivery,
}: {
  message: ThreadMessage
  delivery?: React.ReactNode
}) {
  const reduce = useReducedMotion()
  const name = message.author.name
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: MESSAGE.offsetY }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? REDUCED_TRANSITION : MESSAGE.enter}
      className="grid grid-cols-[22px_minmax(0,1fr)] gap-x-2.5 gap-y-[3px]"
      data-message-author={message.author.kind}
    >
      <MessageAvatar author={message.author} />
      <span className="flex items-baseline gap-2">
        <span className="text-[12.5px] font-semibold">{name}</span>
        <span className="font-mono text-[10.5px] text-ink-muted">
          {relativeTime(message.at)}
        </span>
      </span>
      <span />
      <span className="flex flex-col gap-1.5">
        <span className="text-[12.5px] leading-[18px] whitespace-pre-line text-ink-2">
          {message.body}
        </span>
        {message.chips && message.chips.length > 0 && (
          <span className="flex flex-wrap gap-1.5">
            {message.chips.map((chip) => (
              <span
                key={chip.text}
                className={cn(
                  "rounded-sm px-1.5 py-px font-mono text-[10.5px]",
                  chip.tone === "agt"
                    ? "bg-agt-tint-2 text-agt-ink"
                    : "bg-raised text-ink-2"
                )}
              >
                {chip.text}
              </span>
            ))}
          </span>
        )}
      </span>
      {delivery && (
        <>
          <span />
          {delivery}
        </>
      )}
    </motion.div>
  )
}

function WorkingDots() {
  const reduce = useReducedMotion()
  return (
    <span aria-hidden="true" className="inline-flex gap-[3px]">
      {[0, 1, 2].map((i) =>
        reduce ? (
          <span key={i} className="size-[5px] rounded-full bg-agt-fg/60" />
        ) : (
          <motion.span
            key={i}
            className="size-[5px] rounded-full bg-agt-fg"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{
              ...DOTS.loop,
              repeat: Infinity,
              delay: i * DOTS.stagger,
            }}
          />
        )
      )}
    </span>
  )
}

const DELIVERY: Partial<Record<ThreadState, (agent: string) => string>> = {
  queued: (agent) => `Queued · reaches ${agent} when it’s free`,
  sent: (agent) => `Sent to ${agent}`,
  "picked-up": (agent) => `Picked up by ${agent}`,
}

/** The state row under the latest message: working, needs input, failed. */
function StateRow({
  thread,
  agent,
}: {
  thread: ReviewThread
  agent: { name: string; short: string; agentId: string }
}) {
  const openSteps = useAtomValue(openStepsAtom)
  const toggleSteps = useSetAtom(toggleStepsAtom)
  const answer = useSetAtom(answerPermissionAtom)
  const retry = useSetAtom(retryThreadAtom)
  const reduce = useReducedMotion()
  const author: ThreadAuthor = { kind: "agent", ...agent }
  const rise = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: MESSAGE.offsetY },
    animate: { opacity: 1, y: 0 },
    transition: reduce ? REDUCED_TRANSITION : MESSAGE.enter,
  }
  const steps = thread.steps
  const stepsOpen = openSteps.includes(thread.commentId)

  const stepList =
    steps.length > 0 ? (
      <Collapsible
        open={stepsOpen}
        onOpenChange={() => toggleSteps(thread.commentId)}
      >
        <CollapsibleTrigger className="inline-flex items-center gap-1 rounded-sm border-0 bg-transparent p-0 font-mono text-[10.5px] text-ink-muted hover:text-ink">
          {steps.length} step{steps.length > 1 ? "s" : ""}
          <ChevronDownIcon
            aria-hidden="true"
            className={cn(
              "size-3 transition-transform duration-200 motion-reduce:transition-none",
              stepsOpen && "rotate-180"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ol className="m-0 mt-1 flex list-none flex-col gap-1 p-0">
            {steps.map((step) => (
              <li
                key={step.id}
                className="flex items-start gap-1.5 font-mono text-[10.5px] leading-[15px] text-ink-muted"
              >
                {step.kind === "commit" ? (
                  <GitCommitHorizontalIcon
                    aria-hidden="true"
                    className="mt-px size-3 shrink-0"
                  />
                ) : step.kind === "tool" ? (
                  <WrenchIcon
                    aria-hidden="true"
                    className="mt-px size-3 shrink-0"
                  />
                ) : (
                  <span aria-hidden="true" className="w-3 shrink-0 text-center">
                    ·
                  </span>
                )}
                <span className="wrap-anywhere">{step.text}</span>
              </li>
            ))}
          </ol>
        </CollapsibleContent>
      </Collapsible>
    ) : null

  if (thread.state === "working" || thread.state === "picked-up") {
    if (thread.state === "picked-up" && steps.length === 0) return null
    return (
      <motion.div
        {...rise}
        role="status"
        className="grid grid-cols-[22px_minmax(0,1fr)] items-start gap-x-2.5 gap-y-1"
      >
        <MessageAvatar author={author} />
        <span className="flex min-h-[22px] items-center gap-2 text-[12.5px] text-ink-muted">
          <WorkingDots />
          {agent.name} is working
        </span>
        {stepList && (
          <>
            <span />
            {stepList}
          </>
        )}
      </motion.div>
    )
  }

  if (thread.state === "needs-input" && thread.permission) {
    return (
      <motion.div
        {...rise}
        role="alert"
        className="grid grid-cols-[22px_minmax(0,1fr)] items-start gap-x-2.5 gap-y-1.5"
      >
        <MessageAvatar author={author} />
        <span className="flex min-h-[22px] items-center text-[12.5px] font-semibold">
          Needs your input
        </span>
        <span />
        <div className="flex flex-col gap-2 rounded-lg bg-sug-tint px-2.5 py-2">
          <span className="font-mono text-[11.5px] leading-4 wrap-anywhere text-sug-ink">
            {thread.permission.request}
          </span>
          {thread.permission.detail && (
            <span className="text-xs leading-[17px] text-ink-2">
              {thread.permission.detail}
            </span>
          )}
          <span className="flex gap-1.5">
            <Button
              type="button"
              variant="ink"
              size="xs"
              className="h-7 px-2.5 text-xs font-medium"
              onClick={() => answer(thread.commentId, "allowed")}
            >
              Allow once
            </Button>
            <Button
              type="button"
              variant="quiet"
              size="xs"
              className="h-7 px-2.5 text-xs font-normal"
              onClick={() => answer(thread.commentId, "denied")}
            >
              Deny
            </Button>
          </span>
        </div>
        {stepList && (
          <>
            <span />
            {stepList}
          </>
        )}
      </motion.div>
    )
  }

  if (thread.state === "failed") {
    return (
      <motion.div
        {...rise}
        role="alert"
        className="grid grid-cols-[22px_minmax(0,1fr)] items-start gap-x-2.5 gap-y-1.5"
      >
        <span className="inline-flex size-[22px] items-center justify-center text-req-fg">
          <CircleAlertIcon aria-hidden="true" className="size-4" />
        </span>
        <span className="text-[12.5px] leading-[18px] text-req-fg">
          {thread.failure ?? `Couldn’t reach ${agent.name}.`}
        </span>
        <span />
        <Button
          type="button"
          variant="raised"
          size="xs"
          className="h-7 justify-self-start px-2.5 text-xs font-normal"
          onClick={() => retry(thread.commentId)}
        >
          Retry
        </Button>
      </motion.div>
    )
  }
  return null
}

/**
 * A comment shown in place while "Show comments" is on: author, lines, two
 * lines of the comment and where its thread stands. It does not isolate the
 * margin; clicking it opens the thread (which does).
 */
export function CommentPreviewCard({
  record,
  rangeLabel,
  thread,
  onOpen,
}: {
  record: ReviewCommentRecord
  rangeLabel: string
  thread: ReviewThread | undefined
  onOpen: () => void
}) {
  const reduce = useReducedMotion()
  const replies = thread?.messages.length ?? 0
  const status: Record<ThreadState, string> = {
    queued: "queued",
    sent: "sent",
    "picked-up": "picked up",
    working: "working",
    replied: replies > 0 ? "replied" : "",
    "needs-input": "needs your input",
    failed: "failed",
  }
  const state = thread ? status[thread.state] : ""
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      aria-label={`Open thread on ${rangeLabel}: ${record.author.name}: ${record.body}`}
      data-comment-preview=""
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: THREAD.offsetY }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: REDUCED_TRANSITION }}
      transition={reduce ? REDUCED_TRANSITION : THREAD.enter}
      className="box-border flex w-full flex-col gap-1.5 rounded-[10px] border-0 bg-surface px-3 py-2.5 text-left font-sans text-ink shadow-card transition-colors duration-120 hover:bg-raised motion-reduce:transition-none"
    >
      <span className="flex w-full items-center gap-2 text-xs leading-4">
        <MessageAvatar author={{ kind: "human", ...record.author }} />
        <span className="min-w-0 flex-auto truncate font-semibold">
          {record.author.name}
        </span>
        <span className="shrink-0 font-mono text-[10.5px] text-ink-muted">
          {rangeLabel}
        </span>
      </span>
      <span className="line-clamp-2 text-[12.5px] leading-[18px] text-ink-2">
        {record.body}
      </span>
      {(replies > 0 || state) && (
        <span className="font-mono text-[10.5px] text-ink-muted">
          {replies} repl{replies === 1 ? "y" : "ies"}
          {state ? ` · ${state}` : ""}
        </span>
      )}
    </motion.button>
  )
}

/**
 * An open review comment as a thread with the agent that owns the unit:
 * the comment, the replies (human bubbles, agent squares), where the latest
 * message is (queued → sent → picked up), the agent working (narration and
 * tool calls collapsed into steps), a permission request (Allow once /
 * Deny), a failure (Retry), and the reply box once the agent has replied.
 */
export function ThreadCard({
  record,
  rangeLabel,
  thread,
  fallbackAgentId,
  reviewer,
  onDismiss,
  onToggleStatus,
  sticky = true,
  className,
}: {
  record: ReviewCommentRecord
  rangeLabel: string
  thread: ReviewThread | undefined
  /** Off in component stories that render the thread on its own. */
  sticky?: boolean
  /** The unit's agent when the comment has no thread yet. */
  fallbackAgentId?: string
  reviewer: { id: string; name: string; initials: string }
  onDismiss: () => void
  onToggleStatus: () => void
  className?: string
}) {
  const agents = useAtomValue(agentByIdAtom)
  const drafts = useAtomValue(threadReplyDraftsAtom)
  const setDraft = useSetAtom(setReplyDraftAtom)
  const send = useSetAtom(sendThreadReplyAtom)
  const reduce = useReducedMotion()
  const agentId = thread?.agentId ?? fallbackAgentId
  const known = agentId ? agents[agentId] : undefined
  const agent = {
    agentId: agentId ?? "agent",
    name: known?.name ?? "the implementer",
    short: known?.short ?? "AI",
  }
  const first: ThreadMessage = {
    id: `${record.id}:comment`,
    author: { kind: "human", ...record.author },
    body: record.body,
    at: record.createdAt,
  }
  const messages = [first, ...(thread?.messages ?? [])]
  const state = thread?.state ?? "replied"
  const lastHuman = [...messages]
    .reverse()
    .find((message) => message.author.kind === "human")
  const deliveryText = DELIVERY[state]?.(agent.name)
  const draft = drafts[record.id] ?? ""
  const canReply = agentId !== undefined && (state === "replied" || !thread)
  const resolved = record.status === "resolved"
  const replyId = `reply-${record.id}`

  return (
    <motion.article
      aria-label={`Comment thread on ${rangeLabel}`}
      data-thread-state={state}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: THREAD.offsetY }}
      animate={{ opacity: 1, y: 0 }}
      exit={
        reduce
          ? { opacity: 0, transition: REDUCED_TRANSITION }
          : { opacity: 0, y: THREAD.offsetY, transition: THREAD.exit }
      }
      transition={reduce ? REDUCED_TRANSITION : THREAD.enter}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation()
          onDismiss()
        }
      }}
      data-thread-card=""
      className={cn(
        "box-border flex w-full flex-col overflow-x-hidden rounded-xl bg-surface font-sans text-ink shadow-card",
        sticky &&
          "sticky top-4 mt-1.5 max-h-[calc(100vh-32px)] overflow-y-auto overscroll-contain",
        className
      )}
    >
      {/* Title over its range and count, so neither is ever cut off in a
          260px margin. */}
      <div className="flex items-center gap-1.5 border-b border-line-2 py-2 pr-2 pl-3.5">
        <span className="flex min-w-0 flex-auto flex-col">
          <span className="text-[13px] leading-[17px] font-semibold">
            Thread
          </span>
          <span
            data-thread-count=""
            className="font-mono text-[10.5px] leading-[15px] whitespace-nowrap text-ink-muted"
          >
            {rangeLabel} · {messages.length} message
            {messages.length === 1 ? "" : "s"}
          </span>
        </span>
        <Button
          type="button"
          variant="quiet"
          size="xs"
          onClick={onToggleStatus}
          aria-pressed={resolved}
          className="h-[26px] px-1.5 text-xs font-normal"
        >
          {resolved ? (
            <>
              <CheckIcon aria-hidden="true" />
              Reopen
            </>
          ) : (
            "Resolve"
          )}
        </Button>
        <Button
          type="button"
          variant="quiet"
          size="icon-xs"
          aria-label="Close thread"
          onClick={onDismiss}
          className="size-[26px]"
        >
          <XIcon aria-hidden="true" className="size-[11px]" />
        </Button>
      </div>
      <div className="flex flex-col gap-3 px-3.5 py-3">
        {record.status === "resolved" && (
          <span className="font-mono text-[10.5px] text-ink-muted">
            Resolved · kept for later cycles
          </span>
        )}
        {messages.map((message) => (
          <MessageRow
            key={message.id}
            message={message}
            delivery={
              message === lastHuman && deliveryText ? (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={state}
                    role="status"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={REDUCED_TRANSITION}
                    className="font-mono text-[10.5px] text-ink-muted"
                  >
                    {deliveryText}
                  </motion.span>
                </AnimatePresence>
              ) : undefined
            }
          />
        ))}
        {thread && <StateRow thread={thread} agent={agent} />}
      </div>
      {canReply && (
        <form
          className="flex items-end gap-2 border-t border-line-2 px-2.5 pt-2 pb-2.5"
          onSubmit={(event) => {
            event.preventDefault()
            if (agentId)
              send({ commentId: record.id, agentId, author: reviewer })
          }}
        >
          <label htmlFor={replyId} className="sr-only">
            Reply
          </label>
          <textarea
            id={replyId}
            rows={1}
            value={draft}
            onChange={(event) => setDraft(record.id, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                event.stopPropagation()
                event.currentTarget.form?.requestSubmit()
              }
            }}
            placeholder={`Reply to ${agent.short}…`}
            aria-keyshortcuts="Meta+Enter"
            className="min-h-8 flex-auto resize-none rounded-lg border-0 bg-raised px-[9px] py-[7px] text-[12.5px] leading-[18px] text-ink outline-none placeholder:text-ink-muted focus-visible:shadow-[inset_0_0_0_1px_var(--nv-focus)]"
          />
          <Button
            type="submit"
            variant="ink"
            size="compact"
            disabled={draft.trim() === ""}
            className="h-8 font-medium disabled:bg-raised-2 disabled:text-ink-muted disabled:opacity-100"
          >
            Send
          </Button>
        </form>
      )}
    </motion.article>
  )
}
