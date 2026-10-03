import { atom } from "jotai"

import type { ReviewLane } from "@workspace/ui/neuve/types"

/**
 * Batch overview interaction state, scoped by the screen's jotai Provider.
 *
 *   lane bar   human-required (rest) → hovered/focused/clicked lane
 *              pointer leaves the bar → back to human-required
 *   capture    paused (final frame) ⇄ playing (12s timeline) → paused
 */
export const REST_LANE: ReviewLane = "human-required"

export const activeLaneAtom = atom<ReviewLane>(REST_LANE)
export const capturePlayingAtom = atom(false)
/** Bumps on each play so the capture timeline restarts from 0:00. */
export const captureRunAtom = atom(0)

export interface BatchOverviewState {
  activeLane: ReviewLane
  capturePlaying: boolean
}

export function batchOverviewHydration(state: Partial<BatchOverviewState>) {
  return [
    [activeLaneAtom, state.activeLane ?? REST_LANE],
    [capturePlayingAtom, state.capturePlaying ?? false],
  ] as const
}

export const pickLaneAtom = atom(null, (get, set, lane: ReviewLane) => {
  if (get(activeLaneAtom) !== lane) set(activeLaneAtom, lane)
})

export const resetLaneAtom = atom(null, (_get, set) => {
  set(activeLaneAtom, REST_LANE)
})

export const toggleCaptureAtom = atom(null, (get, set) => {
  const playing = !get(capturePlayingAtom)
  set(capturePlayingAtom, playing)
  if (playing) set(captureRunAtom, get(captureRunAtom) + 1)
})

export const captureEndedAtom = atom(null, (_get, set) => {
  set(capturePlayingAtom, false)
})
