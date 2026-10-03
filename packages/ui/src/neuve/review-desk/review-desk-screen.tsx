import * as React from "react"
import { Provider, useAtomValue, useSetAtom, useStore } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import { MotionConfig } from "motion/react"
import { CheckCheckIcon } from "lucide-react"
import { Virtualizer } from "@workspace/diffs"

import { Briefing } from "@workspace/ui/neuve/review-desk/briefing"
import { DecisionDock } from "@workspace/ui/neuve/review-desk/decision-dock"
import { DiffFileCard } from "@workspace/ui/neuve/review-desk/diff-file"
import { ReadOnlyNeighbor } from "@workspace/ui/neuve/review-desk/read-only-neighbor"
import { ReviewHeader } from "@workspace/ui/neuve/review-desk/review-header"
import { SourceSheet } from "@workspace/ui/neuve/review-desk/source-sheet"
import { UnitRail } from "@workspace/ui/neuve/review-desk/unit-rail"
import { Segmented } from "@workspace/ui/neuve/shared/segmented"
import { Button } from "@workspace/ui/components/button"
import {
  approveAtom,
  clearSelectionAtom,
  closeExpandedAtom,
  escapeComposerAtom,
  lineSelectionAtom,
  commentRepositoryHydration,
  composerAtom,
  diffVirtualizerAtom,
  dismissAllAtom,
  openBodiesAtom,
  dockAtom,
  isolatingAtom,
  openMarkerAtom,
  reopenAllAtom,
  reviewDeskHydration,
  sendChangesAtom,
  sheetMarkerAtom,
  showResolvedAtom,
} from "@workspace/ui/neuve/review-desk/atoms"
import type { ReviewDeskState } from "@workspace/ui/neuve/review-desk/atoms"
import { commentMarkersForUnit } from "@workspace/ui/neuve/review-comments/markers"
import { reviewCommentRepositoryAtom } from "@workspace/ui/neuve/review-comments/repository"
import type { ReviewCommentRepository } from "@workspace/ui/neuve/review-comments/repository"
import type { ReviewCommentRecord } from "@workspace/ui/neuve/review-comments/record"
import type { ReviewDeskData } from "@workspace/ui/neuve/types"

export interface ReviewDeskScreenProps {
  data: ReviewDeskData
  /** Seed interaction state (stories, deep links). Defaults to rest. */
  initialState?: Partial<ReviewDeskState>
  /**
   * Where inline review comments are stored. Defaults to the browser-local
   * repository; stories pass a memory or story-scoped one.
   */
  commentRepository?: ReviewCommentRepository
}

/** ⌘↵ / Ctrl↵ decides; Escape closes an isolating card. */
function useDeskShortcuts() {
  const store = useStore()
  // Effect: subscribes to document keyboard events (an external system), per "You Might Not Need an Effect".
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        // The comment composer owns ⌘↵ (save) while it is open.
        if (store.get(composerAtom) !== null) return
        const dock = store.get(dockAtom)
        if (dock === "rest") {
          event.preventDefault()
          store.set(approveAtom)
        } else if (dock === "composing") {
          event.preventDefault()
          store.set(sendChangesAtom)
        }
        return
      }
      if (event.key !== "Escape") return
      // One layer per Escape: composer (cancel or park the draft), then an
      // open card, then the gutter selection.
      if (store.get(composerAtom) !== null) {
        store.set(escapeComposerAtom)
      } else if (
        store.get(openMarkerAtom) !== null &&
        store.get(sheetMarkerAtom) === null
      ) {
        store.set(closeExpandedAtom)
      } else if (store.get(lineSelectionAtom) !== null) {
        store.set(clearSelectionAtom)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [store])
}

/**
 * Full-viewport click catcher under the one expanded layer (an L2 card or the
 * comment composer): an outside click closes it, nothing underneath reacts.
 */
function DismissLayer() {
  const isolating = useAtomValue(isolatingAtom)
  const closeExpanded = useSetAtom(closeExpandedAtom)
  if (!isolating) return null
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label="Close context"
      onClick={closeExpanded}
      className="fixed inset-0 z-11 m-0 cursor-default border-0 bg-transparent p-0"
    />
  )
}

/**
 * Records → `review comment` markers for this unit and revision, merged with
 * the retrieved markers, so every surface (margin, dock attachment, source
 * sheet) sees one marker map.
 */
function useUnitMarkers(data: ReviewDeskData) {
  const repository = useAtomValue(reviewCommentRepositoryAtom)
  const allRecords = useAtomValue(repository.recordsAtom)
  const showResolved = useAtomValue(showResolvedAtom)
  return React.useMemo(() => {
    const unitRecords = allRecords.filter((r) => r.unitId === data.unit.id)
    const resolvedCount = unitRecords.filter(
      (r) => r.status === "resolved"
    ).length
    // Less is more: resolved comments leave the margin until asked for.
    const records = showResolved
      ? unitRecords
      : unitRecords.filter((r) => r.status !== "resolved")
    const comments = commentMarkersForUnit(
      records,
      data.unit.id,
      data.revision,
      data.files
    )
    const byMarker: Record<string, ReviewCommentRecord> = {}
    for (const record of records) {
      const key = Object.keys(comments.markers).find(
        (k) => comments.markers[k]?.trace?.commentId === record.id
      )
      if (key) byMarker[key] = record
    }
    return {
      markers: { ...data.markers, ...comments.markers },
      commentAnchors: comments.anchors,
      commentRecords: byMarker,
      unplaced: comments.unplaced,
      resolvedCount,
    }
  }, [allRecords, showResolved, data])
}

/**
 * Dismiss every open annotation at once (comment bodies and any expanded
 * layer), or reopen every review-comment body.
 */
function OverlayToggle({
  commentKeys,
}: {
  commentKeys: ReadonlyArray<string>
}) {
  const openBodies = useAtomValue(openBodiesAtom)
  const expanded = useAtomValue(isolatingAtom)
  const dismissAll = useSetAtom(dismissAllAtom)
  const reopenAll = useSetAtom(reopenAllAtom)
  const anyOpen = openBodies.length > 0 || expanded
  return (
    <Button
      type="button"
      variant="quiet"
      size="compact"
      disabled={!anyOpen && commentKeys.length === 0}
      onClick={() => (anyOpen ? dismissAll() : reopenAll(commentKeys))}
    >
      {anyOpen ? "Dismiss all" : "Show comments"}
    </Button>
  )
}

/**
 * Resolved comments are hidden by default; this reveals them (muted) and
 * hides them again. Absent when the unit has none.
 */
function ResolvedToggle({ count }: { count: number }) {
  const showResolved = useAtomValue(showResolvedAtom)
  const setShowResolved = useSetAtom(showResolvedAtom)
  if (count === 0) return null
  return (
    <Button
      type="button"
      variant="quiet"
      size="compact"
      aria-pressed={showResolved}
      onClick={() => setShowResolved(!showResolved)}
    >
      <CheckCheckIcon aria-hidden="true" className="size-3.5" />
      {showResolved ? "Hide resolved" : `${count} resolved`}
    </Button>
  )
}

/**
 * The unit column's scroll container hosts the diff Virtualizer: only rows
 * near the viewport render, and the overlay layer stays aligned because it
 * lives inside each diff host and scrolls with it.
 */
function useVirtualizerRoot() {
  const setVirtualizer = useSetAtom(diffVirtualizerAtom)
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  // Effect: connects the diff Virtualizer (an external system) to the scroll root; parent effects run after children subscribe, so they see it.
  React.useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const virtualizer = new Virtualizer()
    virtualizer.setup(root)
    setVirtualizer(virtualizer)
    return () => {
      setVirtualizer("pending")
      virtualizer.cleanUp()
    }
  }, [setVirtualizer])
  return rootRef
}

function ReviewDesk({
  data,
  initialState = {},
  commentRepository,
}: ReviewDeskScreenProps) {
  useHydrateAtoms(reviewDeskHydration(initialState))
  useHydrateAtoms(commentRepositoryHydration(commentRepository))
  useHydrateAtoms([[diffVirtualizerAtom, "pending"]] as const)
  useDeskShortcuts()
  const scrollRoot = useVirtualizerRoot()
  const { markers, commentAnchors, commentRecords, resolvedCount } =
    useUnitMarkers(data)
  const commentContext = React.useMemo(
    () => ({
      unitId: data.unit.id,
      revision: data.revision,
      author: data.reviewer,
    }),
    [data.unit.id, data.revision, data.reviewer]
  )

  return (
    <div className="flex min-h-svh flex-col bg-paper font-sans text-sm text-ink min-[861px]:h-svh">
      <ReviewHeader data={data} />
      {/* App shell from 861px: rail and unit column scroll independently, so
          the source sheet and its scrim cover exactly the unit column. */}
      <div className="flex flex-auto flex-wrap items-stretch min-[861px]:min-h-0 min-[861px]:flex-nowrap">
        <UnitRail data={data} />
        <main className="relative flex min-w-0 flex-[999_1_560px] flex-col">
          <div
            ref={scrollRoot}
            className="flex flex-auto flex-col min-[861px]:absolute min-[861px]:inset-0 min-[861px]:overflow-y-auto"
          >
            <Briefing unit={data.unit} />
            <div className="flex flex-wrap items-center gap-4 px-8 pb-3">
              <Segmented
                label="Diff layout"
                options={["Stacked", "Split"]}
                value="Stacked"
              />
              <span className="font-mono text-[11.5px] text-ink-muted">
                {data.unit.stats}
              </span>
              <span className="flex-auto" />
              <ResolvedToggle count={resolvedCount} />
              <OverlayToggle
                commentKeys={Object.keys(markers).filter(
                  (key) => markers[key]?.sourceKind === "review comment"
                )}
              />
            </div>
            <DismissLayer />
            <div className="flex flex-col gap-5 px-8 pb-10">
              {data.files.map((file) => (
                <DiffFileCard
                  key={file.path}
                  file={file}
                  markers={markers}
                  commentAnchors={commentAnchors[file.path]}
                  comments={commentRecords}
                  commentContext={commentContext}
                />
              ))}
              <ReadOnlyNeighbor neighbor={data.neighbor} />
            </div>
            <DecisionDock unit={data.unit} markers={markers} />
          </div>
          <SourceSheet markers={markers} />
        </main>
      </div>
    </div>
  )
}

/**
 * Review desk — one review unit with its briefing, diff, context margin
 * (L0–L3 disclosure), read-only neighbor and decision dock.
 *
 * Owns a jotai Provider so every instance (route or story) has isolated
 * interaction state. MotionConfig honours the OS reduced-motion setting for
 * every motion component below.
 */
export function ReviewDeskScreen(props: ReviewDeskScreenProps) {
  return (
    <Provider>
      <MotionConfig reducedMotion="user">
        <ReviewDesk {...props} />
      </MotionConfig>
    </Provider>
  )
}
