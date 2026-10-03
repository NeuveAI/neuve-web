/**
 * View models for the review UI.
 *
 * Names follow the product vocabulary (vocabulary.md in the neuve root repo):
 * a review unit groups hunks, a contextual marker is a retrieved fragment
 * attributed to one hunk line, a read-only neighbor supplies context without
 * receiving the unit's disposition, and a review lane is a responsibility
 * category. These are presentation shapes only — no backend contract yet.
 */

export type ReviewLane =
  "human-required" | "human-suggested" | "agentic-review" | "static-automation"

export type Disposition = "approved" | "changes-requested"

/** Visual tone of a margin pin. Mirrors the marker's source kind. */
export type MarkerTone =
  "doc" | "graph" | "conflict" | "batch" | "test" | "history" | "comment"

/**
 * Where a contextual marker comes from.
 *
 * - `retrieved`: semantic context retrieved and attributed to a hunk line
 *   (the vocabulary.md meaning of a contextual marker).
 * - `review comment`: PROPOSAL (not yet in vocabulary.md) — a human inline
 *   review comment recorded on a hunk line and carried into the unit's
 *   markers so later cycles see it. It stays traceable to its comment record
 *   and the revision it was written against.
 */
export type MarkerSourceKind = "retrieved" | "review comment"

/** Trace from a `review comment` marker back to its record. */
export interface ReviewCommentTrace {
  commentId: string
  unitId: string
  /** Commit the comment was written against. */
  revision: string
  /** The lines it is about in the revision on screen (display order). */
  range: LineRange
  /** True when the comment was written against an earlier revision and was re-anchored by line text. */
  carriedForward: boolean
}

export type BadgeTone = "neutral" | "req" | "sug" | "batch"

export interface SourceParagraph {
  text: string
  /** The cited fragment inside the whole source. */
  cited: boolean
}

/** L3 — the whole source, opened in the sheet. */
export interface MarkerSource {
  kind: string
  title: string
  meta: string
  paragraphs: Array<SourceParagraph>
  citedBy: string
}

/** A contextual marker attributed to one diff line. */
export interface ContextualMarker {
  key: string
  /** Defaults to `retrieved`. */
  sourceKind?: MarkerSourceKind
  /** Present on `review comment` markers. */
  trace?: ReviewCommentTrace
  tone: MarkerTone
  /** Pin label (L0). */
  short: string
  /** One sentence to decide from (L1). */
  peek: string
  /** L2 card. */
  badge: string
  badgeTone: BadgeTone
  title: string
  meta: string
  quote: string
  /** Second, opposing fragment (conflicting intent). */
  quoteAgainst?: string
  establishes: string
  applies: string
  uncertain: string
  cited: string
  source: MarkerSource
}

/** Which side of a diff a line number refers to (Pierre's AnnotationSide). */
export type DiffSide = "additions" | "deletions"

/**
 * A run of diff lines, Pierre's `SelectedLineRange`: it can start on one side
 * and end on the other (a deletion row through an addition row in the
 * stacked view). Stored top-to-bottom in display order.
 */
export interface LineRange {
  start: number
  side: DiffSide
  end: number
  /** Present only when the range ends on the other side. */
  endSide?: DiffSide
}

/** A contextual marker attributed to one line of a file's diff. */
export interface MarkerAnchor {
  markerKey: string
  side: DiffSide
  lineNumber: number
  /** The lines the marker is about (review comments); tinted when open. */
  range?: LineRange
}

/**
 * One changed file of a review unit. Full contents on both sides let the
 * diff renderer (the @workspace/diffs fork) expand collapsed context.
 */
export interface DiffFile {
  path: string
  additions: number
  deletions: number
  oldContents: string
  newContents: string
  /** Unchanged lines kept around each change when hunks are computed. */
  context: number
  markerAnchors: Array<MarkerAnchor>
}

export interface ReadOnlyNeighbor {
  path: string
  /** Why it is read-only, e.g. its own lane and result. */
  note: string
  /** The neighbor's hunk as a unified patch (partial file, not expandable). */
  patch: string
}

export type BriefingSegment =
  | { kind: "text"; text: string }
  | { kind: "cite"; label: string; markerKey: string; ariaLabel: string }

export interface RailUnit {
  id: string
  title: string
  hunkCount: number
}

export interface ElsewhereLane {
  lane: Exclude<ReviewLane, "human-required">
  label: string
  count: number
  note?: string
}

/** The person reviewing; authors inline review comments. */
export interface Reviewer {
  id: string
  name: string
  initials: string
}

export interface ReviewDeskData {
  repo: string
  branch: string
  /** Commit under review. */
  revision: string
  reviewer: Reviewer
  cycle: number
  batchTitle: string
  unit: {
    id: string
    title: string
    lane: ReviewLane
    position: { index: number; of: number }
    briefing: Array<BriefingSegment>
    stats: string
    hunkCount: number
    /** Marker attached to a change request when nothing else is open. */
    defaultAttachment: string
    draftSuggestion: string
    scopeNote: string
  }
  railUnits: Array<RailUnit>
  elsewhere: Array<ElsewhereLane>
  markers: Record<string, ContextualMarker>
  files: Array<DiffFile>
  neighbor: ReadOnlyNeighbor
  humanRequiredTotal: number
}

/* ── Batch overview ─────────────────────────────────────── */

export interface LaneSummary {
  lane: ReviewLane
  name: string
  count: number
  line: string
}

export interface JudgmentUnit {
  id: string
  title: string
  signal: { text: string; tone: "req" | "neutral"; icon: "conflict" | "scope" }
  files: number
  hunks: number
  markers: number
  unapproved?: number
  evidence: { text: string; tone: "gap" | "checked" }
  readers: number
}

export type VerificationCard =
  | {
      kind: "missing"
      id: string
      title: string
      body: string
      reasonLabel: string
      reason: string
      unitId: string
    }
  | {
      kind: "capture"
      id: string
      observedOn: string
      title: string
      note: string
      steps: [string, string]
      outcome: { status: string; message: string }
      duration: string
    }
  | {
      kind: "test"
      id: string
      strength: "solid" | "shallow"
      file: string
      title: string
      excerpt: string
      why: string
      unitId: string
    }

export interface BatchOverviewData {
  repo: string
  title: string
  ticket: string
  branch: string
  revision: string
  unitCount: number
  briefing: string
  needYou: number
  firstUnitId: string
  lanes: Array<LaneSummary>
  judgment: Array<JudgmentUnit>
  verificationSummary: string
  verification: Array<VerificationCard>
}
