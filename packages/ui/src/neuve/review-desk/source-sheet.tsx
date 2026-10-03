/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — Source sheet (L2 → L3 drill)
 *
 *    0ms   "Open source": scrim fades in (scrim 160ms, ease-out)
 *    0ms   sheet slides x 24 → 0, opacity 0 → 1 (gentle spring 200/20)
 *  280ms   cited fragment pulses once: tint-2 overlay fades to the
 *          resting tint (pulse 900ms, ease-out, opacity only)
 *  close   sheet slides out x → 24, fades (sheetExit 200ms, accelerate);
 *          scrim fades; focus returns to "Open source", card stays open
 *
 * Reduced motion: opacity-only 150ms; the pulse becomes a static tint.
 * ───────────────────────────────────────────────────────── */

import * as React from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CopyIcon,
  ExternalLinkIcon,
} from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import {
  EASE,
  REDUCED_TRANSITION,
  SPRING,
  TIMING,
  ms,
} from "@workspace/ui/lib/motion"
import { cn } from "@workspace/ui/lib/utils"
import {
  closeSheetAtom,
  sheetMarkerAtom,
} from "@workspace/ui/neuve/review-desk/atoms"
import { editorHref } from "@workspace/ui/neuve/shared/editor-links"
import { HighlightedCode } from "@workspace/ui/neuve/shared/highlighted-code"
import { NeuveLink } from "@workspace/ui/neuve/shared/nav-link"
import type {
  ContextualMarker,
  SourceAction,
  SourceBlock,
  SourceTone,
} from "@workspace/ui/neuve/types"

const SHEET = {
  offsetX: 24, // px the sheet slides in from
  enter: SPRING.gentle,
  exit: { duration: ms(TIMING.sheetExit), ease: EASE.emphasizedAccelerate },
} as const

const SCRIM = {
  transition: { duration: ms(TIMING.scrim), ease: "easeOut" },
} as const

const PULSE = {
  transition: {
    delay: ms(TIMING.pulseDelay),
    duration: ms(TIMING.pulse),
    ease: "easeOut",
  },
} as const

const CHIP_TONE: Record<SourceTone, string> = {
  neutral: "bg-raised text-ink-2",
  outline:
    "bg-transparent text-ink-muted shadow-[inset_0_0_0_1px_var(--nv-line)]",
  sug: "bg-sug-tint text-sug-ink",
  req: "bg-req-tint text-req-ink",
  agt: "bg-agt-tint text-agt-fg",
}

const TEXT_TONE: Record<"sug" | "req" | "agt", string> = {
  sug: "text-sug-fg",
  req: "text-req-fg",
  agt: "text-agt-fg",
}

const SHEET_ACTION =
  "inline-flex h-7 flex-none items-center gap-1.5 rounded-[7px] border-0 bg-raised px-[9px] text-xs whitespace-nowrap text-ink no-underline transition-colors duration-120 hover:bg-raised-2 hover:text-ink motion-reduce:transition-none"

/** The cited quote pulses once after the sheet lands. */
function CitedQuote({ text }: { text: string }) {
  const reduce = useReducedMotion()
  return (
    <p className="relative isolate m-0 rounded-lg bg-sug-tint px-2.5 py-2 text-[13.5px] leading-[21px]">
      {!reduce && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 -z-1 rounded-lg bg-sug-tint-2"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={PULSE.transition}
        />
      )}
      {text}
    </p>
  )
}

function SheetActionLink({ action }: { action: SourceAction }) {
  if (action.kind === "copy-path") {
    return (
      <button
        type="button"
        aria-label="Copy path"
        className={SHEET_ACTION}
        onClick={() => void navigator.clipboard.writeText(action.path)}
      >
        <CopyIcon aria-hidden="true" className="size-3" />
      </button>
    )
  }
  if (action.kind === "editor") {
    return (
      <a
        href={editorHref(action.editor, action.path)}
        className={SHEET_ACTION}
        aria-label={`Open in ${action.editor} (opens externally)`}
      >
        {action.editor === "VS Code" && (
          <ExternalLinkIcon aria-hidden="true" className="size-3" />
        )}
        {action.editor}
      </a>
    )
  }
  return (
    <a
      href={action.href}
      target="_blank"
      rel="noreferrer"
      className={SHEET_ACTION}
      aria-label={
        action.kind === "external"
          ? `${action.label} (opens externally)`
          : undefined
      }
    >
      {action.kind === "external" && (
        <ExternalLinkIcon aria-hidden="true" className="size-3" />
      )}
      {action.label}
    </a>
  )
}

function SourceBlockView({ block }: { block: SourceBlock }) {
  switch (block.kind) {
    case "code":
      return (
        <div className="overflow-x-auto rounded-[10px] bg-paper py-1.5 shadow-[0_0_0_1px_var(--nv-line-2)]">
          {block.lines.map((line) => (
            <div
              key={line.number}
              data-cited={line.cited ? "" : undefined}
              className={cn(
                "grid min-w-full grid-cols-[40px_max-content] font-mono text-[12.5px] leading-[23px] whitespace-pre",
                line.cited && "bg-sug-tint"
              )}
            >
              <span
                className={cn(
                  "pr-3 text-right",
                  line.cited ? "text-sug-ink" : "text-faint"
                )}
              >
                {line.number}
              </span>
              <span className="pr-4">
                <HighlightedCode code={line.text} />
              </span>
            </div>
          ))}
        </div>
      )
    case "quote":
      return <CitedQuote text={block.text} />
    case "text":
      return (
        <p className="m-0 text-[13.5px] leading-[21px] text-ink-2">
          {block.text}
        </p>
      )
    case "label":
      return <span className="pt-1 label-mono">{block.text}</span>
    case "rows":
      return (
        <div>
          {block.rows.map((row, i) => (
            <div
              key={`${row.label}-${i}`}
              className={cn(
                "grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-2.5 py-[9px]",
                i > 0 && "border-t border-line-2"
              )}
            >
              <span
                className={cn(
                  "font-mono text-[10.5px]",
                  row.tone ? TEXT_TONE[row.tone] : "text-ink-muted"
                )}
              >
                {row.mark}
              </span>
              <span className="flex min-w-0 flex-col gap-px">
                <span
                  className={cn(
                    "text-[13px] wrap-anywhere",
                    block.mono && "font-mono text-[12.5px]",
                    row.tone === "req" && block.mono && "text-req-fg"
                  )}
                >
                  {row.label}
                </span>
                {row.sub && (
                  <span className="font-mono text-[11px] wrap-anywhere text-ink-muted">
                    {row.sub}
                  </span>
                )}
              </span>
              {row.openPath ? (
                <a
                  href={editorHref("VS Code", row.openPath)}
                  aria-label={`Open ${row.openPath} in editor`}
                  className={cn(SHEET_ACTION, "h-[26px] px-2")}
                >
                  <ExternalLinkIcon aria-hidden="true" className="size-3" />
                </a>
              ) : row.stat ? (
                <span className="font-mono text-[11px]">
                  {row.stat.additions !== undefined && (
                    <span className="text-add-fg">+{row.stat.additions}</span>
                  )}
                  {row.stat.deletions !== undefined && (
                    <span className="text-del-fg"> −{row.stat.deletions}</span>
                  )}
                </span>
              ) : (
                <span
                  className={cn(
                    "font-mono text-[11px]",
                    row.tone ? TEXT_TONE[row.tone] : "text-ink-muted"
                  )}
                >
                  {row.meta}
                </span>
              )}
            </div>
          ))}
        </div>
      )
  }
}

/**
 * L3 drill: the whole source in a sheet over the unit — kind and status
 * chips, title and mono subtitle, actions (open in an editor, copy path,
 * Linear, the commit), two to four facts coloured only where they carry
 * status, kind-specific blocks with the cited fragment highlighted, and the
 * units that cite it ("Go to its unit" when it belongs to another unit).
 * Code is always Geist Mono.
 */
export function SourceSheet({
  markers,
}: {
  markers: Record<string, ContextualMarker>
}) {
  const sheetKey = useAtomValue(sheetMarkerAtom)
  const closeSheet = useSetAtom(closeSheetAtom)
  /** Anchor inside the unit column, used to find the card's trigger again. */
  const anchor = React.useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()
  const marker = sheetKey ? markers[sheetKey] : undefined
  const source = marker?.source

  return (
    <>
      <span ref={anchor} hidden />
      <DialogPrimitive.Root
        open={source !== undefined}
        onOpenChange={(open) => {
          if (!open) closeSheet()
        }}
      >
        <AnimatePresence
          onExitComplete={() => {
            // "Back returns you to the same line": refocus the card's trigger.
            // Next frame, so Radix's focus trap has been torn down with the sheet.
            requestAnimationFrame(() =>
              anchor.current
                ?.closest("main")
                ?.querySelector<HTMLElement>("[data-source-trigger]")
                ?.focus()
            )
          }}
        >
          {source && (
            <React.Fragment key="sheet">
              <DialogPrimitive.Overlay asChild forceMount>
                <motion.div
                  className="absolute inset-0 z-20 bg-scrim"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={reduce ? REDUCED_TRANSITION : SCRIM.transition}
                />
              </DialogPrimitive.Overlay>
              <DialogPrimitive.Content
                asChild
                forceMount
                // Escape returns to the card only; the desk's own Escape
                // handler (close card) must not also see this keypress.
                onEscapeKeyDown={(event) => event.stopPropagation()}
                // Focus is restored in AnimatePresence.onExitComplete instead.
                onCloseAutoFocus={(event) => event.preventDefault()}
              >
                <motion.aside
                  initial={
                    reduce ? { opacity: 0 } : { opacity: 0, x: SHEET.offsetX }
                  }
                  animate={{ opacity: 1, x: 0 }}
                  exit={
                    reduce
                      ? { opacity: 0, transition: REDUCED_TRANSITION }
                      : { opacity: 0, x: SHEET.offsetX, transition: SHEET.exit }
                  }
                  transition={reduce ? REDUCED_TRANSITION : SHEET.enter}
                  className="absolute top-0 right-0 bottom-0 z-21 box-border flex w-[min(580px,100%)] flex-col overflow-auto bg-surface shadow-card outline-none"
                >
                  <div className="flex flex-col gap-2.5 border-b border-line-2 px-[22px] pt-[18px] pb-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="label-mono">{source.kind}</span>
                      {source.chips.map((chip) => (
                        <span
                          key={chip.text}
                          className={cn(
                            "rounded-[5px] px-[7px] py-0.5 font-mono text-[10.5px] whitespace-nowrap",
                            CHIP_TONE[chip.tone]
                          )}
                        >
                          {chip.text}
                        </span>
                      ))}
                      <span className="flex-auto" />
                      <DialogPrimitive.Close asChild>
                        <button type="button" className={SHEET_ACTION}>
                          <ArrowLeftIcon
                            aria-hidden="true"
                            className="size-3"
                            strokeWidth={1.9}
                          />
                          Back to unit
                        </button>
                      </DialogPrimitive.Close>
                    </div>
                    <DialogPrimitive.Title className="m-0 text-xl leading-[26px] font-semibold tracking-[-0.02em]">
                      {source.title}
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className="m-0 font-mono text-xs text-ink-muted">
                      {source.subtitle}
                    </DialogPrimitive.Description>
                    {source.actions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {source.actions.map((action, i) => (
                          <SheetActionLink key={i} action={action} />
                        ))}
                      </div>
                    )}
                  </div>
                  {source.facts.length > 0 && (
                    <dl className="m-0 grid grid-cols-2 gap-x-[18px] gap-y-2.5 border-b border-line-2 px-[22px] py-3.5">
                      {source.facts.map((fact) => (
                        <div
                          key={fact.label}
                          className="flex min-w-0 flex-col gap-0.5"
                        >
                          <dt className="text-[11.5px] text-ink-muted">
                            {fact.label}
                          </dt>
                          <dd
                            className={cn(
                              "m-0 truncate",
                              fact.mono ? "font-mono text-xs" : "text-[13px]",
                              fact.tone ? TEXT_TONE[fact.tone] : "text-ink"
                            )}
                          >
                            {fact.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <div className="flex flex-col gap-3 px-[22px] pt-4">
                    {source.blocks.map((block, i) => (
                      <SourceBlockView key={i} block={block} />
                    ))}
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-2 px-[22px] py-4 text-xs text-ink-muted">
                    Cited by
                    {source.citedBy.map((unit) => (
                      <span
                        key={unit}
                        className="rounded-[5px] bg-raised px-[7px] py-0.5 font-mono text-[11px] text-ink-2"
                      >
                        {unit}
                      </span>
                    ))}
                    {source.goToUnit && (
                      <NeuveLink
                        destination={{ to: "unit", unitId: source.goToUnit }}
                        className={cn(SHEET_ACTION, "ml-auto")}
                      >
                        Go to its unit
                        <ArrowRightIcon
                          aria-hidden="true"
                          className="size-3"
                          strokeWidth={1.8}
                        />
                      </NeuveLink>
                    )}
                  </div>
                </motion.aside>
              </DialogPrimitive.Content>
            </React.Fragment>
          )}
        </AnimatePresence>
      </DialogPrimitive.Root>
    </>
  )
}
