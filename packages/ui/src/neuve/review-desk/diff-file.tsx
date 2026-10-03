import * as React from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { AnimatePresence } from "motion/react"
import { getOverlayBodySlotName, getOverlayPinSlotName } from "@workspace/diffs"
import type { DiffLineAnnotation } from "@workspace/diffs"

import { cn } from "@workspace/ui/lib/utils"
import {
  closeCardAtom,
  closingComposerAtom,
  commentDraftAtom,
  composerAtom,
  discardCommentAtom,
  dismissMarkerAtom,
  escapeComposerAtom,
  hoverHintAtom,
  isolatingAtom,
  lineSelectionAtom,
  openBodiesAtom,
  openComposerAtom,
  openMarkerAtom,
  openSheetAtom,
  parkedDraftsAtom,
  saveCommentAtom,
  selectLinesAtom,
  toggleCommentBodyAtom,
  toggleMarkerAtom,
} from "@workspace/ui/neuve/review-desk/atoms"
import {
  CommentBody,
  CommentComposer,
  ContextCard,
  DraftPin,
  HintBubble,
  type CommentPreview,
  MarginPin,
  SelectionChip,
} from "@workspace/ui/neuve/review-desk/context-margin"
import {
  anchorKey,
  displayRows,
  normalizeRange,
  rangeKey,
  rangeLabel,
  rangePhrase,
  rangeRows,
  toFileDiff,
} from "@workspace/ui/neuve/review-desk/diff-model"
import { DiffSurface } from "@workspace/ui/neuve/review-desk/diff-surface"
import { reviewCommentRepositoryAtom } from "@workspace/ui/neuve/review-comments/repository"
import type {
  ReviewCommentAuthor,
  ReviewCommentRecord,
} from "@workspace/ui/neuve/review-comments/record"
import type {
  ContextualMarker,
  DiffFile,
  LineRange,
  MarkerAnchor,
} from "@workspace/ui/neuve/types"

/** Overlay ids: the comment composer and the selection's commit chip. */
export const COMPOSER_ID = "composer"
export const SELECTION_ID = "selection"
const draftId = (id: string) => `draft:${id}`

/** Who is writing and against which unit and revision. */
export interface CommentContext {
  unitId: string
  revision: string
  author: ReviewCommentAuthor
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1)
}

/**
 * One changed file: header, the forked diff renderer, and its context margin
 * rendered as the renderer's overlay layer — pins, comment bodies, the L2
 * card, the selection chip, the composer, drafts and the one shared hint —
 * beside the code, never between its rows.
 *
 * Commenting is direct manipulation in the gutter (Pierre's line selection,
 * extended in the fork with keyboard and touch): select lines → a "Comment"
 * chip appears at the selection's last line → the composer opens at its
 * first line. Dragging in the gutter while composing re-targets it.
 */
export function DiffFileCard({
  file,
  markers,
  commentAnchors = [],
  comments = {},
  commentContext,
}: {
  file: DiffFile
  markers: Record<string, ContextualMarker>
  /** `review comment` markers placed in this file (derived from records). */
  commentAnchors?: ReadonlyArray<MarkerAnchor>
  /** Records behind those markers, by marker key (status, actions). */
  comments?: Record<string, ReviewCommentRecord>
  commentContext: CommentContext
}) {
  const open = useAtomValue(openMarkerAtom)
  const composer = useAtomValue(composerAtom)
  const closingComposer = useAtomValue(closingComposerAtom)
  const setClosingComposer = useSetAtom(closingComposerAtom)
  const selection = useAtomValue(lineSelectionAtom)
  const draft = useAtomValue(commentDraftAtom)
  const parked = useAtomValue(parkedDraftsAtom)
  const openBodies = useAtomValue(openBodiesAtom)
  const hint = useAtomValue(hoverHintAtom)
  const isolating = useAtomValue(isolatingAtom)
  const setHint = useSetAtom(hoverHintAtom)
  const toggleMarker = useSetAtom(toggleMarkerAtom)
  const toggleComment = useSetAtom(toggleCommentBodyAtom)
  const dismissMarker = useSetAtom(dismissMarkerAtom)
  const closeCard = useSetAtom(closeCardAtom)
  const openSheet = useSetAtom(openSheetAtom)
  const openComposer = useSetAtom(openComposerAtom)
  const escapeComposer = useSetAtom(escapeComposerAtom)
  const discardComment = useSetAtom(discardCommentAtom)
  const selectLines = useSetAtom(selectLinesAtom)
  const setDraft = useSetAtom(commentDraftAtom)
  const saveComment = useSetAtom(saveCommentAtom)
  const repository = useAtomValue(reviewCommentRepositoryAtom)
  const setStatus = useSetAtom(repository.setStatusAtom)

  const fileDiff = toFileDiff(file, commentContext.revision)
  const rows = displayRows(fileDiff, file)
  const composing = composer?.filePath === file.path ? composer : null
  // Keep the composer's overlay item while its exit motion plays.
  const composerSlot =
    composing ??
    (closingComposer?.filePath === file.path ? closingComposer : null)
  const selected =
    selection?.filePath === file.path && !composing ? selection.range : null
  const drafts = parked.filter((d) => d.filePath === file.path)

  const anchors = React.useMemo(
    () => [...file.markerAnchors, ...commentAnchors],
    [file.markerAnchors, commentAnchors]
  )

  const annotations = React.useMemo<Array<DiffLineAnnotation>>(() => {
    const list: Array<DiffLineAnnotation> = anchors.map((anchor) => ({
      id: anchor.markerKey,
      side: anchor.side,
      lineNumber: anchor.lineNumber,
    }))
    for (const d of drafts) {
      list.push({
        id: draftId(d.id),
        side: d.range.side,
        lineNumber: d.range.start,
      })
    }
    if (composerSlot) {
      // The composer sits on the selection's first line.
      list.push({
        id: COMPOSER_ID,
        side: composerSlot.range.side,
        lineNumber: composerSlot.range.start,
      })
    }
    if (!composing && selected) {
      // The commit chip sits on the selection's last line.
      list.push({
        id: SELECTION_ID,
        side: selected.endSide ?? selected.side,
        lineNumber: selected.end,
      })
    }
    return list
  }, [anchors, drafts, composerSlot, composing, selected])

  const openHere =
    open !== null && anchors.some((a) => a.markerKey === open)
      ? open
      : undefined

  // Comment ↔ code linkage: a pointed-at comment pin tints its lines lightly;
  // the most recently opened comment in this file tints them fully.
  const rangeOf = (key: string) =>
    anchors.find((anchor) => anchor.markerKey === key)?.range
  const hintRange =
    hint?.filePath === file.path ? rangeOf(hint.markerKey) : undefined
  const openRange = [...openBodies]
    .reverse()
    .map((key) => rangeOf(key))
    .find((range) => range !== undefined)
  const highlight: { range: LineRange; tone: "strong" | "hint" } | undefined =
    composing
      ? undefined
      : hintRange
        ? { range: hintRange, tone: "hint" }
        : openRange
          ? { range: openRange, tone: "strong" }
          : undefined

  const overlay = {
    // The L2 card stays expanded under an L3 sheet ("Back to unit" returns
    // to it); the composer is the expanded layer while it is open.
    expandedId: composing ? COMPOSER_ID : openHere,
    // Review-comment bodies are collapsed to their pin unless opened.
    dismissedIds: anchors
      .map((anchor) => anchor.markerKey)
      .filter((key) => !openBodies.includes(key)),
    // Isolation spans files: a layer expanded in another file dims this one.
    isolated: isolating && !composing && !openHere,
    hintId:
      hint && hint.filePath === file.path && !isolating
        ? hint.markerKey
        : undefined,
    highlight,
  }
  const hintMarker = overlay.hintId ? markers[overlay.hintId] : undefined

  const onSelectLines = React.useCallback(
    (range: LineRange | null) =>
      selectLines(
        file.path,
        range ? (normalizeRange(rows, range) ?? range) : null
      ),
    [selectLines, file.path, rows]
  )
  const onCommitLines = React.useCallback(
    (range: LineRange) =>
      openComposer({
        filePath: file.path,
        range: normalizeRange(rows, range) ?? range,
      }),
    [openComposer, file.path, rows]
  )

  function save() {
    if (!composing) return
    const covered = rangeRows(rows, composing.range)
    const first = covered[0]
    saveComment({
      ...commentContext,
      anchor: {
        filePath: file.path,
        range: composing.range,
        hunk: {
          index: first?.hunkIndex ?? 0,
          header: first?.hunkHeader ?? "",
        },
        lines:
          covered.length > 0
            ? covered.map((row) => ({
                side: row.kind === "deletion" ? "deletions" : "additions",
                lineNumber:
                  (row.kind === "deletion" ? row.oldLine : row.newLine) ?? 0,
                text: row.text,
              }))
            : [
                {
                  side: composing.range.side,
                  lineNumber: composing.range.start,
                  text: "",
                },
              ],
      },
    })
  }

  return (
    // While composing here, the file sits above the dismiss layer so the
    // gutter stays live (dragging re-targets the comment); everywhere else an
    // outside click still closes the composer.
    <div className={cn("flex items-start gap-4", composing && "relative z-12")}>
      <div className="min-w-0 flex-auto rounded-[10px] bg-surface shadow-[0_0_0_1px_var(--nv-line)]">
        <div className="box-border flex h-11 items-center gap-2.5 border-b border-line-2 px-3.5">
          <span className="min-w-0 truncate font-mono text-[12.5px]">
            {file.path}
          </span>
          <span className="font-mono text-[11.5px] text-add-fg">
            +{file.additions}
          </span>
          <span className="font-mono text-[11.5px] text-del-fg">
            −{file.deletions}
          </span>
        </div>
        <DiffSurface
          label={`Changes in ${file.path}. Line numbers select lines to comment on.`}
          fileDiff={fileDiff}
          annotations={annotations}
          overlay={overlay}
          selection={composing ? composing.range : selected}
          onSelectLines={onSelectLines}
          onCommitLines={onCommitLines}
        >
          {anchors.map((anchor) => {
            const marker = markers[anchor.markerKey]
            if (!marker) return null
            const isComment = marker.sourceKind === "review comment"
            const bodyOpen = openBodies.includes(marker.key)
            const record = comments[marker.key]
            const cardOpen = !isComment && open === marker.key
            return (
              <React.Fragment key={marker.key}>
                <div
                  slot={getOverlayPinSlotName(marker.key)}
                  className="contents"
                >
                  <MarginPin
                    marker={marker}
                    rangeLabel={
                      anchor.range ? rangeLabel(anchor.range) : undefined
                    }
                    on={isComment ? bodyOpen : cardOpen}
                    className={
                      record?.status === "resolved"
                        ? "opacity-55"
                        : undefined
                    }
                    disabled={isolating && overlay.expandedId !== marker.key}
                    data-anchor={anchorKey(anchor.side, anchor.lineNumber)}
                    data-marker-key={marker.key}
                    onToggle={() =>
                      isComment
                        ? toggleComment(marker.key)
                        : toggleMarker(marker.key)
                    }
                    onHintStart={() =>
                      setHint({ filePath: file.path, markerKey: marker.key })
                    }
                    onHintEnd={() =>
                      setHint((current) =>
                        current?.markerKey === marker.key ? null : current
                      )
                    }
                  />
                </div>
                <div
                  slot={
                    isComment
                      ? getOverlayBodySlotName(marker.key)
                      : getOverlayPinSlotName(marker.key)
                  }
                  className={
                    isComment ? "block" : "absolute top-[30px] left-0 z-1"
                  }
                >
                  <AnimatePresence initial={false}>
                    {isComment && bodyOpen && (
                      <CommentBody
                        key="body"
                        marker={marker}
                        status={record?.status ?? "open"}
                        onDismiss={() => {
                          dismissMarker(marker.key)
                          // Keep keyboard users where they were: on the pin
                          // the body collapsed back into.
                          document
                            .querySelector<HTMLElement>(
                              `button[data-marker-key="${CSS.escape(marker.key)}"]`
                            )
                            ?.focus()
                        }}
                        onToggleStatus={() =>
                          record &&
                          setStatus(
                            record.id,
                            record.status === "open" ? "resolved" : "open"
                          )
                        }
                      />
                    )}
                    {cardOpen && (
                      <ContextCard
                        key="card"
                        marker={marker}
                        onClose={closeCard}
                        onOpenSource={openSheet}
                      />
                    )}
                  </AnimatePresence>
                </div>
              </React.Fragment>
            )
          })}
          {drafts.map((d) => (
            <div
              key={d.id}
              slot={getOverlayPinSlotName(draftId(d.id))}
              className="contents"
            >
              <DraftPin
                label={rangeLabel(d.range)}
                excerpt={d.text}
                disabled={isolating}
                onOpen={() =>
                  openComposer({ filePath: file.path, range: d.range })
                }
              />
            </div>
          ))}
          <div slot={getOverlayPinSlotName(SELECTION_ID)} className="contents">
            <AnimatePresence>
              {selected && (
                <SelectionChip
                  key="chip"
                  label={rangeLabel(selected)}
                  onOpen={() =>
                    openComposer({ filePath: file.path, range: selected })
                  }
                />
              )}
            </AnimatePresence>
          </div>
          <div slot={getOverlayBodySlotName(COMPOSER_ID)} className="block">
            <AnimatePresence onExitComplete={() => setClosingComposer(null)}>
              {composing && (
                <CommentComposer
                  key="composer"
                  anchorLabel={`${basename(file.path)} · ${rangePhrase(composing.range)}`}
                  placeholder={`Comment on ${rangePhrase(composing.range)}`}
                  draft={draft}
                  onDraft={setDraft}
                  onSave={save}
                  onCancel={discardComment}
                  onEscape={escapeComposer}
                />
              )}
            </AnimatePresence>
          </div>
          {hintMarker && (
            <div slot="overlay-hint" className="block">
              <HintBubble
                key={hintMarker.key}
                text={hintMarker.peek}
                comment={commentPreview(hintMarker, hintRange)}
              />
            </div>
          )}
        </DiffSurface>
      </div>
      <div
        aria-hidden="true"
        className="shrink-0 grow-0 basis-[268px] self-stretch max-[1180px]:basis-[220px] max-[860px]:hidden"
      />
    </div>
  )
}

/** Exposed for stories: the range key a parked draft is stored under. */
export { rangeKey }

/** Hint preview for a review comment: author and lines. */
function commentPreview(
  marker: ContextualMarker,
  range: LineRange | undefined
): CommentPreview | undefined {
  if (marker.sourceKind !== "review comment") return undefined
  return {
    author: marker.title.replace(/ commented$/, ""),
    initials: marker.short,
    range: range ? rangeLabel(range) : undefined,
  }
}
