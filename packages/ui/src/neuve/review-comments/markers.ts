import {
  displayRows,
  rangeLabel,
  toFileDiff,
} from "@workspace/ui/neuve/review-desk/diff-model"
import type { DisplayRow } from "@workspace/ui/neuve/review-desk/diff-model"
import type { ReviewCommentRecord } from "@workspace/ui/neuve/review-comments/record"
import type {
  ContextualMarker,
  DiffFile,
  DiffSide,
  LineRange,
  MarkerAnchor,
} from "@workspace/ui/neuve/types"

/**
 * Review comment → contextual marker (PROPOSAL relative to vocabulary.md).
 *
 * vocabulary.md defines a contextual marker as *retrieved* semantic context
 * attributed to a hunk. A human inline comment is not retrieved, but it is
 * exactly the kind of attributed, traceable fragment a later cycle needs
 * ("explicit links to earlier hunks, comments, evidence, and decisions",
 * foundations/04). The proposal: carry each saved comment into the unit's
 * markers with source kind `review comment`, keep it visibly distinct from
 * retrieved markers, and keep it traceable to its record and revision.
 */

export const COMMENT_MARKER_PREFIX = "comment:"

export function commentMarkerKey(commentId: string): string {
  return `${COMMENT_MARKER_PREFIX}${commentId}`
}

export function isCommentMarkerKey(key: string): boolean {
  return key.startsWith(COMMENT_MARKER_PREFIX)
}

export interface ResolvedCommentAnchor {
  range: LineRange
  /** The comment was written on another revision and found again by text. */
  carriedForward: boolean
}

function rowSide(row: DisplayRow): DiffSide {
  return row.kind === "deletion" ? "deletions" : "additions"
}

function rowLine(row: DisplayRow): number {
  return (row.kind === "deletion" ? row.oldLine : row.newLine) ?? 0
}

/**
 * Where a comment's range sits in the current revision of its file.
 *
 * Same revision: exactly where it was written. Earlier revision: the run of
 * display rows whose sides and texts equal the run the comment was written
 * on (`anchor.lines`), nearest to the original start. Nothing matches:
 * `undefined` — the comment stays in the records but has no lines in this
 * revision (see the open question in the workstream scratchpad).
 */
export function resolveCommentAnchor(
  record: ReviewCommentRecord,
  file: DiffFile,
  revision: string,
  rows: ReadonlyArray<DisplayRow>
): ResolvedCommentAnchor | undefined {
  const { anchor } = record
  if (anchor.filePath !== file.path) return undefined
  if (record.revision === revision) {
    return { range: anchor.range, carriedForward: false }
  }
  const wanted = anchor.lines
  let best: number | undefined
  for (let i = 0; i + wanted.length <= rows.length; i++) {
    const matches = wanted.every((line, k) => {
      const row = rows[i + k]!
      return rowSide(row) === line.side && row.text === line.text
    })
    if (!matches) continue
    const distance = Math.abs(rowLine(rows[i]!) - anchor.range.start)
    if (
      best === undefined ||
      distance < Math.abs(rowLine(rows[best]!) - anchor.range.start)
    ) {
      best = i
    }
  }
  if (best === undefined) return undefined
  const top = rows[best]!
  const bottom = rows[best + wanted.length - 1]!
  const range: LineRange = {
    start: rowLine(top),
    side: rowSide(top),
    end: rowLine(bottom),
    ...(rowSide(bottom) !== rowSide(top) ? { endSide: rowSide(bottom) } : {}),
  }
  return { range, carriedForward: true }
}

function shortRevision(revision: string): string {
  return revision.slice(0, 7)
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toISOString().slice(0, 10)
}

function firstLine(body: string): string {
  const line = body.split("\n")[0] ?? ""
  return line.length > 120 ? `${line.slice(0, 119)}…` : line
}

/** One saved comment as a `review comment` contextual marker. */
export function reviewCommentToMarker(
  record: ReviewCommentRecord,
  resolved: ResolvedCommentAnchor = {
    range: record.anchor.range,
    carriedForward: false,
  }
): ContextualMarker {
  const { carriedForward, range } = resolved
  const revision = shortRevision(record.revision)
  const where = `${record.anchor.filePath} ${rangeLabel(range)}`
  const when = formatDate(record.createdAt)
  return {
    key: commentMarkerKey(record.id),
    sourceKind: "review comment",
    trace: {
      commentId: record.id,
      unitId: record.unitId,
      revision: record.revision,
      range,
      carriedForward,
    },
    tone: "comment",
    short: record.author.initials,
    peek: firstLine(record.body),
    kindLabel: "Review comment",
    title: `${record.author.name} commented`,
    meta: `${where} · ${revision} · ${when}`,
    quote: record.body,
    applies: carriedForward
      ? `Written on ${revision}; the same lines are here now.`
      : `Written on this revision (${revision}).`,
    source: {
      kind: "Comment",
      chips: [
        {
          text: record.status === "open" ? "Open" : "Resolved",
          tone: record.status === "open" ? "sug" : "neutral",
        },
        ...(carriedForward
          ? [{ text: "Carried forward", tone: "outline" as const }]
          : []),
      ],
      title: `${record.author.name} on ${record.anchor.filePath}`,
      subtitle: `${where} · ${record.anchor.hunk.header}`,
      actions: [
        {
          kind: "editor",
          editor: "VS Code",
          path: `${record.anchor.filePath}:${range.start}`,
        },
        { kind: "copy-path", path: record.anchor.filePath },
      ],
      facts: [
        { label: "Author", value: record.author.name },
        { label: "Written on", value: revision, mono: true },
      ],
      blocks: [
        {
          kind: "code",
          lines: record.anchor.lines.map((line) => ({
            number: line.lineNumber,
            text: line.text,
            cited: true,
          })),
        },
        { kind: "quote", text: record.body },
      ],
      citedBy: [`Unit ${record.unitId}`],
    },
  }
}

export interface UnitCommentMarkers {
  markers: Record<string, ContextualMarker>
  /** Per file path, the anchors to add to that file's margin. */
  anchors: Record<string, Array<MarkerAnchor>>
  /** Comments of this unit with no line in this revision. */
  unplaced: Array<ReviewCommentRecord>
}

/**
 * Every comment recorded for `unitId`, mapped into markers and margin
 * anchors for the given revision of its files.
 */
export function commentMarkersForUnit(
  records: ReadonlyArray<ReviewCommentRecord>,
  unitId: string,
  revision: string,
  files: ReadonlyArray<DiffFile>
): UnitCommentMarkers {
  const result: UnitCommentMarkers = { markers: {}, anchors: {}, unplaced: [] }
  for (const record of records) {
    if (record.unitId !== unitId) continue
    const file = files.find((f) => f.path === record.anchor.filePath)
    const rows = file ? displayRows(toFileDiff(file, revision), file) : []
    const resolved = file
      ? resolveCommentAnchor(record, file, revision, rows)
      : undefined
    if (!file || !resolved) {
      result.unplaced.push(record)
      continue
    }
    const marker = reviewCommentToMarker(record, resolved)
    result.markers[marker.key] = marker
    const list = result.anchors[file.path] ?? []
    // Comments sit on the first line of their range, like the composer.
    list.push({
      markerKey: marker.key,
      side: resolved.range.side,
      lineNumber: resolved.range.start,
      range: resolved.range,
    })
    result.anchors[file.path] = list
  }
  return result
}
