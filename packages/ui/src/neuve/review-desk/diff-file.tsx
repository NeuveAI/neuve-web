import * as React from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { getOverlayBodySlotName, getOverlayPinSlotName } from "@workspace/diffs"
import type { DiffLineAnnotation } from "@workspace/diffs"

import { cn } from "@workspace/ui/lib/utils"
import { EASE, REDUCED_TRANSITION, TIMING, ms } from "@workspace/ui/lib/motion"
import {
  closeCardAtom,
  closingComposerAtom,
  commentDraftAtom,
  composerAtom,
  discardCommentAtom,
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
  toggleMarkerAtom,
} from "@workspace/ui/neuve/review-desk/atoms"
import {
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
import {
  CommentPreviewCard,
  ThreadCard,
} from "@workspace/ui/neuve/review-desk/thread-card"
import { reviewThreadsAtom } from "@workspace/ui/neuve/review-comments/threads"
import type { DiffVariant } from "@workspace/ui/lib/diffs"
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
  MarkerCheckAction,
  NeighborContextNote,
} from "@workspace/ui/neuve/types"

/** Overlay ids: the comment composer and the selection's commit chip. */
export const COMPOSER_ID = "composer"
export const SELECTION_ID = "selection"
const draftId = (id: string) => `draft:${id}`
const noteId = (key: string) => `note:${key}`

/** A collapsed file's code rising in (read-only neighbor). */
const RISE = {
  offsetY: 8, // px the rows rise from
  initialScale: 0.98,
  enter: { duration: ms(TIMING.dockRise), ease: EASE.emphasizedDecelerate },
  exit: { duration: ms(TIMING.dockExit), ease: EASE.emphasizedAccelerate },
} as const

/** Who is writing and against which unit and revision. */
export interface CommentContext {
  unitId: string
  revision: string
  author: ReviewCommentAuthor
  /** The unit's agent: new comments open a thread with it. */
  agentId?: string
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
  variant = "review",
  contextNotes = [],
  header,
  footer,
  collapsed = false,
  surfaceId,
  onCheckAction,
}: {
  file: DiffFile
  markers: Record<string, ContextualMarker>
  /** `review comment` markers placed in this file (derived from records). */
  commentAnchors?: ReadonlyArray<MarkerAnchor>
  /** Records behind those markers, by marker key (status, actions). */
  comments?: Record<string, ReviewCommentRecord>
  commentContext: CommentContext
  /** `read-only`: a read-only neighbor (muted, its own unit's comments). */
  variant?: DiffVariant
  /** A read-only neighbor's own context: muted pins with their note. */
  contextNotes?: ReadonlyArray<NeighborContextNote>
  /** Replaces the file header (the read-only neighbor brings its own). */
  header?: React.ReactNode
  /** Under the code (the read-only neighbor's "you can comment" note). */
  footer?: React.ReactNode
  /** Header only; the code rises in when expanded (read-only neighbor). */
  collapsed?: boolean
  /** Id of the code region, for the header's aria-controls. */
  surfaceId?: string
  /** The "Before you decide" action of an open card. */
  onCheckAction?: (marker: ContextualMarker, action: MarkerCheckAction) => void
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
  const threads = useAtomValue(reviewThreadsAtom)
  const readOnly = variant === "read-only"
  const reduce = useReducedMotion()

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
    for (const note of contextNotes) {
      list.push({
        id: noteId(note.key),
        side: note.side,
        lineNumber: note.lineNumber,
      })
    }
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
  }, [anchors, contextNotes, drafts, composerSlot, composing, selected])

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
  // The open thread's lines first; otherwise the latest shown preview's.
  const openRange =
    (openHere ? rangeOf(openHere) : undefined) ??
    [...openBodies]
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
    // A card or a thread shows only while it is the expanded layer; a
    // comment's compact preview also shows while "Show comments" is on.
    dismissedIds: anchors
      .map((anchor) => anchor.markerKey)
      .filter((key) =>
        markers[key]?.sourceKind === "review comment"
          ? key !== openHere && !openBodies.includes(key)
          : key !== openHere
      ),
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
      <div
        className={cn(
          "min-w-0 flex-auto rounded-[10px]",
          readOnly ? "bg-ro-bg" : "bg-surface shadow-[0_0_0_1px_var(--nv-line)]"
        )}
      >
        {header ?? (
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
        )}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="surface"
              id={surfaceId}
              initial={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, y: RISE.offsetY, scale: RISE.initialScale }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{
                opacity: 0,
                transition: reduce ? REDUCED_TRANSITION : RISE.exit,
              }}
              transition={reduce ? REDUCED_TRANSITION : RISE.enter}
              style={{ transformOrigin: "bottom center" }}
            >
              <DiffSurface
                variant={variant}
                label={
                  readOnly
                    ? `Read-only neighbor ${file.path}. Line numbers select lines to comment on.`
                    : `Changes in ${file.path}. Line numbers select lines to comment on.`
                }
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
                  const record = comments[marker.key]
                  const expanded = open === marker.key
                  const cardOpen = !isComment && expanded
                  const threadOpen = isComment && expanded
                  const previewShown =
                    isComment && !expanded && openBodies.includes(marker.key)
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
                          on={expanded}
                          readOnly={readOnly && !isComment}
                          className={
                            record?.status === "resolved"
                              ? "opacity-55"
                              : undefined
                          }
                          disabled={
                            isolating && overlay.expandedId !== marker.key
                          }
                          data-anchor={anchorKey(
                            anchor.side,
                            anchor.lineNumber
                          )}
                          data-marker-key={marker.key}
                          onToggle={() => toggleMarker(marker.key)}
                          onHintStart={() =>
                            setHint({
                              filePath: file.path,
                              markerKey: marker.key,
                            })
                          }
                          onHintEnd={() =>
                            setHint((current) =>
                              current?.markerKey === marker.key ? null : current
                            )
                          }
                        />
                      </div>
                      <div
                        slot={getOverlayBodySlotName(marker.key)}
                        className="contents"
                      >
                        <AnimatePresence initial={false}>
                          {previewShown && record && (
                            <CommentPreviewCard
                              key="preview"
                              record={record}
                              rangeLabel={
                                anchor.range
                                  ? rangeLabel(anchor.range)
                                  : `L${anchor.lineNumber}`
                              }
                              thread={threads[record.id]}
                              onOpen={() => toggleMarker(marker.key)}
                            />
                          )}
                          {threadOpen && record && (
                            <ThreadCard
                              key="thread"
                              record={record}
                              rangeLabel={
                                anchor.range
                                  ? rangeLabel(anchor.range)
                                  : `L${anchor.lineNumber}`
                              }
                              thread={threads[record.id]}
                              fallbackAgentId={commentContext.agentId}
                              reviewer={commentContext.author}
                              onDismiss={() => {
                                closeCard()
                                // Keep keyboard users where they were: on the pin
                                // the thread collapsed back into.
                                document
                                  .querySelector<HTMLElement>(
                                    `button[data-marker-key="${CSS.escape(marker.key)}"]`
                                  )
                                  ?.focus()
                              }}
                              onToggleStatus={() =>
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
                              onCheckAction={(action) =>
                                onCheckAction?.(marker, action)
                              }
                            />
                          )}
                        </AnimatePresence>
                      </div>
                    </React.Fragment>
                  )
                })}
                {contextNotes.map((note) => (
                  <React.Fragment key={note.key}>
                    <div
                      slot={getOverlayPinSlotName(noteId(note.key))}
                      className="contents"
                    >
                      <span
                        aria-label={`${note.short}: ${note.note}`}
                        className="inline-flex h-[22px] items-center gap-1.5 rounded-md px-2 font-mono text-[11px] text-ink-muted shadow-[inset_0_0_0_1px_var(--nv-line)]"
                      >
                        <span
                          aria-hidden="true"
                          className="size-1.5 rounded-[2px] bg-faint"
                        />
                        {note.short}
                      </span>
                    </div>
                    <div
                      slot={getOverlayBodySlotName(noteId(note.key))}
                      className="block"
                    >
                      <span className="block max-w-[230px] text-[11.5px] leading-4 text-ink-muted">
                        {note.note}
                      </span>
                    </div>
                  </React.Fragment>
                ))}
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
                <div
                  slot={getOverlayPinSlotName(SELECTION_ID)}
                  className="contents"
                >
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
                <div
                  slot={getOverlayBodySlotName(COMPOSER_ID)}
                  className="block"
                >
                  <AnimatePresence
                    onExitComplete={() => setClosingComposer(null)}
                  >
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
              {footer}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div
        aria-hidden="true"
        className="shrink-0 grow-0 basis-[300px] self-stretch max-[1180px]:basis-[260px] max-[860px]:hidden"
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
