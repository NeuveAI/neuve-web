/**
 * View models for the review UI.
 *
 * Names follow the product vocabulary (vocabulary.md in the neuve root repo):
 * a review unit groups hunks, a contextual marker is a retrieved fragment
 * attributed to one hunk line, a read-only neighbor supplies context without
 * receiving the unit's disposition, and a review lane is a responsibility
 * category. These are presentation shapes only — no backend contract yet.
 */

import type { ReviewThread } from "./review-comments/thread"

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

/* ── Context card (L2) ───────────────────────────────── */

/** One row of the graph read-by tree (`├`/`└` branches, file on the right). */
export interface ReadByNode {
  /** Tree prefix drawn in faint mono, e.g. "├ " or "│ └ ". */
  prefix: string
  name: string
  /** Short file shown on the right, or "not traced". */
  where: string
  /** Full `path:line`, revealed in a tooltip when `where` is truncated. */
  fullPath?: string
  tone: "root" | "node" | "untraced"
}

/** The kind-specific excerpt of a context card. */
export type MarkerExcerpt =
  | { kind: "tree"; nodes: Array<ReadByNode> }
  | {
      kind: "versus"
      a: { source: string; text: string }
      b: { source: string; text: string }
    }
  | { kind: "code"; code: string }
  | { kind: "quote"; text: string }

/**
 * The single action in a card's "Before you decide" callout. It does the
 * check the sentence names: open a unit, open a file, ask the implementer,
 * or request a check.
 */
export type MarkerCheckAction =
  | { kind: "unit"; label: string; unitId: string }
  | { kind: "file"; label: string; path: string }
  | { kind: "ask"; label: string }
  | { kind: "request-check"; label: string }

/* ── Source sheet (L3) ─────────────────────────────────── */

export type SourceTone = "neutral" | "outline" | "sug" | "req" | "agt"

export type SourceAction =
  | { kind: "editor"; editor: "VS Code" | "Cursor" | "Zed"; path: string }
  | { kind: "copy-path"; path: string }
  | { kind: "external"; label: string; href: string }
  | { kind: "link"; label: string; href: string }

export interface SourceFact {
  label: string
  value: string
  /** Coloured only when the fact carries status. */
  tone?: Exclude<SourceTone, "neutral" | "outline">
  mono?: boolean
}

export interface SourceRow {
  /** Leading mark: "1 hop", "◉", "!", a file glyph… */
  mark: string
  label: string
  sub?: string
  meta: string
  tone?: Exclude<SourceTone, "neutral" | "outline">
  /** Diff stat rows (`+6 −1`) colour each part. */
  stat?: { additions?: number; deletions?: number }
  /** Rows that can open in the editor (graph readers). */
  openPath?: string
}

export type SourceBlock =
  | {
      kind: "code"
      lines: Array<{ number: number; text: string; cited: boolean }>
    }
  | { kind: "quote"; text: string }
  | { kind: "text"; text: string }
  | { kind: "label"; text: string }
  | { kind: "rows"; mono?: boolean; rows: Array<SourceRow> }

/** L3 — the whole source, opened in the sheet. */
export interface MarkerSource {
  /** "Code", "Ticket", "History", "Graph", "Doc", "Test", "Comment". */
  kind: string
  chips: Array<{ text: string; tone: SourceTone }>
  title: string
  subtitle: string
  actions: Array<SourceAction>
  /** Two to four facts. */
  facts: Array<SourceFact>
  blocks: Array<SourceBlock>
  citedBy: Array<string>
  /** Present when the source belongs to another unit of the batch. */
  goToUnit?: string
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
  /**
   * L2 header: one kind label that already carries status, e.g.
   * "Same batch · unreviewed", "Decision signal", "Evidence gap".
   */
  kindLabel: string
  title: string
  meta: string
  /** The cited text (a review comment's body). */
  quote: string
  /** Kind-specific excerpt in the card body. */
  excerpt?: MarkerExcerpt
  /** "Why it's here": one line. */
  applies: string
  /** "Before you decide": one plain sentence naming what to check. */
  check?: string
  checkAction?: MarkerCheckAction
  /**
   * Other review units of the batch that carry the same marker. Shown as
   * dots on the pin and as linked units in the rail, never as a footnote.
   */
  sharedWith?: Array<string>
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

/** A muted context pin on a read-only neighbor, with its note shown. */
export interface NeighborContextNote {
  key: string
  short: string
  note: string
  side: DiffSide
  lineNumber: number
}

export interface ReadOnlyNeighbor {
  path: string
  /** Why it is read-only, e.g. its own lane and result. */
  note: string
  /** The neighbor's own unit: comments on it go there, never to this unit. */
  unitId: string
  /** Its lane, in the "decision stays with …" note. */
  laneLabel: string
  file: DiffFile
  /** Its own surrounding context, shown as muted pins when expanded. */
  contextNotes: Array<NeighborContextNote>
}

export type BriefingSegment =
  | { kind: "text"; text: string }
  | { kind: "cite"; label: string; markerKey: string; ariaLabel: string }

export interface RailUnit {
  id: string
  title: string
  hunkCount: number
  /** The implementer that owns the unit (comments route to it). */
  agentId?: string
}

export interface ElsewhereLane {
  lane: Exclude<ReviewLane, "human-required">
  label: string
  count: number
  note?: string
  /** The lane's units, listed when its rail group expands. */
  units?: Array<LaneUnit>
}

/** A unit inside a rail lane group, with its result. */
export interface LaneUnit {
  id: string
  title: string
  /** "agent ✓", "changes", "passed". */
  result: string
  tone?: "req"
}

/** Any review unit of the batch, for linking shared markers to the rail. */
export interface BatchUnit {
  id: string
  title: string
  lane: ReviewLane
}

/* ── Agents on the branch (registry) ───────────────────── */

/**
 * Working labels, not vocabulary.md terms: "implementer" writes the change,
 * "reviewer" reviews it. Neuve owns roles, scopes and routing; ACP carries
 * none of them.
 */
export type AgentRole = "implementer" | "reviewer"

/** An agent working on part of the branch. */
export interface BranchAgent {
  id: string
  /** Avatar initials, e.g. "I1". */
  short: string
  /** e.g. "Implementer 1". */
  name: string
  role: AgentRole
  /** The part of the branch it owns: a label and its paths. */
  scope: { label: string; paths: Array<string> }
  unitCount: number
}

/**
 * A harness configured on the server that Connect may start. The browser
 * picks one by id; it never supplies a command.
 */
export interface ConfiguredAgent {
  id: string
  label: string
  roles: Array<AgentRole>
}

export type AgentConnection =
  | { status: "connected"; harnessId: string; activity: string }
  | { status: "connecting"; harnessId: string }
  | { status: "disconnected" }

export interface AgentRegistry {
  agents: Array<BranchAgent>
  configured: Array<ConfiguredAgent>
  /** Initial connection status by agent id (live status lives in jotai). */
  connections: Record<string, AgentConnection>
}

/* ── New commit mid-review (Cycle.dc.html) ─────────────── */

/** A Neuve event sourced from Git: a new commit on the reviewed branch. */
export interface NewCommitEvent {
  commit: string
  /** Review units of the new commit that need a human decision. */
  needYou: number
  /** The commit the reviewer is mid-review on. */
  reviewing: string
}

export type LineageRelation = "renewed" | "corrected" | "regrouped" | "carried"

export interface LineageEntry {
  id: string
  relation: LineageRelation
  /** The units of the earlier commit, with their result. */
  before: Array<{
    title: string
    result: string
    tone: "approved" | "changes" | "agent"
  }>
  after: string
  afterNote: string
  needsYou: boolean
  /** The reviewer's comment the change answers, if any. */
  quote?: string
  note?: string
  /** Renewed signal: the unchanged hunk next to what changed under it. */
  renewed?: {
    approved: { file: string; note: string; line: number; text: string }
    changed: {
      file: string
      note: string
      line: number
      removed: string
      added: string
    }
    why: string
    evidence: string
  }
  unitId?: string
}

export interface CommitLineage {
  repo: string
  branch: string
  from: string
  to: string
  cycle: number
  needYou: number
  carried: number
  entries: Array<LineageEntry>
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
    /** Owning implementer (comments and change requests route to it). */
    agentId?: string
    /**
     * Units outside the human-required lane: who decided it and how. The
     * reviewer can agree or request changes (suggested) or comment.
     */
    attribution?: UnitAttribution
  }
  railUnits: Array<RailUnit>
  elsewhere: Array<ElsewhereLane>
  /** Every unit a shared marker can link to. */
  batchUnits: Array<BatchUnit>
  agents: AgentRegistry
  markers: Record<string, ContextualMarker>
  files: Array<DiffFile>
  neighbor?: ReadOnlyNeighbor
  humanRequiredTotal: number
  /** A new commit arrived while this revision is under review. */
  newCommit?: NewCommitEvent
  /** Comment threads with the agents (by comment record id). */
  threads?: Array<ReviewThread>
}

/** How an agent or tool decided a unit outside the human-required lane. */
export interface UnitAttribution {
  /** "Agent approved", "Agent requested changes", "Passed static automation". */
  headline: string
  meta: string
  summary?: string
  outcome: "approved" | "changes-requested" | "passed"
  evidence?: Array<string>
  waiting?: string
  checks?: Array<{
    title: string
    detail: string
    meta: string
    tone: "blocking" | "note" | "passed"
  }>
  /** Generated code, collapsed behind "Show generated diff". */
  generatedDiff?: { label: string; file: DiffFile }
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
  /** Owning agent tag, e.g. I1. */
  agentId?: string
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
  agents: AgentRegistry
}
