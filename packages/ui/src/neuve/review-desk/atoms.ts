import { atom } from "jotai"
import type { Virtualizer } from "@workspace/diffs"

import { createReviewCommentRecord } from "@workspace/ui/neuve/review-comments/record"
import type {
  ReviewCommentAnchor,
  ReviewCommentAuthor,
} from "@workspace/ui/neuve/review-comments/record"
import {
  defaultReviewCommentRepository,
  reviewCommentRepositoryAtom,
} from "@workspace/ui/neuve/review-comments/repository"
import type { ReviewCommentRepository } from "@workspace/ui/neuve/review-comments/repository"
import {
  rangeEquals,
  rangeKey,
} from "@workspace/ui/neuve/review-desk/diff-model"
import type { LineRange } from "@workspace/ui/neuve/types"

/**
 * Review desk interaction state.
 *
 * The screen mounts its own jotai <Provider>, so these module-level atoms are
 * scoped per screen instance (and per story). Data comes in through props;
 * atoms only hold what the reviewer is doing with it.
 *
 * State machine (from Main.dc.html):
 *
 *   margin   closed ⇄ card(marker) → sheet(marker) → card(marker)
 *   lines    none ⇄ selected(file, range) — gutter click/drag/Shift/keys
 *            selected → composer(range) — chip, Enter/C, or the gutter "+"
 *            composer → saved (collapses into a pin) | cancelled | parked draft
 *   comment body  pin (L0, default) ⇄ open; dismiss one or all → pin
 *   dock     rest → composing → changes-requested ─┐
 *            rest ──────────────→ approved ────────┤ undo → rest
 *            composing ── cancel ──→ rest           │
 */

export type DockState = "rest" | "composing" | "approved" | "changes-requested"

/** The pin that owns its file's single shared hint (the layer places it). */
export interface HoverHint {
  filePath: string
  markerKey: string
}

/** Lines selected in one file's gutter (one selection across the desk). */
export interface LineSelection {
  filePath: string
  range: LineRange
}

/** Where the inline comment composer is open: the selected range. */
export type ComposerTarget = LineSelection

/** A comment draft set aside with Escape; it shows as a "Draft" pin. */
export interface ParkedDraft {
  id: string
  filePath: string
  range: LineRange
  text: string
}

export interface ReviewDeskState {
  openMarker: string | null
  sheetMarker: string | null
  neighborOpen: boolean
  dock: DockState
  draft: string
  attachment: string | null
  hoverHint: HoverHint | null
  /**
   * Review-comment markers whose body is open in the margin. Bodies start
   * collapsed to their pin (less is more); opening is explicit, and a saved
   * comment opens so the reviewer sees it land.
   */
  openBodies: ReadonlyArray<string>
  lineSelection: LineSelection | null
  composer: ComposerTarget | null
  commentDraft: string
  parkedDrafts: ReadonlyArray<ParkedDraft>
  /** Resolved review comments stay out of the margin unless asked for. */
  showResolved: boolean
}

export const INITIAL_REVIEW_DESK_STATE: ReviewDeskState = {
  openMarker: null,
  sheetMarker: null,
  neighborOpen: false,
  dock: "rest",
  draft: "",
  attachment: null,
  hoverHint: null,
  openBodies: [],
  lineSelection: null,
  composer: null,
  commentDraft: "",
  parkedDrafts: [],
  showResolved: false,
}

/* ── Primitive atoms ───────────────────────────────────── */

export const openMarkerAtom = atom<string | null>(null)
export const showResolvedAtom = atom(false)
export const sheetMarkerAtom = atom<string | null>(null)
export const neighborOpenAtom = atom(false)
export const dockAtom = atom<DockState>("rest")
export const draftAtom = atom("")
export const attachmentAtom = atom<string | null>(null)
export const hoverHintAtom = atom<HoverHint | null>(null)
export const openBodiesAtom = atom<ReadonlyArray<string>>([])
export const lineSelectionAtom = atom<LineSelection | null>(null)
export const composerAtom = atom<ComposerTarget | null>(null)
export const commentDraftAtom = atom("")
export const parkedDraftsAtom = atom<ReadonlyArray<ParkedDraft>>([])
/**
 * The composer that just closed, kept in the overlay until its exit motion
 * (collapsing toward the pin row) finishes. Cleared by the exit callback.
 */
export const closingComposerAtom = atom<ComposerTarget | null>(null)

/**
 * The review desk's diff Virtualizer, created by the unit column's scroll
 * container. `"pending"` inside the desk until the scroll root has mounted
 * (diff hosts wait rather than build a throwaway renderer); null outside the
 * desk, where component stories render every row.
 */
export const diffVirtualizerAtom = atom<Virtualizer | null | "pending">(null)

/** Every primitive atom with its value, for hydration in screens and stories. */
export function reviewDeskHydration(state: Partial<ReviewDeskState>) {
  const s = { ...INITIAL_REVIEW_DESK_STATE, ...state }
  return [
    [openMarkerAtom, s.openMarker],
    [sheetMarkerAtom, s.sheetMarker],
    [neighborOpenAtom, s.neighborOpen],
    [dockAtom, s.dock],
    [draftAtom, s.draft],
    [attachmentAtom, s.attachment],
    [hoverHintAtom, s.hoverHint],
    [openBodiesAtom, s.openBodies],
    [lineSelectionAtom, s.lineSelection],
    [composerAtom, s.composer],
    [commentDraftAtom, s.commentDraft],
    [parkedDraftsAtom, s.parkedDrafts],
    [showResolvedAtom, s.showResolved],
  ] as const
}

/** Hydration for the comment repository (the local one unless injected). */
export function commentRepositoryHydration(
  repository: ReviewCommentRepository | undefined
) {
  return [
    [reviewCommentRepositoryAtom, repository ?? defaultReviewCommentRepository],
  ] as const
}

/* ── Derived atoms ─────────────────────────────────────── */

/**
 * One expanded layer is isolating the margin: an L2 card (with no L3 sheet
 * covering it) or the inline comment composer.
 */
export const isolatingAtom = atom(
  (get) =>
    (get(openMarkerAtom) !== null && get(sheetMarkerAtom) === null) ||
    get(composerAtom) !== null
)

export const isDecidedAtom = atom((get) => {
  const dock = get(dockAtom)
  return dock === "approved" || dock === "changes-requested"
})

/* ── Actions ───────────────────────────────────────────── */

/** Pin click: open its card, or close it when it is already open. */
export const toggleMarkerAtom = atom(null, (get, set, markerKey: string) => {
  set(openMarkerAtom, get(openMarkerAtom) === markerKey ? null : markerKey)
  set(sheetMarkerAtom, null)
  set(hoverHintAtom, null)
  set(composerAtom, null)
})

/** Briefing citation: always opens (never toggles) the cited marker. */
export const openCitationAtom = atom(null, (_get, set, markerKey: string) => {
  set(openMarkerAtom, markerKey)
  set(sheetMarkerAtom, null)
  set(hoverHintAtom, null)
  set(composerAtom, null)
})

export const closeCardAtom = atom(null, (_get, set) => {
  set(openMarkerAtom, null)
})

/** Outside click or Escape: close whichever layer is expanded (draft kept). */
export const closeExpandedAtom = atom(null, (get, set) => {
  set(openMarkerAtom, null)
  if (get(composerAtom) !== null) set(escapeComposerAtom)
})

export const openSheetAtom = atom(null, (get, set) => {
  set(sheetMarkerAtom, get(openMarkerAtom))
})

/** "Back to unit": the sheet closes and the card it came from stays open. */
export const closeSheetAtom = atom(null, (_get, set) => {
  set(sheetMarkerAtom, null)
})

export const toggleNeighborAtom = atom(null, (get, set) => {
  set(neighborOpenAtom, !get(neighborOpenAtom))
})

export const startChangesAtom = atom(
  null,
  (get, set, fallbackAttachment: string) => {
    set(dockAtom, "composing")
    set(attachmentAtom, get(openMarkerAtom) ?? fallbackAttachment)
  }
)

export const approveAtom = atom(null, (_get, set) => {
  set(dockAtom, "approved")
  set(openMarkerAtom, null)
  set(sheetMarkerAtom, null)
})

export const sendChangesAtom = atom(null, (_get, set) => {
  set(dockAtom, "changes-requested")
  set(openMarkerAtom, null)
  set(sheetMarkerAtom, null)
})

/** Cancel the composer or undo a decision: back to rest with no draft. */
export const resetDockAtom = atom(null, (_get, set) => {
  set(dockAtom, "rest")
  set(draftAtom, "")
})

export const detachAtom = atom(null, (_get, set) => {
  set(attachmentAtom, null)
})

/* ── Overlay annotations: dismiss / reopen ─────────────── */

/** Collapse one open annotation back to its pin (L0). */
export const dismissMarkerAtom = atom(null, (get, set, markerKey: string) => {
  set(
    openBodiesAtom,
    get(openBodiesAtom).filter((key) => key !== markerKey)
  )
  if (get(openMarkerAtom) === markerKey) set(openMarkerAtom, null)
})

/** Reopen a dismissed annotation's body. */
export const reopenMarkerAtom = atom(null, (get, set, markerKey: string) => {
  const current = get(openBodiesAtom)
  if (!current.includes(markerKey)) set(openBodiesAtom, [...current, markerKey])
})

/** Comment pins toggle their body: pin ⇄ open. */
export const toggleCommentBodyAtom = atom(
  null,
  (get, set, markerKey: string) => {
    if (get(openBodiesAtom).includes(markerKey)) {
      set(dismissMarkerAtom, markerKey)
    } else {
      set(reopenMarkerAtom, markerKey)
    }
    set(hoverHintAtom, null)
  }
)

/** Dismiss all: every open body collapses and any expanded layer closes. */
export const dismissAllAtom = atom(null, (_get, set) => {
  set(openBodiesAtom, [])
  set(openMarkerAtom, null)
  set(sheetMarkerAtom, null)
  set(composerAtom, null)
  set(hoverHintAtom, null)
})

/** Reopen all: every review-comment body opens again. */
export const reopenAllAtom = atom(
  null,
  (_get, set, markerKeys: ReadonlyArray<string>) => {
    set(openBodiesAtom, [...markerKeys])
  }
)

/* ── Inline comments ───────────────────────────────────── */

/**
 * The gutter selection changed (pointer, keyboard or touch). One selection
 * exists across the desk; an open composer in the same file follows it, so
 * dragging in the gutter re-targets the comment live.
 */
export const selectLinesAtom = atom(
  null,
  (get, set, filePath: string, range: LineRange | null) => {
    const current = get(lineSelectionAtom)
    if (range === null) {
      // Another file clearing its own selection must not clear this one.
      if (current?.filePath === filePath) set(lineSelectionAtom, null)
      return
    }
    if (current?.filePath !== filePath || !rangeEquals(current.range, range)) {
      set(lineSelectionAtom, { filePath, range })
    }
    const composer = get(composerAtom)
    if (
      composer?.filePath === filePath &&
      !rangeEquals(composer.range, range)
    ) {
      set(composerAtom, { filePath, range })
    }
  }
)

export const clearSelectionAtom = atom(null, (_get, set) => {
  set(lineSelectionAtom, null)
})

/**
 * Open the composer on a range (the chip, Enter/C, the gutter "+", or a
 * Draft pin). It becomes the one expanded layer; a parked draft for the same
 * range comes back.
 */
export const openComposerAtom = atom(
  null,
  (get, set, target: ComposerTarget) => {
    const key = rangeKey(target.filePath, target.range)
    const parked = get(parkedDraftsAtom).find((draft) => draft.id === key)
    if (parked) {
      set(
        parkedDraftsAtom,
        get(parkedDraftsAtom).filter((draft) => draft.id !== key)
      )
      set(commentDraftAtom, parked.text)
    } else if (get(composerAtom) === null) {
      set(commentDraftAtom, "")
    }
    set(lineSelectionAtom, target)
    set(composerAtom, target)
    set(openMarkerAtom, null)
    set(sheetMarkerAtom, null)
    set(hoverHintAtom, null)
  }
)

/**
 * Escape (or an outside click): an empty composer cancels; one with text is
 * set aside under its range and collapses to a "Draft" pin.
 */
export const escapeComposerAtom = atom(null, (get, set) => {
  const composer = get(composerAtom)
  if (!composer) return
  const text = get(commentDraftAtom)
  if (text.trim()) {
    const id = rangeKey(composer.filePath, composer.range)
    set(parkedDraftsAtom, [
      ...get(parkedDraftsAtom).filter((draft) => draft.id !== id),
      { id, filePath: composer.filePath, range: composer.range, text },
    ])
  }
  set(closingComposerAtom, composer)
  set(composerAtom, null)
  set(commentDraftAtom, "")
  set(lineSelectionAtom, null)
})

/** Cancel: drop the draft, close the composer and the selection. */
export const discardCommentAtom = atom(null, (get, set) => {
  set(closingComposerAtom, get(composerAtom))
  set(composerAtom, null)
  set(commentDraftAtom, "")
  set(lineSelectionAtom, null)
})

export interface SaveCommentInput {
  unitId: string
  revision: string
  author: ReviewCommentAuthor
  anchor: ReviewCommentAnchor
}

/**
 * Persist the draft as a review comment record. The record becomes a
 * `review comment` marker on the next render (records → markers is derived):
 * the composer collapses into the new pin, and the selection clears.
 */
export const saveCommentAtom = atom(
  null,
  (get, set, input: SaveCommentInput) => {
    const body = get(commentDraftAtom).trim()
    if (!body) return null
    const record = createReviewCommentRecord({ ...input, body })
    set(get(reviewCommentRepositoryAtom).saveAtom, record)
    set(commentDraftAtom, "")
    set(closingComposerAtom, get(composerAtom))
    set(composerAtom, null)
    set(lineSelectionAtom, null)
    return record
  }
)
