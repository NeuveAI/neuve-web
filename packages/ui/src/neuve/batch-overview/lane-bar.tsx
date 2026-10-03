/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — Lane bar
 *
 *    0ms   lane hovered/focused: other lanes dim to 40%
 *          (laneTone 160ms, standard)
 *    0ms   active lane lifts scaleY 1 → 1.08 (laneLift 200ms, standard)
 *    0ms   caption swaps in: opacity 0 → 1, y -4 → 0
 *          (caption 220ms, emphasized decelerate)
 *  leave   bar returns to the human-required lane
 *
 * Reduced motion: no lift; dimming stays; captions fade 150ms.
 * ───────────────────────────────────────────────────────── */

import { useAtomValue, useSetAtom } from "jotai"
import { motion, useReducedMotion } from "motion/react"

import { EASE, REDUCED_TRANSITION, TIMING, ms } from "@workspace/ui/lib/motion"
import { cn } from "@workspace/ui/lib/utils"
import {
  activeLaneAtom,
  pickLaneAtom,
  resetLaneAtom,
} from "@workspace/ui/neuve/batch-overview/atoms"
import type { LaneSummary, ReviewLane } from "@workspace/ui/neuve/types"

const LANE_TONE: Record<
  ReviewLane,
  { fill: string; ink: string; caption: string }
> = {
  "human-required": {
    fill: "bg-req",
    ink: "text-on-req",
    caption: "text-req-fg",
  },
  "human-suggested": {
    fill: "bg-sug-tint-2",
    ink: "text-sug-ink",
    caption: "text-sug-fg",
  },
  "agentic-review": {
    fill: "bg-agt-tint-2",
    ink: "text-agt-ink",
    caption: "text-agt-fg",
  },
  "static-automation": {
    fill: "bg-sta-fill",
    ink: "text-sta-ink",
    caption: "text-ink-2",
  },
}

const LANE = {
  activeScaleY: 1.08,
  dimmedOpacity: 0.4,
  tone: { duration: ms(TIMING.laneTone), ease: EASE.standard },
  lift: { duration: ms(TIMING.laneLift), ease: EASE.standard },
} as const

const CAPTION = {
  offsetY: -4,
  transition: { duration: ms(TIMING.caption), ease: EASE.emphasizedDecelerate },
} as const

/**
 * Proportional lane bar for the whole batch. Hover, focus or click a lane to
 * read its caption; the caption sits under the lane's start (the last lane
 * anchors right so it never overflows).
 */
export function LaneBar({ lanes }: { lanes: Array<LaneSummary> }) {
  const active = useAtomValue(activeLaneAtom)
  const pick = useSetAtom(pickLaneAtom)
  const reset = useSetAtom(resetLaneAtom)
  const reduce = useReducedMotion()

  const total = lanes.reduce((sum, lane) => sum + lane.count, 0)
  let start = 0
  const positioned = lanes.map((lane, i) => {
    const offset = start
    start += lane.count
    return {
      ...lane,
      anchorRight: i === lanes.length - 1,
      startPercent: (offset / total) * 100,
    }
  })
  const current = positioned.find((lane) => lane.lane === active)

  return (
    <section aria-label="Review units by lane" className="flex flex-col gap-3">
      <div
        onMouseLeave={reset}
        className="flex gap-[3px] overflow-hidden rounded-[10px]"
      >
        {positioned.map((lane) => {
          const on = lane.lane === active
          const tone = LANE_TONE[lane.lane]
          return (
            <motion.button
              key={lane.lane}
              type="button"
              aria-pressed={on}
              aria-label={`${lane.name}: ${lane.count} units`}
              onMouseEnter={() => pick(lane.lane)}
              onFocus={() => pick(lane.lane)}
              onClick={() => pick(lane.lane)}
              animate={{
                opacity: on ? 1 : LANE.dimmedOpacity,
                scaleY: on && !reduce ? LANE.activeScaleY : 1,
              }}
              transition={{
                opacity: reduce ? REDUCED_TRANSITION : LANE.tone,
                scaleY: LANE.lift,
              }}
              style={{ flex: `${lane.count} 1 0` }}
              className={cn(
                "flex h-11 min-w-11 items-center border-0 px-3 text-[13px] font-semibold",
                tone.fill,
                tone.ink
              )}
            >
              {lane.count}
            </motion.button>
          )
        })}
      </div>
      <div className="relative h-[52px]" aria-live="polite">
        {current && (
          <motion.div
            key={current.lane}
            initial={
              reduce ? { opacity: 0 } : { opacity: 0, y: CAPTION.offsetY }
            }
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? REDUCED_TRANSITION : CAPTION.transition}
            style={
              current.anchorRight
                ? { right: 0 }
                : { left: `${current.startPercent}%` }
            }
            className={cn(
              "absolute top-0 flex max-w-[420px] flex-col gap-1",
              current.anchorRight
                ? "items-end text-right"
                : "items-start text-left"
            )}
          >
            <span
              className={cn(
                "flex items-center gap-2 text-sm font-semibold",
                LANE_TONE[current.lane].caption
              )}
            >
              {current.name}
              <span className="font-mono text-xs font-medium text-ink-muted">
                {current.count}
              </span>
            </span>
            <span className="text-[13px] text-ink-2">{current.line}</span>
          </motion.div>
        )}
      </div>
    </section>
  )
}
