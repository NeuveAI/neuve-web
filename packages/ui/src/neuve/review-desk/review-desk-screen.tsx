import * as React from "react"
import { Provider, useAtomValue, useSetAtom, useStore } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import { MotionConfig } from "motion/react"
import {
  CheckCheckIcon,
  Columns2Icon,
  Rows2Icon,
  WrapTextIcon,
} from "lucide-react"
import { Virtualizer } from "@workspace/diffs"

import { Toggle } from "@workspace/ui/components/toggle"
import { agentsHydration } from "@workspace/ui/neuve/agents/atoms"
import type { AgentConnector } from "@workspace/ui/neuve/agents/atoms"
import { NewCommitNotice } from "@workspace/ui/neuve/cycle/new-commit-notice"
import { Briefing } from "@workspace/ui/neuve/review-desk/briefing"
import { DecisionDock } from "@workspace/ui/neuve/review-desk/decision-dock"
import { DiffFileCard } from "@workspace/ui/neuve/review-desk/diff-file"
import { GeneratedDiff } from "@workspace/ui/neuve/review-desk/generated-diff"
import { ReadOnlyNeighbor } from "@workspace/ui/neuve/review-desk/read-only-neighbor"
import { SourceSheet } from "@workspace/ui/neuve/review-desk/source-sheet"
import { UnitRail } from "@workspace/ui/neuve/review-desk/unit-rail"
import { AppHeader } from "@workspace/ui/neuve/shared/app-header"
import { Segmented } from "@workspace/ui/neuve/shared/segmented"
import { Button } from "@workspace/ui/components/button"
import {
  approveAtom,
  browseModeAtom,
  clearSelectionAtom,
  closeExpandedAtom,
  diffLayoutAtom,
  draftAtom,
  effectiveLayoutAtom,
  SPLIT_MIN_WIDTH,
  splitFitsAtom,
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
  railHydration,
  reopenAllAtom,
  reviewDeskHydration,
  sendChangesAtom,
  sendUnitCommentAtom,
  sheetMarkerAtom,
  showResolvedAtom,
  startChangesAtom,
  toggleRailAtom,
  wrapAtom,
} from "@workspace/ui/neuve/review-desk/atoms"
import type { ReviewDeskState } from "@workspace/ui/neuve/review-desk/atoms"
import { commentMarkersForUnit } from "@workspace/ui/neuve/review-comments/markers"
import { reviewCommentRepositoryAtom } from "@workspace/ui/neuve/review-comments/repository"
import type { ReviewCommentRepository } from "@workspace/ui/neuve/review-comments/repository"
import type { ReviewCommentRecord } from "@workspace/ui/neuve/review-comments/record"
import type { ThreadEventSource } from "@workspace/ui/neuve/review-comments/thread"
import {
  applyThreadEventAtom,
  threadsHydration,
} from "@workspace/ui/neuve/review-comments/threads"
import type {
  ContextualMarker,
  DiffFile,
  MarkerCheckAction,
  ReviewDeskData,
  ReviewLane,
} from "@workspace/ui/neuve/types"

export interface ReviewDeskScreenProps {
  data: ReviewDeskData
  /** Seed interaction state (stories, deep links). Defaults to rest. */
  initialState?: Partial<ReviewDeskState>
  /**
   * Where inline review comments are stored. Defaults to the browser-local
   * repository; stories pass a memory or story-scoped one.
   */
  commentRepository?: ReviewCommentRepository
  /**
   * The relay comment threads listen to (ACP through the harness later; a
   * scripted mock in stories). Without one, threads show what they hold.
   */
  threadEvents?: ThreadEventSource
  /** Connects agents from the header (a local mock by default). */
  agentConnector?: AgentConnector
}

/** True while typing, so single-key shortcuts ("[") stay out of the way. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  )
}

/**
 * Desk shortcuts: ⌘↵ / Ctrl↵ decides (human-required) or sends the open
 * composer; Escape closes one layer; "[" collapses or expands the rail.
 */
function useDeskShortcuts(lane: ReviewLane) {
  const store = useStore()
  // Effect: subscribes to document keyboard events (an external system), per "You Might Not Need an Effect".
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.key === "[" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isTyping(event.target)
      ) {
        event.preventDefault()
        store.set(toggleRailAtom)
        return
      }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        // The comment composer owns ⌘↵ (save) while it is open.
        if (store.get(composerAtom) !== null) return
        const dock = store.get(dockAtom)
        if (dock === "rest" && lane === "human-required") {
          event.preventDefault()
          store.set(approveAtom)
        } else if (dock === "composing") {
          event.preventDefault()
          if (lane === "human-required" || lane === "human-suggested") {
            store.set(sendChangesAtom)
          } else {
            store.set(sendUnitCommentAtom)
          }
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
  }, [store, lane])
}

/** Applies the relay's thread events, in order, while the desk is mounted. */
function useThreadEvents(source: ThreadEventSource | undefined) {
  const apply = useSetAtom(applyThreadEventAtom)
  // Effect: subscribes to the thread relay (an external event stream: ACP through the harness, or a story's mock).
  React.useEffect(() => {
    if (!source) return
    return source.subscribe((event) => apply(event))
  }, [source, apply])
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

/** One unit's review comments as markers for the given files. */
function unitComments(
  records: ReadonlyArray<ReviewCommentRecord>,
  unitId: string,
  revision: string,
  files: ReadonlyArray<DiffFile>,
  showResolved: boolean
) {
  const unitRecords = records.filter((r) => r.unitId === unitId)
  const resolvedCount = unitRecords.filter(
    (r) => r.status === "resolved"
  ).length
  // Less is more: resolved comments leave the margin until asked for.
  const shown = showResolved
    ? unitRecords
    : unitRecords.filter((r) => r.status !== "resolved")
  const comments = commentMarkersForUnit(shown, unitId, revision, files)
  const byMarker: Record<string, ReviewCommentRecord> = {}
  for (const record of shown) {
    const key = Object.keys(comments.markers).find(
      (k) => comments.markers[k]?.trace?.commentId === record.id
    )
    if (key) byMarker[key] = record
  }
  return {
    markers: comments.markers,
    anchors: comments.anchors,
    records: byMarker,
    resolvedCount,
  }
}

/**
 * Records → `review comment` markers for this unit and revision, merged with
 * the retrieved markers, so every surface (margin, rail, dock attachment,
 * source sheet) sees one marker map. The read-only neighbor's comments
 * belong to its own unit and stay separate.
 */
function useUnitMarkers(data: ReviewDeskData) {
  const repository = useAtomValue(reviewCommentRepositoryAtom)
  const allRecords = useAtomValue(repository.recordsAtom)
  const showResolved = useAtomValue(showResolvedAtom)
  return React.useMemo(() => {
    const generated = data.unit.attribution?.generatedDiff?.file
    const unit = unitComments(
      allRecords,
      data.unit.id,
      data.revision,
      generated ? [...data.files, generated] : data.files,
      showResolved
    )
    const neighbor = data.neighbor
      ? unitComments(
          allRecords,
          data.neighbor.unitId,
          data.revision,
          [data.neighbor.file],
          showResolved
        )
      : undefined
    return {
      markers: { ...data.markers, ...unit.markers },
      commentAnchors: unit.anchors,
      commentRecords: unit.records,
      resolvedCount: unit.resolvedCount + (neighbor?.resolvedCount ?? 0),
      neighbor,
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

/**
 * Measures the unit column (not the viewport): below SPLIT_MIN_WIDTH, Split
 * falls back to Stacked. A ref callback owns the ResizeObserver, so no
 * effect is needed.
 */
function useSplitFit() {
  const setFits = useSetAtom(splitFitsAtom)
  return React.useCallback(
    (column: HTMLElement | null) => {
      if (!column || typeof ResizeObserver === "undefined") return
      const observer = new ResizeObserver(([entry]) => {
        if (entry) setFits(entry.contentRect.width >= SPLIT_MIN_WIDTH)
      })
      observer.observe(column)
      return () => observer.disconnect()
    },
    [setFits]
  )
}

/** Units / Files tabs at the top of the unit column. */
function BrowseTabs() {
  const mode = useAtomValue(browseModeAtom)
  return (
    <div role="tablist" aria-label="Browse by" className="flex gap-1 px-8 pt-4">
      {(["units", "files"] as const).map((tab) => {
        const selected = mode === tab
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={selected}
            // The Files view is not designed yet; the tab is shown, inert.
            aria-disabled={tab === "files" ? true : undefined}
            title={
              tab === "files" ? "Files view comes in a later round" : undefined
            }
            className={
              selected
                ? "h-[30px] rounded-[7px] border-0 bg-raised px-3 text-[13px] font-medium text-ink"
                : "h-[30px] cursor-default rounded-[7px] border-0 bg-transparent px-3 text-[13px] text-ink-muted"
            }
          >
            {tab === "units" ? "Units" : "Files"}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Stacked / Split and Wrap: Pierre's own diffStyle and overflow options.
 * When the column is too narrow for Split, the toggle shows Stacked with
 * Split unavailable and says why; widening the column restores Split.
 */
function DiffToolbarControls() {
  const layout = useAtomValue(diffLayoutAtom)
  const effective = useAtomValue(effectiveLayoutAtom)
  const fits = useAtomValue(splitFitsAtom)
  const setLayout = useSetAtom(diffLayoutAtom)
  const wrap = useAtomValue(wrapAtom)
  const setWrap = useSetAtom(wrapAtom)
  const fallback = layout === "split" && effective === "stacked"
  return (
    <>
      <Segmented
        label="Diff layout"
        options={[
          { value: "stacked", label: "Stacked", icon: Rows2Icon },
          {
            value: "split",
            label: "Split",
            icon: Columns2Icon,
            disabled: !fits,
            description: fits ? undefined : "Split needs a column of 980px",
          },
        ]}
        value={effective}
        onValueChange={setLayout}
      />
      <Toggle
        pressed={wrap}
        onPressedChange={setWrap}
        aria-label="Wrap long lines"
        className="h-[30px] gap-1.5 rounded-[7px] px-2.5 text-[12.5px] font-normal text-ink-muted hover:bg-raised hover:text-ink data-[state=on]:bg-raised data-[state=on]:text-ink"
      >
        <WrapTextIcon aria-hidden="true" className="size-3.5" />
        Wrap
      </Toggle>
      {!fits && (
        <span
          role="status"
          data-split-fallback={fallback ? "" : undefined}
          className="font-mono text-[11px] text-faint"
        >
          {fallback ? "Split shows as stacked below 980px" : "Split from 980px"}
        </span>
      )}
    </>
  )
}

function ReviewDesk({
  data,
  initialState = {},
  commentRepository,
  threadEvents,
  agentConnector,
}: ReviewDeskScreenProps) {
  // A unit outside the human-required lane opens its rail lane group.
  useHydrateAtoms(
    reviewDeskHydration({
      openLanes: data.unit.lane === "human-required" ? [] : [data.unit.lane],
      ...initialState,
    })
  )
  useHydrateAtoms(railHydration(initialState))
  useHydrateAtoms(commentRepositoryHydration(commentRepository))
  useHydrateAtoms(threadsHydration(data.threads, threadEvents))
  useHydrateAtoms(agentsHydration(data.agents, agentConnector))
  useHydrateAtoms([[diffVirtualizerAtom, "pending"]] as const)
  useDeskShortcuts(data.unit.lane)
  useThreadEvents(threadEvents)
  const scrollRoot = useVirtualizerRoot()
  const measureColumn = useSplitFit()
  const startChanges = useSetAtom(startChangesAtom)
  const setDraft = useSetAtom(draftAtom)
  const { markers, commentAnchors, commentRecords, resolvedCount, neighbor } =
    useUnitMarkers(data)
  const commentContext = React.useMemo(
    () => ({
      unitId: data.unit.id,
      revision: data.revision,
      author: data.reviewer,
      agentId: data.unit.agentId,
    }),
    [data.unit.id, data.revision, data.reviewer, data.unit.agentId]
  )
  // "Ask the implementer" / "Request a check": a change request for this
  // unit with the marker attached (it goes to the implementer).
  const onCheckAction = React.useCallback(
    (marker: ContextualMarker, action: MarkerCheckAction) => {
      startChanges(marker.key)
      if (action.kind === "request-check" && marker.check) {
        setDraft(`Please add a check: ${marker.check}`)
      }
    },
    [startChanges, setDraft]
  )
  const commentKeys = [
    ...Object.keys(markers),
    ...Object.keys(neighbor?.markers ?? {}),
  ].filter(
    (key) =>
      (markers[key] ?? neighbor?.markers[key])?.sourceKind === "review comment"
  )

  return (
    <div className="flex min-h-svh flex-col bg-paper font-sans text-sm text-ink min-[861px]:h-svh">
      <AppHeader repo={data.repo} branch={data.branch} commit={data.revision} />
      {/* App shell from 861px: rail and unit column scroll independently, so
          the source sheet and its scrim cover exactly the unit column. */}
      <div className="flex flex-auto flex-wrap items-stretch min-[861px]:min-h-0 min-[861px]:flex-nowrap">
        <UnitRail data={data} markers={markers} />
        <main
          ref={measureColumn}
          className="relative flex min-w-0 flex-[999_1_560px] flex-col"
        >
          <div
            ref={scrollRoot}
            className="flex flex-auto flex-col min-[861px]:absolute min-[861px]:inset-0 min-[861px]:overflow-y-auto"
          >
            <BrowseTabs />
            <Briefing unit={data.unit} />
            {data.files.length > 0 && (
              <div className="flex flex-wrap items-center gap-4 px-8 pb-3">
                <DiffToolbarControls />
                <span className="font-mono text-[11.5px] text-ink-muted">
                  {data.unit.stats}
                </span>
                <span className="flex-auto" />
                <ResolvedToggle count={resolvedCount} />
                <OverlayToggle commentKeys={commentKeys} />
              </div>
            )}
            <DismissLayer />
            <div className="flex flex-col gap-5 px-8 pb-10">
              {data.unit.attribution?.generatedDiff && (
                <GeneratedDiff
                  label={data.unit.attribution.generatedDiff.label}
                  file={data.unit.attribution.generatedDiff.file}
                  markers={markers}
                  commentAnchors={
                    commentAnchors[
                      data.unit.attribution.generatedDiff.file.path
                    ]
                  }
                  comments={commentRecords}
                  commentContext={commentContext}
                />
              )}
              {data.files.map((file) => (
                <DiffFileCard
                  key={file.path}
                  file={file}
                  markers={markers}
                  commentAnchors={commentAnchors[file.path]}
                  comments={commentRecords}
                  commentContext={commentContext}
                  onCheckAction={onCheckAction}
                />
              ))}
              {data.neighbor && (
                <ReadOnlyNeighbor
                  neighbor={data.neighbor}
                  markers={neighbor?.markers}
                  commentAnchors={neighbor?.anchors[data.neighbor.file.path]}
                  comments={neighbor?.records}
                  commentContext={commentContext}
                />
              )}
            </div>
            <DecisionDock unit={data.unit} markers={markers} />
          </div>
          {data.newCommit && <NewCommitNotice event={data.newCommit} />}
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
