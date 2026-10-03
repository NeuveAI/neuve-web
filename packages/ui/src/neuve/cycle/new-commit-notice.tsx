/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD — New-commit notice (Cycle.dc.html)
 *
 *    0ms   a Git event arrives: the dark notice drops in at the top of the
 *          unit column, y -12 → 0, scale .98 → 1, opacity 0 → 1
 *          (notice 360ms, emphasized decelerate)
 *  Later   the notice leaves (noticeExit 160ms, accelerate) and shrinks to
 *          the corner pill, which fades and scales .96 → 1 (snappy spring)
 *  pill    click reopens the lineage ("What changed")
 *
 * The diff under review never moves: the notice floats over the column.
 * Reduced motion: opacity-only 150ms.
 * ───────────────────────────────────────────────────────── */

import { useAtomValue, useSetAtom } from "jotai"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { GitCommitHorizontalIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  EASE,
  REDUCED_TRANSITION,
  SPRING,
  TIMING,
  ms,
} from "@workspace/ui/lib/motion"
import { NeuveLink } from "@workspace/ui/neuve/shared/nav-link"
import { noticeAtom } from "@workspace/ui/neuve/review-desk/atoms"
import type { NewCommitEvent } from "@workspace/ui/neuve/types"

const NOTICE = {
  offsetY: -12,
  initialScale: 0.98,
  enter: { duration: ms(TIMING.notice), ease: EASE.emphasizedDecelerate },
  exit: { duration: ms(TIMING.noticeExit), ease: EASE.emphasizedAccelerate },
} as const

/**
 * A Neuve event sourced from Git: a new commit landed while you review an
 * earlier one. Your review stays on the commit you started; "What changed"
 * opens the lineage, "Later" parks it as a corner pill. (Commits made inside
 * an agent's inner loop show as thread activity instead.)
 */
export function NewCommitNotice({ event }: { event: NewCommitEvent }) {
  const notice = useAtomValue(noticeAtom)
  const setNotice = useSetAtom(noticeAtom)
  const reduce = useReducedMotion()
  const changes = { to: "changes", commit: event.commit } as const

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center px-4">
        <AnimatePresence>
          {notice === "shown" && (
            <motion.div
              key="notice"
              role="status"
              aria-label={`New commit ${event.commit}`}
              initial={
                reduce
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      y: NOTICE.offsetY,
                      scale: NOTICE.initialScale,
                    }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                reduce
                  ? { opacity: 0, transition: REDUCED_TRANSITION }
                  : {
                      opacity: 0,
                      y: NOTICE.offsetY / 2,
                      scale: NOTICE.initialScale,
                      transition: NOTICE.exit,
                    }
              }
              transition={reduce ? REDUCED_TRANSITION : NOTICE.enter}
              className="pointer-events-auto box-border flex w-[min(520px,100%)] items-center gap-2.5 rounded-[14px] bg-dock py-1.5 pr-1.5 pl-3.5 text-dock-fg shadow-dock"
            >
              <GitCommitHorizontalIcon
                aria-hidden="true"
                className="size-[15px] shrink-0 text-brand"
              />
              <span className="flex min-w-0 flex-auto flex-col">
                <span className="text-[13.5px] font-semibold">
                  New commit{" "}
                  <span className="font-mono text-[12.5px]">
                    {event.commit}
                  </span>
                </span>
                <span className="truncate text-xs text-dock-muted">
                  {event.needYou} units need you · your review stays on{" "}
                  {event.reviewing}
                </span>
              </span>
              <Button
                type="button"
                variant="dock-ghost"
                size="dock"
                onClick={() => setNotice("parked")}
              >
                Later
              </Button>
              <Button variant="dock-primary" size="dock" asChild>
                <NeuveLink
                  destination={changes}
                  onClick={() => setNotice("parked")}
                >
                  What changed
                </NeuveLink>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {notice === "parked" && (
          <motion.div
            key="pill"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: REDUCED_TRANSITION }}
            transition={reduce ? REDUCED_TRANSITION : SPRING.snappy}
            style={{ transformOrigin: "top right" }}
            className="absolute top-4 right-6 z-30"
          >
            <NeuveLink
              destination={changes}
              aria-label={`New commit ${event.commit}: ${event.needYou} units need you. What changed`}
              className="inline-flex h-8 items-center gap-2 rounded-2xl bg-raised-2 px-3 text-[12.5px] text-ink no-underline shadow-[0_0_0_2px_var(--nv-bg)] transition-colors duration-120 hover:bg-raised hover:text-ink motion-reduce:transition-none"
            >
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-brand"
              />
              <span className="font-mono text-[11.5px]">{event.commit}</span>·{" "}
              {event.needYou} need you
            </NeuveLink>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
