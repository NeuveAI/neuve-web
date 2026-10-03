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
 * Round 2:
 *  rest    a pin shared with other units carries one 4px dot per unit
 *          (max 3, currentColor 50%); no width growth, no raised edge
 *    0ms   pointing at / opening it tone-shifts the linked rail units
 *          (linked 160ms, rail storyboard)
 *  open    the L2 card sticks at top 16px while the file scrolls, capped
 *          at the viewport (scrolls inside itself, never sideways)
 *    0ms   graph tree path tooltip fades in on real hover / focus-visible
 *          (hint 140ms, iOS ease-out), wrapped inside the card
 *
 * Reduced motion: opacity-only 150ms tweens; tone and dimming stay; the
 * layer drops its slide.
 * ───────────────────────────────────────────────────────── */

import * as React from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { motion, useReducedMotion } from "motion/react"
import {
  ArrowRightIcon,
  CircleDashedIcon,
  FileTextIcon,
  FlaskConicalIcon,
  HistoryIcon,
  MessageSquarePlusIcon,
  PencilLineIcon,
  SplitIcon,
  WaypointsIcon,
  XIcon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  EASE,
  REDUCED_TRANSITION,
  SPRING,
  TIMING,
  ms,
} from "@workspace/ui/lib/motion"
import { cn } from "@workspace/ui/lib/utils"
import { HighlightedCode } from "@workspace/ui/neuve/shared/highlighted-code"
import { NeuveLink } from "@workspace/ui/neuve/shared/nav-link"
import { editorHref } from "@workspace/ui/neuve/shared/editor-links"
import { treeTipAtom } from "@workspace/ui/neuve/review-desk/atoms"
import type {
  ContextualMarker,
  MarkerCheckAction,
  MarkerExcerpt,
  MarkerTone,
  ReadByNode,
} from "@workspace/ui/neuve/types"

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

/* ── L0 pin ────────────────────────────────────────────── */

export function MarginPin({
  marker,
  rangeLabel,
  on,
  disabled,
  readOnly = false,
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
  /** A read-only neighbor's own context: muted outline pin. */
  readOnly?: boolean
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
  // Shared with other units: one small dot per other unit (max 3), in the
  // pin's own colour at 50%. No width growth, no raised edge.
  const shared = marker.sharedWith?.length ?? 0
  const sharedLabel =
    shared > 0 ? ` · also in ${shared} other unit${shared > 1 ? "s" : ""}` : ""
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
          : `${marker.short}: ${marker.peek}${sharedLabel}`
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
      data-shared={shared > 0 ? shared : undefined}
      className={cn(
        "relative inline-flex h-[22px] items-center gap-1.5 rounded-md border-0 px-2 font-mono text-[11px]",
        "transition-[background-color,transform] duration-120 ease-[cubic-bezier(.2,0,0,1)] active:scale-[.97] motion-reduce:transition-none motion-reduce:active:scale-100",
        inverted
          ? "bg-ink text-paper shadow-none"
          : readOnly
            ? "bg-transparent text-ink-muted shadow-[inset_0_0_0_1px_var(--nv-line)] hover:bg-raised"
            : tone.pin,
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
            inverted
              ? "rotate-0 bg-paper shadow-none"
              : readOnly
                ? "bg-faint"
                : tone.dot
          )}
        />
      )}
      {marker.short}
      {shared > 0 && !isComment && (
        <span aria-hidden="true" className="ml-px inline-flex gap-0.5">
          {Array.from({ length: Math.min(shared, 3) }, (_, i) => (
            <i key={i} className="size-1 rounded-full bg-current opacity-50" />
          ))}
        </span>
      )}
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

/** Kind icon tile and label colour per source kind (Main.dc.html KIND). */
const KIND: Record<
  Exclude<MarkerTone, "comment">,
  { icon: LucideIcon; tile: string; label: string }
> = {
  doc: {
    icon: FileTextIcon,
    tile: "bg-raised text-ink-2",
    label: "text-ink-2",
  },
  graph: {
    icon: WaypointsIcon,
    tile: "bg-raised text-ink-2",
    label: "text-ink-2",
  },
  conflict: {
    icon: SplitIcon,
    tile: "bg-req-tint text-req-ink",
    label: "text-req-ink",
  },
  batch: {
    icon: CircleDashedIcon,
    tile: "bg-transparent text-ink-muted shadow-[inset_0_0_0_1px_var(--nv-line)]",
    label: "text-ink-muted",
  },
  test: {
    icon: FlaskConicalIcon,
    tile: "bg-sug-tint text-sug-ink",
    label: "text-sug-ink",
  },
  history: {
    icon: HistoryIcon,
    tile: "bg-raised text-ink-2",
    label: "text-ink-2",
  },
}

/** A pill-like quiet action ("Open source →", the callout's action). */
const QUIET_ACTION =
  "inline-flex h-7 flex-none items-center gap-1.5 rounded-[7px] border-0 px-[9px] text-xs whitespace-nowrap text-ink no-underline transition-colors duration-120 hover:text-ink motion-reduce:transition-none"

/**
 * Graph read-by tree: plain mono rows with `├`/`└` branches and the file on
 * the right; an untraced edge says "not traced" in red. A truncated file
 * shows its full `path:line` in a tooltip on real hover or keyboard focus,
 * wrapped and kept inside the card.
 */
function ReadByTree({
  markerKey,
  nodes,
}: {
  markerKey: string
  nodes: ReadonlyArray<ReadByNode>
}) {
  const tip = useAtomValue(treeTipAtom)
  const setTip = useSetAtom(treeTipAtom)
  const reduce = useReducedMotion()
  return (
    <div
      role="list"
      aria-label="Read by"
      className="flex flex-col font-mono text-[11.5px] leading-[22px]"
    >
      {nodes.map((node, i) => {
        const id = `${markerKey}:${i}`
        const show = () => {
          if (node.fullPath) setTip(id)
        }
        const hide = () =>
          setTip((current) => (current === id ? null : current))
        return (
          <div
            key={id}
            role="listitem"
            data-tree-row={i}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") show()
            }}
            onPointerLeave={hide}
            className="relative flex min-w-0 items-baseline gap-1.5"
          >
            {tip === id && node.fullPath && (
              <motion.span
                role="tooltip"
                id={`${id}:tip`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { duration: ms(TIMING.hint), ease: EASE.iosOut }
                }
                className="pointer-events-none absolute right-0 bottom-[calc(100%+2px)] z-3 box-border w-max max-w-full rounded-md bg-peek px-2 py-1 text-[11px] leading-4 break-all whitespace-normal text-peek-fg"
              >
                {node.fullPath}
              </motion.span>
            )}
            <span aria-hidden="true" className="whitespace-pre text-faint">
              {node.prefix}
            </span>
            <span
              className={cn(
                "whitespace-nowrap",
                node.tone === "root" && "text-ink-muted",
                node.tone === "node" && "text-ink",
                node.tone === "untraced" && "text-req-fg"
              )}
            >
              {node.name}
            </span>
            <span className="flex-auto" />
            {node.where && (
              <span
                tabIndex={node.fullPath ? 0 : undefined}
                aria-label={node.fullPath}
                aria-describedby={tip === id ? `${id}:tip` : undefined}
                onFocus={(event) => {
                  if (event.currentTarget.matches(":focus-visible")) show()
                }}
                onBlur={hide}
                className={cn(
                  "min-w-0 truncate rounded-[3px] text-[10.5px]",
                  node.tone === "untraced" ? "text-req-fg" : "text-ink-muted"
                )}
              >
                {node.where}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Excerpt({
  markerKey,
  excerpt,
}: {
  markerKey: string
  excerpt: MarkerExcerpt
}) {
  switch (excerpt.kind) {
    case "tree":
      return <ReadByTree markerKey={markerKey} nodes={excerpt.nodes} />
    case "versus":
      return (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-1.5">
          <div className="flex flex-col gap-1 rounded-lg bg-paper px-[9px] py-2">
            <span className="font-mono text-[10px] text-ink-muted">
              {excerpt.a.source}
            </span>
            <span className="text-xs leading-4">{excerpt.a.text}</span>
          </div>
          <span className="self-center font-mono text-[10px] text-faint">
            vs
          </span>
          <div className="flex flex-col gap-1 rounded-lg bg-req-tint px-[9px] py-2">
            <span className="font-mono text-[10px] text-req-ink">
              {excerpt.b.source}
            </span>
            <span className="text-xs leading-4">{excerpt.b.text}</span>
          </div>
        </div>
      )
    case "code":
      return (
        <div className="rounded-lg bg-paper px-2.5 py-2 font-mono text-[11.5px] leading-[18px] wrap-anywhere whitespace-pre-wrap">
          <HighlightedCode code={excerpt.code} />
        </div>
      )
    case "quote":
      return (
        <div className="grid grid-cols-[14px_minmax(0,1fr)] gap-1.5">
          <span
            aria-hidden="true"
            className="font-serif text-[26px] leading-[22px] text-faint"
          >
            “
          </span>
          <span className="text-[12.5px] leading-[18px] text-ink">
            {excerpt.text}
          </span>
        </div>
      )
  }
}

/** The callout's single action. */
function CheckActionButton({
  action,
  onAction,
}: {
  action: MarkerCheckAction
  onAction: (action: MarkerCheckAction) => void
}) {
  const className = cn(
    QUIET_ACTION,
    "self-start bg-surface shadow-[0_0_0_1px_var(--nv-line)] hover:bg-raised"
  )
  const icon = (
    <ArrowRightIcon aria-hidden="true" className="size-3" strokeWidth={1.9} />
  )
  if (action.kind === "unit") {
    return (
      <NeuveLink
        destination={{ to: "unit", unitId: action.unitId }}
        className={className}
      >
        {action.label}
        {icon}
      </NeuveLink>
    )
  }
  if (action.kind === "file") {
    return (
      <a href={editorHref("VS Code", action.path)} className={className}>
        {action.label}
        {icon}
      </a>
    )
  }
  return (
    <button
      type="button"
      className={className}
      onClick={() => onAction(action)}
    >
      {action.label}
      {icon}
    </button>
  )
}

/**
 * L2 card, restyled per source kind: kind icon tile and one kind label that
 * already carries status, title + mono meta, the kind-specific excerpt,
 * why it's here, the "Before you decide" callout with one action, and a
 * quiet "Open source →". It sticks at the top of the viewport while the
 * file scrolls, capped at the viewport height, and never scrolls sideways.
 */
export function ContextCard({
  marker,
  onClose,
  onOpenSource,
  onCheckAction = () => {},
  sticky = true,
  className,
}: {
  marker: ContextualMarker
  onClose: () => void
  onOpenSource: () => void
  onCheckAction?: (action: MarkerCheckAction) => void
  /** Off in component stories that render the card on its own. */
  sticky?: boolean
  className?: string
}) {
  const float = useFloatMotion(true)
  const kind = KIND[marker.tone === "comment" ? "doc" : marker.tone]
  const Icon = kind.icon
  return (
    <motion.div
      role="region"
      aria-label={marker.title}
      data-context-card=""
      {...float}
      style={{ transformOrigin: "top left" }}
      className={cn(
        "box-border flex w-full flex-col overflow-x-hidden rounded-xl bg-surface pb-0 font-sans text-sm text-ink shadow-card",
        sticky &&
          "sticky top-4 mt-1.5 max-h-[calc(100vh-32px)] overflow-y-auto overscroll-contain",
        className
      )}
    >
      <div className="flex items-center gap-2 pt-3 pr-2.5 pl-3.5">
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex size-[22px] shrink-0 items-center justify-center rounded-md",
            kind.tile
          )}
        >
          <Icon className="size-[13px]" strokeWidth={1.8} />
        </span>
        <span
          className={cn(
            "min-w-0 flex-auto truncate label-mono text-[10.5px]",
            kind.label
          )}
        >
          {marker.kindLabel}
        </span>
        <Button
          type="button"
          variant="quiet"
          size="icon-card"
          aria-label="Close context"
          onClick={onClose}
          className="size-[26px]"
        >
          <XIcon aria-hidden="true" className="size-[11px]" />
        </Button>
      </div>
      <div className="flex flex-col gap-0.5 px-3.5 pt-2.5">
        <span className="text-sm leading-[19px] font-semibold tracking-[-0.01em] wrap-anywhere">
          {marker.title}
        </span>
        <span className="font-mono text-[10.5px] wrap-anywhere text-ink-muted">
          {marker.meta}
        </span>
      </div>
      {marker.excerpt && (
        <div className="px-3.5 pt-3">
          <Excerpt markerKey={marker.key} excerpt={marker.excerpt} />
        </div>
      )}
      <p className="m-0 mx-3.5 mt-3 text-[12.5px] leading-[18px] text-ink-2">
        {marker.applies}
      </p>
      {marker.check && (
        <div className="mx-3.5 mt-3 flex flex-col gap-2 rounded-lg bg-raised py-2.5 pr-2.5 pl-3">
          <span className="label-mono text-[10px]">Before you decide</span>
          <span className="text-[12.5px] leading-[18px] text-ink">
            {marker.check}
          </span>
          {marker.checkAction && (
            <CheckActionButton
              action={marker.checkAction}
              onAction={onCheckAction}
            />
          )}
        </div>
      )}
      <div className="mt-3 flex justify-end px-2.5 pt-2 pb-2.5">
        <button
          type="button"
          onClick={onOpenSource}
          aria-haspopup="dialog"
          data-source-trigger=""
          className={cn(QUIET_ACTION, "bg-raised hover:bg-raised-2")}
        >
          Open source
          <ArrowRightIcon
            aria-hidden="true"
            className="size-3"
            strokeWidth={1.9}
          />
        </button>
      </div>
    </motion.div>
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
