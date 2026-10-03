/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — Capture mini-player (12s timeline)
 *
 * Read top-to-bottom. Each value is ms after Play.
 *
 *      0ms   progress starts: scaleX 0 → 1, linear over 12000ms
 *    240ms   step 1 "owner · Revoke link" fades in
 *   3600ms   step 1 holds …
 *   3960ms   … fades out; step 2 "guest · reload" fades in by 4320ms
 *   7560ms   step 2 fades out by 7920ms
 *   7920ms   outcome (403 + message) fades in by 8400ms and holds
 *  12000ms   timeline ends → player returns to paused on the outcome
 *
 * Paused shows the outcome frame with a full bar (what was observed).
 * Reduced motion: opacity crossfades stay (they are the content); the
 * progress bar keeps running because it reports position, not decoration.
 * ───────────────────────────────────────────────────────── */

import type { ReactNode } from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { MotionConfig, motion } from "motion/react"
import { PauseIcon, PlayIcon } from "lucide-react"

import { TIMING, ms } from "@workspace/ui/lib/motion"
import {
  captureEndedAtom,
  capturePlayingAtom,
  captureRunAtom,
  toggleCaptureAtom,
} from "@workspace/ui/neuve/batch-overview/atoms"

/** Keyframe stops as fractions of TIMING.capture (from Overview.dc.html). */
const STEPS = {
  first: { opacity: [0, 0, 1, 1, 0, 0], times: [0, 0.02, 0.05, 0.3, 0.33, 1] },
  second: {
    opacity: [0, 0, 1, 1, 0, 0],
    times: [0, 0.33, 0.36, 0.63, 0.66, 1],
  },
  outcome: { opacity: [0, 0, 1, 1], times: [0, 0.66, 0.7, 1] },
} as const

const TIMELINE = { duration: ms(TIMING.capture), ease: "linear" } as const

function Step({
  frames,
  playing,
  resting,
  className,
  children,
}: {
  frames: { opacity: ReadonlyArray<number>; times: ReadonlyArray<number> }
  playing: boolean
  /** Opacity when paused. */
  resting: number
  className?: string
  children: ReactNode
}) {
  return (
    <motion.span
      className={className}
      animate={{ opacity: playing ? [...frames.opacity] : resting }}
      transition={
        playing ? { ...TIMELINE, times: [...frames.times] } : { duration: 0 }
      }
    >
      {children}
    </motion.span>
  )
}

export function CapturePlayer({
  steps,
  outcome,
  duration,
}: {
  steps: [string, string]
  outcome: { status: string; message: string }
  duration: string
}) {
  const playing = useAtomValue(capturePlayingAtom)
  const run = useAtomValue(captureRunAtom)
  const toggle = useSetAtom(toggleCaptureAtom)
  const ended = useSetAtom(captureEndedAtom)

  return (
    <div className="relative aspect-video overflow-hidden rounded-lg bg-player">
      <div
        key={run}
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-player-fg"
      >
        <Step
          frames={STEPS.first}
          playing={playing}
          resting={0}
          className="absolute font-mono text-[11px] text-player-muted"
        >
          {steps[0]}
        </Step>
        <Step
          frames={STEPS.second}
          playing={playing}
          resting={0}
          className="absolute font-mono text-[11px] text-player-muted"
        >
          {steps[1]}
        </Step>
        <Step
          frames={STEPS.outcome}
          playing={playing}
          resting={1}
          className="absolute flex flex-col items-center gap-1.5"
        >
          <span className="rounded-sm bg-player-badge px-[7px] py-0.5 font-mono text-[10.5px] text-player-badge-fg">
            {outcome.status}
          </span>
          <span className="text-[13px]">{outcome.message}</span>
        </Step>
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-label={
          playing
            ? "Pause capture"
            : `Play capture: ${steps[0]}, then ${steps[1]}`
        }
        className="absolute bottom-2.5 left-2.5 inline-flex size-8 items-center justify-center rounded-2xl border-0 bg-player-fg/92 text-player-ink"
      >
        {playing ? (
          <PauseIcon aria-hidden="true" className="size-3 fill-current" />
        ) : (
          <PlayIcon aria-hidden="true" className="size-3 fill-current" />
        )}
      </button>
      <div className="absolute right-3 bottom-6 left-[52px] h-[3px] overflow-hidden rounded-[2px] bg-player-fg/25">
        {/* Position indicator, not decoration: keep it moving under reduced motion. */}
        <MotionConfig reducedMotion="never">
          <motion.div
            key={run}
            className="h-full origin-left bg-player-progress"
            animate={{ scaleX: playing ? [0, 1] : 1 }}
            transition={playing ? TIMELINE : { duration: 0 }}
            onAnimationComplete={() => {
              if (playing) ended()
            }}
          />
        </MotionConfig>
      </div>
      <span className="absolute right-3 bottom-1.5 font-mono text-[10px] text-player-muted">
        {duration}
      </span>
    </div>
  )
}
