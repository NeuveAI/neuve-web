/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — Read-only neighbor collapse
 *
 *    0ms   toggle pressed; chevron turns 0 → 180° (chevron 200ms, standard)
 *    0ms   rows rise: opacity 0 → 1, y 8 → 0, scale .98 → 1
 *          (dockRise 240ms, emphasized decelerate, origin bottom)
 *  hide    rows fade out (dockExit 120ms, accelerate)
 *
 * Reduced motion: chevron snaps, rows fade 150ms.
 * ───────────────────────────────────────────────────────── */

import { useAtomValue, useSetAtom } from "jotai"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ChevronDownIcon, LockIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { EASE, REDUCED_TRANSITION, TIMING, ms } from "@workspace/ui/lib/motion"
import {
  neighborOpenAtom,
  toggleNeighborAtom,
} from "@workspace/ui/neuve/review-desk/atoms"
import { toPatchDiff } from "@workspace/ui/neuve/review-desk/diff-model"
import { DiffSurface } from "@workspace/ui/neuve/review-desk/diff-surface"
import type { ReadOnlyNeighbor as Neighbor } from "@workspace/ui/neuve/types"

const ROWS = {
  offsetY: 8, // px the rows rise from
  initialScale: 0.98,
  enter: { duration: ms(TIMING.dockRise), ease: EASE.emphasizedDecelerate },
  exit: { duration: ms(TIMING.dockExit), ease: EASE.emphasizedAccelerate },
} as const

const NO_ANNOTATIONS: [] = []
const NO_OVERLAY = {
  expandedId: undefined,
  dismissedIds: [],
  hintId: undefined,
  isolated: false,
} as const

/**
 * A read-only neighbor: a hunk from another lane shown for context. Muted
 * grayscale, no syntax or diff colour (the `.nv-diff-readonly` variant of the
 * forked renderer), collapsed by default. It keeps its own
 * lane and result; the unit's disposition never applies to it.
 */
export function ReadOnlyNeighbor({ neighbor }: { neighbor: Neighbor }) {
  const open = useAtomValue(neighborOpenAtom)
  const toggle = useSetAtom(toggleNeighborAtom)
  const reduce = useReducedMotion()
  const regionId = `neighbor-${neighbor.path.replace(/[^a-z0-9]+/gi, "-")}`

  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-auto overflow-hidden rounded-[10px] bg-ro-bg">
        <div className="box-border flex h-11 items-center gap-2.5 pr-2 pl-3.5">
          <LockIcon
            aria-hidden="true"
            className="size-3 text-faint"
            strokeWidth={1.6}
          />
          <span className="min-w-0 truncate font-mono text-xs text-ink-muted">
            {neighbor.path}
          </span>
          <span className="text-xs whitespace-nowrap text-faint">
            {neighbor.note}
          </span>
          <span className="flex-auto" />
          <Button
            type="button"
            variant="quiet"
            size="compact"
            aria-expanded={open}
            aria-controls={regionId}
            onClick={toggle}
          >
            {open ? "Hide" : "Show"}
            <motion.span
              aria-hidden="true"
              className="inline-flex"
              animate={{ rotate: open ? 180 : 0 }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { duration: ms(TIMING.chevron), ease: EASE.standard }
              }
            >
              <ChevronDownIcon className="size-2.5" strokeWidth={2} />
            </motion.span>
          </Button>
        </div>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id={regionId}
              initial={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, y: ROWS.offsetY, scale: ROWS.initialScale }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{
                opacity: 0,
                transition: reduce ? REDUCED_TRANSITION : ROWS.exit,
              }}
              transition={reduce ? REDUCED_TRANSITION : ROWS.enter}
              style={{ transformOrigin: "bottom center" }}
              className="pb-1.5"
            >
              <DiffSurface
                variant="read-only"
                label={`Read-only neighbor ${neighbor.path}`}
                fileDiff={toPatchDiff(neighbor.patch)}
                annotations={NO_ANNOTATIONS}
                overlay={NO_OVERLAY}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div
        aria-hidden="true"
        className="shrink-0 grow-0 basis-[268px] max-[1180px]:basis-[220px] max-[860px]:hidden"
      />
    </div>
  )
}
