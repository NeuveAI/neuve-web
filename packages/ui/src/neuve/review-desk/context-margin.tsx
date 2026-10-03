/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — Context margin overlay (L0 → L1 → L2)
 *
 * Everything here is slotted into the diff's overlay layer
 * (@workspace/diffs, annotationLayout: 'overlay'): the layer positions it,
 * the code rows never move.
 *
 *    0ms   pin hover/focus — tone shift (surfaceTone 120ms, CSS)
 *    0ms   shared hint fades in, y -2 → 0 (hint 140ms, iOS ease-out)
 *    0ms   pin click — press compress .97 (pressIn 80ms, CSS)
 *    0ms   other overlay items dim to 35% (dimOthers 160ms, layer CSS)
 *    0ms   card / composer enters: opacity 0 → 1, y -4 → 0, scale .98 → 1
 *          (card 220ms, emphasized decelerate, origin top-left)
 *    0ms   comment body opens: opacity 0 → 1, y -4 → 0 (card 220ms)
 *  close   card and comment body exit: opacity → 0, y → -4
 *          (cardExit 160ms, accelerate); items below slide up (layer, 200ms)
 *
 * Commenting (gutter → chip → composer → pin):
 *    0ms   lines selected — "Comment · L20–23" chip at the last line:
 *          opacity 0 → 1, scale .96 → 1 (snappy spring 400/30, origin left)
 *    0ms   chip / Enter / C — composer at the first line (card 220ms)
 *  save    composer collapses toward the pin row: opacity → 0, scale → .9,
 *          origin top-left (cardExit 160ms, accelerate); the new pin enters
 *          scale .96 → 1 (snappy)
 *
 * Reduced motion: opacity-only 150ms tweens; tone and dimming stay; the
 * layer drops its slide.
 * ───────────────────────────────────────────────────────── */

import * as React from "react"
import { motion, useReducedMotion } from "motion/react"
import {
  CheckIcon,
  ChevronRightIcon,
  MessageSquarePlusIcon,
  PencilLineIcon,
  XIcon,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  EASE,
  REDUCED_TRANSITION,
  SPRING,
  TIMING,
  ms,
} from "@workspace/ui/lib/motion"
import { cn } from "@workspace/ui/lib/utils"
import type { ReviewCommentStatus } from "@workspace/ui/neuve/review-comments/record"
import type { ContextualMarker, MarkerTone } from "@workspace/ui/neuve/types"

const CARD = {
  offsetY: -4, // px the card rises from
  initialScale: 0.98, // scale before landing
  enter: { duration: ms(TIMING.card), ease: EASE.emphasizedDecelerate },
  exit: { duration: ms(TIMING.cardExit), ease: EASE.emphasizedAccelerate },
} as const

const HINT = {
  offsetY: -2, // px the hint drops from
  transition: { duration: ms(TIMING.hint), ease: EASE.iosOut },
} as const

/** Shared enter/exit for everything that floats in the overlay. */
function useFloatMotion(withScale: boolean) {
  const reduce = useReducedMotion()
  return {
    initial: reduce
      ? { opacity: 0 }
      : withScale
        ? { opacity: 0, y: CARD.offsetY, scale: CARD.initialScale }
        : { opacity: 0, y: CARD.offsetY },
    animate: withScale ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: 0 },
    exit: reduce
      ? { opacity: 0, transition: REDUCED_TRANSITION }
      : { opacity: 0, y: CARD.offsetY, transition: CARD.exit },
    transition: reduce ? REDUCED_TRANSITION : CARD.enter,
  } as const
}

const PIN_TONE: Record<MarkerTone, { pin: string; dot: string }> = {
  doc: { pin: "bg-raised text-ink-2 hover:bg-raised-2", dot: "bg-faint" },
  graph: { pin: "bg-raised text-ink-2 hover:bg-raised-2", dot: "bg-faint" },
  history: { pin: "bg-raised text-ink-2 hover:bg-raised-2", dot: "bg-faint" },
  conflict: {
    pin: "bg-req-tint text-req-ink hover:bg-req-tint-2",
    dot: "rotate-45 bg-req",
  },
  batch: {
    pin: "bg-transparent text-ink-muted shadow-[inset_0_0_0_1px_var(--nv-line)] hover:bg-raised",
    dot: "rounded-[3px] bg-transparent shadow-[inset_0_0_0_1.5px_var(--nv-faint)]",
  },
  test: { pin: "bg-sug-tint text-sug-ink hover:bg-sug-tint-2", dot: "bg-sug" },
  // Review comments are not retrieved context: a pill with a speech glyph
  // and the author's initials, never a source-tone tint.
  // A speech-bubble avatar: the author's initials, tail at bottom-left.
  comment: {
    pin: "size-[22px] justify-center rounded-[11px_11px_11px_3px] bg-raised-2 px-0 font-sans text-[10px] font-semibold tracking-[0.02em] text-ink-2 hover:bg-ink hover:text-paper",
    dot: "",
  },
}

const BADGE_VARIANT = {
  neutral: "marker-neutral",
  req: "marker-req",
  sug: "marker-sug",
  batch: "marker-batch",
} as const

/* ── L0 pin ────────────────────────────────────────────── */

export function MarginPin({
  marker,
  rangeLabel,
  on,
  disabled,
  onToggle,
  onHintStart,
  onHintEnd,
  className,
  ...rest
}: {
  marker: ContextualMarker
  /** Review comments: the lines they are about, e.g. "L20–23". */
  rangeLabel?: string
  /** Its card is open (or, for a comment, its body is open). */
  on: boolean
  disabled: boolean
  onToggle: () => void
  onHintStart: () => void
  onHintEnd: () => void
  className?: string
  "data-anchor"?: string
  "data-marker-key"?: string
}) {
  const tone = PIN_TONE[marker.tone]
  const isComment = marker.sourceKind === "review comment"
  const inverted = on
  const reduce = useReducedMotion()
  return (
    <motion.button
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={reduce ? REDUCED_TRANSITION : SPRING.snappy}
      type="button"
      aria-expanded={on}
      aria-label={
        isComment
          ? `Review comment by ${marker.title.replace(/ commented$/, "")}${rangeLabel ? ` on ${rangeLabel}` : ""}: ${marker.peek}`
          : `${marker.short}: ${marker.peek}`
      }
      tabIndex={disabled ? -1 : 0}
      onClick={onToggle}
      onMouseEnter={onHintStart}
      onFocus={(event) => {
        // Focus returned to the pin after a pointer dismiss is not a request
        // for the hint; only keyboard focus (focus-visible) shows it.
        if (event.currentTarget.matches(":focus-visible")) onHintStart()
      }}
      onMouseLeave={onHintEnd}
      onBlur={onHintEnd}
      className={cn(
        "relative inline-flex h-[22px] items-center gap-1.5 rounded-md border-0 px-2 font-mono text-[11px]",
        "transition-[background-color,transform] duration-120 ease-[cubic-bezier(.2,0,0,1)] active:scale-[.97] motion-reduce:transition-none motion-reduce:active:scale-100",
        inverted ? "bg-ink text-paper shadow-none" : tone.pin,
        disabled && "pointer-events-none",
        className
      )}
      {...rest}
    >
      {!isComment && (
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 rounded-[2px]",
            inverted ? "rotate-0 bg-paper shadow-none" : tone.dot
          )}
        />
      )}
      {marker.short}
    </motion.button>
  )
}

/* ── Commit point: the selection's chip ────────────────── */

/**
 * "Comment · L20–23", on the selection's last line. Click, Enter or C opens
 * the composer; Escape (handled by the desk) clears the selection.
 */
export function SelectionChip({
  label,
  onOpen,
}: {
  label: string
  onOpen: () => void
}) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      type="button"
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, transition: REDUCED_TRANSITION }}
      transition={reduce ? REDUCED_TRANSITION : SPRING.snappy}
      style={{ transformOrigin: "left center" }}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (
          (event.key === "c" || event.key === "C") &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.altKey
        ) {
          event.preventDefault()
          onOpen()
        }
      }}
      aria-keyshortcuts="Enter C"
      aria-label={`Comment on ${label}`}
      className="inline-flex h-[22px] items-center gap-1.5 rounded-full border-0 bg-ink px-2.5 font-sans text-[11.5px] text-paper transition-[background-color] duration-120 ease-[cubic-bezier(.2,0,0,1)] hover:bg-ink/90 motion-reduce:transition-none"
    >
      <MessageSquarePlusIcon aria-hidden="true" className="size-3" />
      Comment
      <span aria-hidden="true" className="font-mono text-[11px] text-paper/70">
        · {label}
      </span>
    </motion.button>
  )
}

/* ── Draft set aside with Escape ───────────────────────── */

export function DraftPin({
  label,
  excerpt,
  disabled,
  onOpen,
}: {
  label: string
  excerpt: string
  disabled: boolean
  onOpen: () => void
}) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      type="button"
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={reduce ? REDUCED_TRANSITION : SPRING.snappy}
      onClick={onOpen}
      tabIndex={disabled ? -1 : 0}
      aria-label={`Draft comment on ${label}: ${excerpt}`}
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 rounded-full border-0 bg-transparent px-2 font-mono text-[11px] text-ink-2 shadow-[inset_0_0_0_1px_var(--nv-line)]",
        "transition-[background-color] duration-120 ease-[cubic-bezier(.2,0,0,1)] hover:bg-raised motion-reduce:transition-none",
        disabled && "pointer-events-none"
      )}
    >
      <PencilLineIcon aria-hidden="true" className="size-3 text-ink-muted" />
      Draft
      <span className="text-ink-muted">{label}</span>
    </motion.button>
  )
}

/* ── L2 card ───────────────────────────────────────────── */

export function ContextCard({
  marker,
  onClose,
  onOpenSource,
  className,
}: {
  marker: ContextualMarker
  onClose: () => void
  onOpenSource: () => void
  className?: string
}) {
  const float = useFloatMotion(true)
  return (
    <motion.div
      role="region"
      aria-label={marker.title}
      {...float}
      style={{ transformOrigin: "top left" }}
      className={cn(
        "box-border flex w-[300px] flex-col gap-2.5 rounded-xl bg-surface px-4 pt-3.5 pb-3 font-sans text-sm text-ink shadow-card",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Badge variant={BADGE_VARIANT[marker.badgeTone]}>{marker.badge}</Badge>
        <span className="flex-auto" />
        <Button
          type="button"
          variant="quiet"
          size="icon-card"
          aria-label="Close context"
          onClick={onClose}
        >
          <XIcon aria-hidden="true" className="size-3" />
        </Button>
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="text-[13.5px] leading-[18px] font-semibold">
          {marker.title}
        </div>
        <div className="font-mono text-[11px] leading-[15px] text-ink-muted">
          {marker.meta}
        </div>
      </div>
      <div className="rounded-lg bg-paper px-2.5 py-2 text-[12.5px] leading-[18px] whitespace-pre-line">
        {marker.quote}
      </div>
      {marker.quoteAgainst && (
        <div className="rounded-lg bg-req-tint px-2.5 py-2 text-[12.5px] leading-[18px] whitespace-pre-line">
          {marker.quoteAgainst}
        </div>
      )}
      <dl className="m-0 grid grid-cols-[76px_minmax(0,1fr)] gap-x-2.5 gap-y-1.5 text-xs leading-[17px]">
        <dt className="text-ink-muted">Establishes</dt>
        <dd className="m-0">{marker.establishes}</dd>
        <dt className="text-ink-muted">Applies here</dt>
        <dd className="m-0">{marker.applies}</dd>
        <dt className="text-ink-muted">Uncertain</dt>
        <dd className="m-0 text-req-fg">{marker.uncertain}</dd>
      </dl>
      <div className="flex items-center gap-2 pt-0.5">
        <Button
          type="button"
          variant="ink"
          size="compact"
          onClick={onOpenSource}
          aria-haspopup="dialog"
          data-source-trigger=""
        >
          Open source
          <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
        </Button>
        <span className="text-[11.5px] text-ink-muted">{marker.cited}</span>
      </div>
    </motion.div>
  )
}

/* ── Open comment body (dismissible) ───────────────────── */

export function CommentBody({
  marker,
  status,
  onDismiss,
  onToggleStatus,
  className,
}: {
  marker: ContextualMarker
  status: ReviewCommentStatus
  onDismiss: () => void
  onToggleStatus: () => void
  className?: string
}) {
  const float = useFloatMotion(false)
  const author = marker.title.replace(/ commented$/, "")
  return (
    <motion.article
      aria-label={`Review comment by ${author}`}
      {...float}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation()
          onDismiss()
        }
      }}
      className={cn(
        "box-border flex w-full flex-col gap-1.5 rounded-[10px] bg-surface px-3 pt-2 pb-2.5 font-sans text-ink shadow-card",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-flex size-5 items-center justify-center rounded-full bg-raised font-mono text-[10px] text-ink-2"
        >
          {marker.short}
        </span>
        <span className="min-w-0 truncate text-xs font-medium">{author}</span>
        {marker.trace?.carriedForward && (
          <span className="font-mono text-[10.5px] text-ink-muted">
            earlier revision
          </span>
        )}
        <span className="flex-auto" />
        <Button
          type="button"
          variant="quiet"
          size="icon-xs"
          aria-label="Dismiss comment"
          onClick={onDismiss}
          className="size-6"
        >
          <XIcon aria-hidden="true" className="size-3" />
        </Button>
      </div>
      <p
        className={cn(
          "m-0 line-clamp-3 text-[12.5px] leading-[18px] whitespace-pre-line",
          status === "resolved" && "text-ink-muted"
        )}
      >
        {marker.quote}
      </p>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-auto truncate font-mono text-[10.5px] text-ink-muted">
          {marker.meta.split(" · ").slice(1).join(" · ")}
        </span>
        <Button
          type="button"
          variant="quiet"
          size="xs"
          onClick={onToggleStatus}
          aria-pressed={status === "resolved"}
          className="h-6 px-1.5 text-[11.5px] font-normal"
        >
          {status === "resolved" ? (
            <>
              <CheckIcon aria-hidden="true" />
              Resolved
            </>
          ) : (
            "Resolve"
          )}
        </Button>
      </div>
    </motion.article>
  )
}

/* ── Inline comment composer (the expanded layer) ──────── */

const COMPOSER_EXIT = {
  // Collapses toward the pin row (top-left of its overlay item).
  scale: 0.9,
  transition: {
    duration: ms(TIMING.cardExit),
    ease: EASE.emphasizedAccelerate,
  },
} as const

/**
 * The composer for the selected lines. No line picker: the anchor is the
 * gutter selection, shown as a quiet label, and dragging in the gutter
 * re-targets it live. Escape with an empty draft cancels; with text, the
 * draft is set aside as a "Draft" pin.
 */
export function CommentComposer({
  anchorLabel,
  placeholder,
  draft,
  onDraft,
  onSave,
  onCancel,
  onEscape,
}: {
  /** e.g. "revoke.ts · lines 20–23" (non-interactive). */
  anchorLabel: string
  placeholder: string
  draft: string
  onDraft: (value: string) => void
  onSave: () => void
  onCancel: () => void
  onEscape: () => void
}) {
  const reduce = useReducedMotion()
  const id = React.useId()
  const empty = draft.trim() === ""
  // The layer places (un-hides) a new item on its next frame, so retry for a
  // few frames until the textarea can take focus.
  const focusOnMount = React.useCallback(
    (element: HTMLTextAreaElement | null) => {
      if (!element) return
      let frame = 0
      let attempts = 0
      const tryFocus = () => {
        element.focus({ preventScroll: true })
        if (
          element.ownerDocument.activeElement !== element &&
          attempts++ < 60
        ) {
          frame = requestAnimationFrame(tryFocus)
        }
      }
      frame = requestAnimationFrame(tryFocus)
      return () => cancelAnimationFrame(frame)
    },
    []
  )
  return (
    <motion.div
      role="dialog"
      aria-label={`New review comment, ${anchorLabel}`}
      initial={
        reduce
          ? { opacity: 0 }
          : { opacity: 0, y: CARD.offsetY, scale: CARD.initialScale }
      }
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={
        reduce
          ? { opacity: 0, transition: REDUCED_TRANSITION }
          : { opacity: 0, ...COMPOSER_EXIT }
      }
      transition={reduce ? REDUCED_TRANSITION : CARD.enter}
      style={{ transformOrigin: "top left" }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation()
          onEscape()
        }
      }}
      className="box-border flex w-full flex-col gap-2 rounded-xl bg-surface px-3 pt-2.5 pb-3 font-sans text-ink shadow-card"
    >
      <p
        id={`${id}-anchor`}
        className="m-0 truncate font-mono text-[11px] leading-4 text-ink-muted"
      >
        {anchorLabel}
      </p>
      <label htmlFor={`${id}-body`} className="sr-only">
        Comment
      </label>
      <textarea
        id={`${id}-body`}
        rows={3}
        ref={focusOnMount}
        value={draft}
        onChange={(event) => onDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            // Keep ⌘↵ from reaching the desk's approve shortcut.
            event.preventDefault()
            event.stopPropagation()
            if (!empty) onSave()
          }
        }}
        placeholder={placeholder}
        aria-describedby={`${id}-anchor`}
        aria-keyshortcuts="Meta+Enter"
        className="min-h-[68px] w-full resize-y rounded-lg border-0 bg-raised px-2.5 py-2 text-[12.5px] leading-[18px] text-ink outline-none placeholder:text-ink-muted focus-visible:shadow-[inset_0_0_0_1px_var(--nv-focus)]"
      />
      <div className="flex items-center justify-end gap-1.5">
        <Button type="button" variant="quiet" size="compact" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="ink"
          size="compact"
          onClick={onSave}
          disabled={empty}
          aria-keyshortcuts="Meta+Enter"
          // Disabled reads as "waiting for text": a quiet raised tone in our
          // palette, not a faded slab.
          className="disabled:bg-raised-2 disabled:text-ink-muted disabled:opacity-100"
        >
          Comment
          <span className="font-mono text-[10.5px] opacity-70">⌘↵</span>
        </Button>
      </div>
    </motion.div>
  )
}

/* ── L1 shared hint (one per file, placed by the layer) ── */

export interface CommentPreview {
  author: string
  initials: string
  /** "L20–23" */
  range?: string
}

export function HintBubble({
  text,
  comment,
}: {
  text: string
  /** Review comments preview as a small card, not a dark tooltip. */
  comment?: CommentPreview
}) {
  const reduce = useReducedMotion()
  const motionProps = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: HINT.offsetY },
    animate: { opacity: 1, y: 0 },
    transition: reduce ? REDUCED_TRANSITION : HINT.transition,
  }
  if (comment) {
    return (
      <motion.div
        aria-hidden="true"
        {...motionProps}
        className="pointer-events-none flex w-[248px] flex-col gap-1.5 rounded-[10px] bg-surface px-3 py-2.5 text-left font-sans shadow-card"
      >
        <span className="flex items-center gap-2 text-[12px] leading-4">
          <span className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-[9px_9px_9px_2px] bg-raised-2 text-[9px] font-semibold text-ink-2">
            {comment.initials}
          </span>
          <span className="truncate font-semibold text-ink">
            {comment.author}
          </span>
          {comment.range && (
            <span className="ml-auto shrink-0 font-mono text-[10.5px] text-ink-muted">
              {comment.range}
            </span>
          )}
        </span>
        <span className="line-clamp-2 text-[12.5px] leading-[18px] text-ink-2">
          {text}
        </span>
      </motion.div>
    )
  }
  return (
    <motion.div
      aria-hidden="true"
      {...motionProps}
      className="pointer-events-none w-[232px] rounded-lg bg-peek px-2.5 py-2 text-left font-sans text-xs leading-[17px] text-peek-fg shadow-peek"
    >
      {text}
    </motion.div>
  )
}
