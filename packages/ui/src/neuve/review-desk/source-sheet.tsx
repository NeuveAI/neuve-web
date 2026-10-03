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
import { ChevronLeftIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "@workspace/ui/components/button"
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
import type {
  ContextualMarker,
  SourceParagraph,
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

function SourceParagraphView({ paragraph }: { paragraph: SourceParagraph }) {
  const reduce = useReducedMotion()
  return (
    <p
      className={cn(
        "relative m-0 rounded-md text-sm leading-[22px] whitespace-pre-line",
        paragraph.cited && "isolate bg-sug-tint px-2.5 py-1.5"
      )}
    >
      {paragraph.cited && !reduce && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 -z-1 rounded-md bg-sug-tint-2"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={PULSE.transition}
        />
      )}
      {paragraph.text}
    </p>
  )
}

/**
 * L3 drill: the whole source in a sheet over the unit, with the cited
 * fragment highlighted and the other units that cite it.
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
                  className="absolute top-0 right-0 bottom-0 z-21 box-border flex w-[min(560px,100%)] flex-col bg-surface shadow-card outline-none"
                >
                  <div className="flex flex-col gap-2 border-b border-line-2 px-6 pt-5 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="label-mono">{source.kind}</span>
                      <span className="flex-auto" />
                      <DialogPrimitive.Close asChild>
                        <Button
                          type="button"
                          variant="raised"
                          size="compact"
                          className="h-8"
                        >
                          <ChevronLeftIcon
                            data-icon="inline-start"
                            aria-hidden="true"
                          />
                          Back to unit
                        </Button>
                      </DialogPrimitive.Close>
                    </div>
                    <DialogPrimitive.Title className="m-0 text-xl leading-[26px] font-semibold tracking-[-0.02em]">
                      {source.title}
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className="m-0 font-mono text-[11.5px] text-ink-muted">
                      {source.meta}
                    </DialogPrimitive.Description>
                  </div>
                  <div className="flex flex-auto flex-col gap-3.5 overflow-auto px-6 py-5">
                    {source.paragraphs.map((paragraph, i) => (
                      <SourceParagraphView key={i} paragraph={paragraph} />
                    ))}
                  </div>
                  <div className="flex flex-col gap-1.5 border-t border-line-2 px-6 py-3.5">
                    <span className="label-mono">Also cited by</span>
                    <span className="text-[13px] text-ink-2">
                      {source.citedBy}
                    </span>
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
