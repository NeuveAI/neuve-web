/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — Decision dock
 *
 *    0ms   rest dock rises: opacity 0 → 1, y 8 → 0, scale .98 → 1
 *          (dockRise 240ms, emphasized decelerate, origin bottom)
 *    0ms   button press compresses (pressIn 80ms, CSS)
 *  swap    current state leaves first (dockExit 120ms, accelerate),
 *          then the next state rises (AnimatePresence mode="wait")
 *          rest → composer · composer → decided · decided → rest (undo)
 *
 * Reduced motion: each swap is a 150ms opacity crossfade.
 * ───────────────────────────────────────────────────────── */

import * as React from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ChevronRightIcon, XIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { EASE, REDUCED_TRANSITION, TIMING, ms } from "@workspace/ui/lib/motion"
import { cn } from "@workspace/ui/lib/utils"
import { LaneGlyph } from "@workspace/ui/neuve/shared/lane-glyph"
import {
  approveAtom,
  attachmentAtom,
  detachAtom,
  dockAtom,
  draftAtom,
  resetDockAtom,
  sendChangesAtom,
  startChangesAtom,
} from "@workspace/ui/neuve/review-desk/atoms"
import type {
  ContextualMarker,
  ReviewDeskData,
} from "@workspace/ui/neuve/types"

const DOCK = {
  offsetY: 8, // px each state rises from
  initialScale: 0.98,
  enter: { duration: ms(TIMING.dockRise), ease: EASE.emphasizedDecelerate },
  exit: { duration: ms(TIMING.dockExit), ease: EASE.emphasizedAccelerate },
} as const

const SHORTCUT = "⌘↵"

function DockMotion({
  children,
  className,
  ...rest
}: React.ComponentProps<typeof motion.div>) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={
        reduce
          ? { opacity: 0 }
          : { opacity: 0, y: DOCK.offsetY, scale: DOCK.initialScale }
      }
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, transition: reduce ? REDUCED_TRANSITION : DOCK.exit }}
      transition={reduce ? REDUCED_TRANSITION : DOCK.enter}
      style={{ transformOrigin: "bottom center" }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

const DOCK_BAR =
  "flex items-center gap-1.5 rounded-[14px] bg-dock py-1.5 pr-1.5 pl-3.5 text-dock-fg shadow-dock"

/** Rest: decision scope + Request changes / Approve. */
function DockRest({ unit }: { unit: ReviewDeskData["unit"] }) {
  const startChanges = useSetAtom(startChangesAtom)
  const approve = useSetAtom(approveAtom)
  return (
    <DockMotion key="rest" className={cn(DOCK_BAR, "flex-wrap")}>
      <span
        tabIndex={0}
        aria-describedby="dock-scope-note"
        className="group/scope relative inline-flex items-center gap-2 pr-2 text-[13px] text-dock-muted"
      >
        <LaneGlyph lane={unit.lane} />
        Covers {unit.hunkCount} hunks
        <span
          id="dock-scope-note"
          role="tooltip"
          className="pointer-events-none absolute bottom-[34px] -left-2 z-2 w-[232px] translate-y-[-2px] rounded-lg bg-peek px-2.5 py-2 text-left font-sans text-xs leading-[17px] whitespace-normal text-peek-fg opacity-0 transition-[opacity,transform] duration-140 ease-[cubic-bezier(.33,1,.68,1)] group-focus-within/scope:translate-y-0 group-focus-within/scope:opacity-100 group-hover/scope:translate-y-0 group-hover/scope:opacity-100 motion-reduce:translate-y-0 motion-reduce:transition-none"
        >
          {unit.scopeNote}
        </span>
      </span>
      <span aria-hidden="true" className="h-5 w-px bg-dock-line" />
      <Button
        type="button"
        variant="dock-ghost"
        size="dock"
        onClick={() => startChanges(unit.defaultAttachment)}
      >
        Request changes
      </Button>
      <Button
        type="button"
        variant="dock-primary"
        size="dock"
        onClick={approve}
        aria-keyshortcuts="Meta+Enter"
      >
        Approve
        <span className="font-mono text-[11px] opacity-70">{SHORTCUT}</span>
      </Button>
    </DockMotion>
  )
}

/** Composer: draft suggestion, comment, attached context, send. */
function DockComposer({
  unit,
  markers,
}: {
  unit: ReviewDeskData["unit"]
  markers: Record<string, ContextualMarker>
}) {
  const draft = useAtomValue(draftAtom)
  const setDraft = useSetAtom(draftAtom)
  const attachment = useAtomValue(attachmentAtom)
  const detach = useSetAtom(detachAtom)
  const cancel = useSetAtom(resetDockAtom)
  const send = useSetAtom(sendChangesAtom)
  const attached = attachment ? markers[attachment] : undefined

  return (
    <DockMotion
      key="composing"
      role="dialog"
      aria-label="Request changes"
      className="box-border flex w-[min(620px,calc(100vw-64px))] flex-col gap-3 rounded-[14px] bg-surface px-4 py-3.5 shadow-dock"
    >
      <div className="flex items-center gap-2.5">
        <span className="text-sm font-semibold">Request changes</span>
        <span className="font-mono text-[11px] text-ink-muted">
          {unit.hunkCount} hunks
        </span>
        <span className="flex-auto" />
        <Button
          type="button"
          variant="quiet"
          size="icon-card"
          aria-label="Cancel"
          onClick={cancel}
        >
          <XIcon aria-hidden="true" className="size-3" />
        </Button>
      </div>
      {draft === "" && (
        <button
          type="button"
          onClick={() => setDraft(unit.draftSuggestion)}
          className="flex items-start gap-2.5 rounded-[10px] border-0 bg-paper px-3 py-2.5 text-left transition-colors duration-120 hover:bg-raised motion-reduce:transition-none"
        >
          <span className="rounded-sm bg-sug-tint px-1.5 py-0.5 font-mono text-[10.5px] whitespace-nowrap text-sug-ink">
            Draft
          </span>
          <span className="flex-auto text-[13px] leading-[19px] text-ink-2">
            {unit.draftSuggestion}
          </span>
          <span className="text-[12.5px] whitespace-nowrap text-ink-muted">
            Use ↵
          </span>
        </button>
      )}
      <label htmlFor="dock-comment" className="sr-only">
        What needs to change
      </label>
      <Textarea
        id="dock-comment"
        rows={3}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="What needs to change?"
        aria-keyshortcuts="Meta+Enter"
        className="min-h-[76px] resize-y rounded-[10px] border-0 bg-raised p-3 text-sm leading-[21px] text-ink shadow-none focus-visible:ring-0 md:text-sm dark:bg-raised"
      />
      <div className="flex flex-wrap items-center gap-2">
        {attached && (
          <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-raised pr-1 pl-2.5 font-mono text-[11.5px] text-ink-2">
            {attached.short} attached
            <Button
              type="button"
              variant="quiet"
              size="icon-xs"
              aria-label="Remove attached context"
              onClick={detach}
              className="size-[22px]"
            >
              <XIcon aria-hidden="true" className="size-[9px]" />
            </Button>
          </span>
        )}
        <span className="flex-auto" />
        <Button
          type="button"
          variant="quiet"
          size="dock"
          className="px-3 font-normal"
          onClick={cancel}
        >
          Cancel
        </Button>
        <Button type="button" variant="ink" size="dock" onClick={send}>
          Send to implementer
          <span className="font-mono text-[11px] opacity-70">{SHORTCUT}</span>
        </Button>
      </div>
    </DockMotion>
  )
}

/** Decided: the disposition with Undo and Next unit. */
function DockDecided({ unit }: { unit: ReviewDeskData["unit"] }) {
  const dock = useAtomValue(dockAtom)
  const undo = useSetAtom(resetDockAtom)
  const text =
    dock === "approved"
      ? `Approved · ${unit.hunkCount} hunks`
      : "Changes requested · sent to implementer"
  return (
    <DockMotion key="decided" role="status" className={cn(DOCK_BAR, "gap-2.5")}>
      <span className="text-[13.5px] font-medium">{text}</span>
      <Button type="button" variant="dock-ghost" size="dock" onClick={undo}>
        Undo
      </Button>
      <Button type="button" variant="dock-primary" size="dock">
        Next unit
        <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
      </Button>
    </DockMotion>
  )
}

/**
 * Sticky decision dock at the bottom of the unit. It is the only place a
 * disposition is made, and it states its scope: this unit's human-required
 * hunks, never the read-only neighbor.
 */
export function DecisionDock({
  unit,
  markers,
}: {
  unit: ReviewDeskData["unit"]
  markers: Record<string, ContextualMarker>
}) {
  const dock = useAtomValue(dockAtom)
  return (
    <div className="sticky bottom-5 z-10 mx-8 mt-auto mb-5 max-w-[calc(100%-64px)] self-center">
      <AnimatePresence mode="wait">
        {dock === "rest" && <DockRest key="rest" unit={unit} />}
        {dock === "composing" && (
          <DockComposer key="composing" unit={unit} markers={markers} />
        )}
        {(dock === "approved" || dock === "changes-requested") && (
          <DockDecided key="decided" unit={unit} />
        )}
      </AnimatePresence>
    </div>
  )
}
