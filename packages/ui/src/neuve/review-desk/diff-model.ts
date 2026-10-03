import { parseDiffFromFile, parsePatchFiles } from "@workspace/diffs"
import type { FileDiffMetadata } from "@workspace/diffs"

import type { DiffFile, DiffSide, LineRange } from "@workspace/ui/neuve/types"

/**
 * View model → @workspace/diffs metadata, and line-range helpers.
 *
 * Results are cached per input object (fixtures and loader data are
 * immutable), so renders reuse the same metadata and the renderer's
 * equality checks skip work. Cache keys let the highlighting worker reuse
 * tokens across mounts.
 */

const fileDiffs = new WeakMap<DiffFile, FileDiffMetadata>()

export function toFileDiff(file: DiffFile, revision: string): FileDiffMetadata {
  const cached = fileDiffs.get(file)
  if (cached) return cached
  const fileDiff = parseDiffFromFile(
    {
      name: file.path,
      contents: file.oldContents,
      cacheKey: `${file.path}@${revision}:old`,
    },
    {
      name: file.path,
      contents: file.newContents,
      cacheKey: `${file.path}@${revision}:new`,
    },
    { context: file.context }
  )
  fileDiffs.set(file, fileDiff)
  return fileDiff
}

const patchDiffs = new Map<string, FileDiffMetadata>()

/** A single-file unified patch (a read-only neighbor's hunk). */
export function toPatchDiff(patch: string): FileDiffMetadata {
  const cached = patchDiffs.get(patch)
  if (cached) return cached
  const fileDiff = parsePatchFiles(patch, "neighbor", true)[0]?.files[0]
  if (!fileDiff) throw new Error("toPatchDiff: the patch has no file diff")
  patchDiffs.set(patch, fileDiff)
  return fileDiff
}

/**
 * One row of the stacked (unified) view as if every fold were expanded:
 * context rows carry both line numbers, deletions the old one, additions the
 * new one.
 */
export interface DisplayRow {
  kind: "context" | "addition" | "deletion"
  oldLine: number | null
  newLine: number | null
  text: string
  /** The hunk the row belongs to, or the next hunk for folded context. */
  hunkIndex: number
  hunkHeader: string
}

const displayRowsCache = new WeakMap<FileDiffMetadata, Array<DisplayRow>>()

function stripEol(line: string | undefined): string {
  return (line ?? "").replace(/\r?\n$/, "")
}

function hunkHeaderOf(hunk: FileDiffMetadata["hunks"][number]): string {
  return (
    hunk.hunkSpecs?.trim() ??
    `@@ -${hunk.deletionStart},${hunk.deletionCount} +${hunk.additionStart},${hunk.additionCount} @@`
  )
}

/** Every row of the file in stacked display order (deletions before additions). */
export function displayRows(
  fileDiff: FileDiffMetadata,
  file: Pick<DiffFile, "newContents">
): Array<DisplayRow> {
  const cached = displayRowsCache.get(fileDiff)
  if (cached) return cached
  const newText = file.newContents.split("\n")
  if (newText.at(-1) === "") newText.pop()
  const rows: Array<DisplayRow> = []
  let oldLine = 1
  let newLine = 1
  const pushContextUntil = (
    nextNew: number,
    hunkIndex: number,
    hunkHeader: string
  ) => {
    while (newLine < nextNew) {
      rows.push({
        kind: "context",
        oldLine,
        newLine,
        text: newText[newLine - 1] ?? "",
        hunkIndex,
        hunkHeader,
      })
      oldLine++
      newLine++
    }
  }
  fileDiff.hunks.forEach((hunk, hunkIndex) => {
    const hunkHeader = hunkHeaderOf(hunk)
    pushContextUntil(hunk.additionStart, hunkIndex, hunkHeader)
    oldLine = hunk.deletionStart
    newLine = hunk.additionStart
    for (const block of hunk.hunkContent) {
      if (block.type === "context") {
        for (let i = 0; i < block.lines; i++) {
          rows.push({
            kind: "context",
            oldLine,
            newLine,
            text: stripEol(fileDiff.additionLines[block.additionLineIndex + i]),
            hunkIndex,
            hunkHeader,
          })
          oldLine++
          newLine++
        }
        continue
      }
      for (let i = 0; i < block.deletions; i++) {
        rows.push({
          kind: "deletion",
          oldLine,
          newLine: null,
          text: stripEol(fileDiff.deletionLines[block.deletionLineIndex + i]),
          hunkIndex,
          hunkHeader,
        })
        oldLine++
      }
      for (let i = 0; i < block.additions; i++) {
        rows.push({
          kind: "addition",
          oldLine: null,
          newLine,
          text: stripEol(fileDiff.additionLines[block.additionLineIndex + i]),
          hunkIndex,
          hunkHeader,
        })
        newLine++
      }
    }
  })
  const last = fileDiff.hunks.length - 1
  const lastHeader = last >= 0 ? hunkHeaderOf(fileDiff.hunks[last]!) : ""
  pushContextUntil(newText.length + 1, Math.max(last, 0), lastHeader)
  displayRowsCache.set(fileDiff, rows)
  return rows
}

/** Index of a (side, line) point among the display rows. */
export function rowIndexOf(
  rows: ReadonlyArray<DisplayRow>,
  side: DiffSide,
  lineNumber: number
): number {
  return rows.findIndex((row) =>
    side === "additions"
      ? row.kind !== "deletion" && row.newLine === lineNumber
      : row.kind !== "addition" && row.oldLine === lineNumber
  )
}

/**
 * Pierre ranges keep the drag direction; store them top-to-bottom. Returns
 * undefined when a point is not a row of this file.
 */
export function normalizeRange(
  rows: ReadonlyArray<DisplayRow>,
  range: LineRange
): LineRange | undefined {
  const endSide = range.endSide ?? range.side
  const a = rowIndexOf(rows, range.side, range.start)
  const b = rowIndexOf(rows, endSide, range.end)
  if (a < 0 || b < 0) return undefined
  const [top, bottom] =
    a <= b
      ? [
          { side: range.side, line: range.start },
          { side: endSide, line: range.end },
        ]
      : [
          { side: endSide, line: range.end },
          { side: range.side, line: range.start },
        ]
  return {
    start: top.line,
    side: top.side,
    end: bottom.line,
    ...(bottom.side !== top.side ? { endSide: bottom.side } : {}),
  }
}

/** The display rows a (normalized) range covers, top to bottom. */
export function rangeRows(
  rows: ReadonlyArray<DisplayRow>,
  range: LineRange
): Array<DisplayRow> {
  const a = rowIndexOf(rows, range.side, range.start)
  const b = rowIndexOf(rows, range.endSide ?? range.side, range.end)
  if (a < 0 || b < 0) return []
  return rows.slice(Math.min(a, b), Math.max(a, b) + 1)
}

export function rangeEquals(
  a: LineRange | null | undefined,
  b: LineRange | null | undefined
): boolean {
  if (!a || !b) return a === b
  return (
    a.start === b.start &&
    a.end === b.end &&
    a.side === b.side &&
    (a.endSide ?? a.side) === (b.endSide ?? b.side)
  )
}

/** Stable key for a file + range (drafts, overlay ids). */
export function rangeKey(filePath: string, range: LineRange): string {
  return `${filePath}#${range.side}:${range.start}-${range.endSide ?? range.side}:${range.end}`
}

const sign = (side: DiffSide) => (side === "deletions" ? "−" : "")

/**
 * "L22", "L22–23", "L−20–21" (removed lines), or "L−20–+20" when the range
 * crosses from removed to added rows.
 */
export function rangeLabel(range: LineRange): string {
  const endSide = range.endSide ?? range.side
  const head = `${sign(range.side)}${range.start}`
  if (range.start === range.end && endSide === range.side) return `L${head}`
  const tail =
    endSide === range.side
      ? `${range.end}`
      : `${endSide === "deletions" ? "−" : "+"}${range.end}`
  return `L${head}–${tail}`
}

/** "line 20" / "lines 20–23" for prose (composer header, placeholder). */
export function rangePhrase(range: LineRange): string {
  const label = rangeLabel(range).slice(1)
  return range.start === range.end &&
    (range.endSide ?? range.side) === range.side
    ? `line ${label}`
    : `lines ${label}`
}

export function anchorKey(side: DiffSide, lineNumber: number): string {
  return `${side}:${lineNumber}`
}
