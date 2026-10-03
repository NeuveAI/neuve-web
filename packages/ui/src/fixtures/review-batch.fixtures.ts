/**
 * Sample review batch — the single fixtures module for the UI package.
 *
 * Content is transcribed from the approved design source (Main.dc.html
 * MARKERS / FILES / NEIGHBOR_ROWS and Overview.dc.html LANES and copy) for
 * the `acme/docs-app` SHR-212 batch. Stories and, until a backend exists, the
 * app routes both read from here. Nothing else in the repo defines sample
 * data.
 */
import type { ReviewCommentRecord } from "../neuve/review-comments/record"
import type {
  BatchOverviewData,
  ContextualMarker,
  DiffFile,
  ReviewDeskData,
} from "../neuve/types"

export const REVIEW_UNIT_ID = "revoke-cuts-off-open-sessions"

const MARKERS: Record<string, ContextualMarker> = {
  doc: {
    key: "doc",
    tone: "doc",
    short: "Doc",
    peek: "Only owners and editors may revoke a link.",
    badge: "Committed",
    badgeTone: "neutral",
    title: "docs/sharing/permissions.md",
    meta: "§ Managing links · 9c04e1a",
    quote:
      "“Only the document owner and editors can revoke a share link. Viewers never can.”",
    establishes: "Who may revoke a link.",
    applies: "This hunk adds that check.",
    uncertain: "Whether workspace admins count as editors.",
    cited: "Cited by 2 units",
    source: {
      kind: "Documentation · committed",
      title: "Managing share links",
      meta: "docs/sharing/permissions.md · 9c04e1a",
      paragraphs: [
        {
          text: "Share links give anyone with the URL read access to a document until the link expires or is revoked.",
          cited: false,
        },
        {
          text: "Only the document owner and editors can revoke a share link. Viewers never can.",
          cited: true,
        },
        {
          text: "Revoking a link is recorded in the document’s audit log.",
          cited: false,
        },
      ],
      citedBy: "This unit · Workspace admins may revoke any link",
    },
  },
  graph: {
    key: "graph",
    tone: "graph",
    short: "Graph",
    peek: "link.version is read by 4 entities within 2 hops.",
    badge: "Committed graph",
    badgeTone: "neutral",
    title: "Blast radius of link.version",
    meta: "incoming CALLS · 2 hops · 9c04e1a",
    quote:
      "canOpen → openSharedDocument → GET /s/:token\nexportLinkReport\nsyncLinkCache · 1 unresolved edge",
    establishes: "Who reads link.version, in this scope.",
    applies: "This line changes how it advances.",
    uncertain: "1 unresolved edge; coverage is incomplete.",
    cited: "Cited by 3 units",
    source: {
      kind: "Committed graph · blast radius",
      title: "Readers of link.version",
      meta: "incoming · CALLS, CONSTRUCTS · depth 2 · 9c04e1a",
      paragraphs: [
        {
          text: "canOpen (src/sharing/access-policy.ts:41) — 1 hop",
          cited: true,
        },
        {
          text: "openSharedDocument (src/routes/open.ts:12) — 2 hops via canOpen",
          cited: false,
        },
        {
          text: "exportLinkReport (src/reports/links.ts:30) — 1 hop",
          cited: false,
        },
        {
          text: "syncLinkCache (src/cache/links.ts:8) — 1 hop, one edge unresolved",
          cited: false,
        },
        {
          text: "Committed tree only. Same-batch hunks are not part of this graph.",
          cited: false,
        },
      ],
      citedBy:
        "This unit · Link list shows revoked state · Audit event for revocation",
    },
  },
  conflict: {
    key: "conflict",
    tone: "conflict",
    short: "Conflict",
    peek: "SHR-212 and 7d1e0b4 disagree about open sessions.",
    badge: "Decision signal",
    badgeTone: "req",
    title: "Conflicting intent",
    meta: "Ticket SHR-212 · history 7d1e0b4",
    quote:
      "SHR-212 · “Revoking a link must end access immediately, including people who already have the document open.”",
    quoteAgainst:
      "7d1e0b4 · May 2026 · “Keep existing viewer sessions alive across permission changes.”",
    establishes: "Opposite expectations for open sessions.",
    applies: "This line ends them, following SHR-212.",
    uncertain: "Which intent holds. Tests can’t settle it.",
    cited: "Cited by 2 units",
    source: {
      kind: "Ticket · pinned task scope",
      title: "SHR-212 · Revoke share links immediately",
      meta: "Linear · opened 2026-09-22",
      paragraphs: [
        {
          text: "Problem: revoked links keep working for anyone who already has the document open.",
          cited: false,
        },
        {
          text: "Revoking a link must end access immediately, including people who already have the document open.",
          cited: true,
        },
        { text: "Non-goal: changing who can create links.", cited: false },
        {
          text: "Done when: the old link and any open session are denied after revocation.",
          cited: false,
        },
      ],
      citedBy: "This unit · Session invalidation by link",
    },
  },
  batch: {
    key: "batch",
    tone: "batch",
    short: "Same batch",
    peek: "Defined in an unstaged hunk — still unapproved.",
    badge: "Unapproved · same batch",
    badgeTone: "batch",
    title: "src/sessions/sessions.ts",
    meta: "Unstaged · its own unit, undecided",
    quote:
      "export async function invalidateByLink(linkId) {\n  await store.deleteWhere({ linkId });\n}",
    establishes: "What this call does in the batch.",
    applies: "This line calls it.",
    uncertain: "Approving this unit doesn’t approve it.",
    cited: "Unit · Session invalidation by link",
    source: {
      kind: "Transient context · unapproved",
      title: "Session invalidation by link",
      meta: "src/sessions/sessions.ts · unstaged · agentic review pending",
      paragraphs: [
        {
          text: "export async function invalidateByLink(linkId) {\n  await store.deleteWhere({ linkId });\n}",
          cited: true,
        },
        {
          text: "No committed history or prior approval. It explains this call site and carries no decision across units.",
          cited: false,
        },
      ],
      citedBy: "This unit",
    },
  },
  test: {
    key: "test",
    tone: "test",
    short: "Test",
    peek: "Checks the 204 response only.",
    badge: "Evidence gap",
    badgeTone: "sug",
    title: "test/sharing/revoke.test.ts",
    meta: "“returns 204 for owner” · passed on a3f9c2e",
    quote: "expect(res.status).toBe(204)",
    establishes: "Success response for an owner.",
    applies: "It runs this return path.",
    uncertain: "Nothing opens the old link after revoking.",
    cited: "Also cited by 1 unit",
    source: {
      kind: "Verification evidence",
      title: "returns 204 for owner",
      meta: "test/sharing/revoke.test.ts:14 · a3f9c2e · passed",
      paragraphs: [
        {
          text: "const res = await api.revoke(link.id, owner);",
          cited: false,
        },
        { text: "expect(res.status).toBe(204)", cited: true },
        {
          text: "Not covered: opening the old link, or an open session, after revoking it.",
          cited: false,
        },
      ],
      citedBy: "This unit · Audit event for revocation",
    },
  },
  history: {
    key: "history",
    tone: "history",
    short: "History",
    peek: "March regression: revoked links opened from cache.",
    badge: "Regression history",
    badgeTone: "neutral",
    title: "Commit 2c88f10 · hotfix",
    meta: "Mar 2026 · INC-41",
    quote:
      "“Revoked links still opened when the viewer was served from cache.”",
    establishes: "canOpen once let revoked links through.",
    applies: "This moves the check into canOpen.",
    uncertain: "Whether the route check is now redundant.",
    cited: "Cited by 1 unit",
    source: {
      kind: "Git history · regression",
      title: "Hotfix: deny revoked links served from cache",
      meta: "2c88f10 · 2026-03-04 · INC-41",
      paragraphs: [
        {
          text: "Revoked links still opened when the viewer was served from cache.",
          cited: true,
        },
        {
          text: "Adds a revokedAt check in the /s/:token route handler.",
          cited: false,
        },
      ],
      citedBy: "This unit",
    },
  },
}

/* ── Diff sources ──────────────────────────────────────────
 * Full file contents on both sides, so the forked diff renderer computes the
 * hunks itself and can expand the collapsed context above them. Lines 18–25
 * of revoke.ts and 41–44 of access-policy.ts are the approved artboard rows;
 * the rest is plausible surrounding code.
 */

const REVOKE_PREAMBLE = [
  'import { links } from "../db/links";',
  'import { sessions } from "../db/sessions";',
  'import { policy } from "./access-policy";',
  'import { notFound } from "../http/responses";',
  'import { now } from "../lib/clock";',
  'import type { Actor } from "../auth/actor";',
  'import type { LinkId } from "./types";',
  "",
  "/**",
  " * Revoke a share link.",
  " *",
  " * Owners and editors may revoke. Revoking bumps the link version so",
  " * every session opened through the old link is denied on its next",
  " * request (SHR-212).",
  " */",
  "",
  "// Mounted at DELETE /links/:id.",
]

const REVOKE_OLD = [
  ...REVOKE_PREAMBLE,
  "export async function revokeShareLink(linkId: LinkId, actor: Actor) {",
  "  const link = await links.find(linkId);",
  "  if (!link) return { status: 404 };",
  "  await links.update(linkId, { revokedAt: now() });",
  "  return { status: 204 };",
  "}",
]

const REVOKE_NEW = [
  ...REVOKE_PREAMBLE,
  "export async function revokeShareLink(linkId: LinkId, actor: Actor) {",
  "  const link = await links.find(linkId);",
  "  if (!link) return notFound();",
  "  await policy.assertCanManage(actor, link.documentId);",
  "  await links.update(linkId, { revokedAt: now(), version: link.version + 1 });",
  "  await sessions.invalidateByLink(linkId);",
  "  return { status: 204 };",
  "}",
]

const POLICY_PREAMBLE = [
  'import { documents } from "../db/documents";',
  'import { Forbidden } from "../http/errors";',
  'import type { Actor } from "../auth/actor";',
  'import type { ShareLink, Viewer } from "./types";',
  "",
  "/** Roles that may manage a document's share links. */",
  'const MANAGERS = new Set(["owner", "editor"]);',
  "",
  "export const policy = {",
  "  /**",
  "   * Throws unless `actor` may create, change or revoke links on the",
  "   * document. Viewers never can.",
  "   */",
  "  async assertCanManage(actor: Actor, documentId: string) {",
  "    const role = await documents.roleOf(actor.id, documentId);",
  '    if (!MANAGERS.has(role)) throw new Forbidden("cannot manage links");',
  "  },",
  "",
  "  /** Whether `actor` may see who opened a link. */",
  "  async canAudit(actor: Actor, documentId: string) {",
  "    const role = await documents.roleOf(actor.id, documentId);",
  '    return role === "owner";',
  "  },",
  "};",
  "",
  "/** Seconds a viewer session may idle before it must re-check access. */",
  "export const SESSION_IDLE_SECONDS = 15 * 60;",
  "",
  "/** A link is usable when it is active and not past its expiry. */",
  "export function isUsable(link: ShareLink, at: Date) {",
  "  if (!link.active) return false;",
  "  return link.expiresAt === null || link.expiresAt > at;",
  "}",
  "",
  "/**",
  " * Called on every request made through a share link, including requests",
  " * from sessions that were opened before the link changed. A viewer may",
  " * open the document only through the link version they were issued.",
  " */",
  "",
]

const POLICY_OLD = [
  ...POLICY_PREAMBLE,
  "export function canOpen(link: ShareLink, viewer: Viewer) {",
  "  return link.active;",
  "}",
]

const POLICY_NEW = [
  ...POLICY_PREAMBLE,
  "export function canOpen(link: ShareLink, viewer: Viewer) {",
  "  if (link.revokedAt) return false;",
  "  return link.active && viewer.linkVersion >= link.version;",
  "}",
]

const lines = (rows: Array<string>) => `${rows.join("\n")}\n`

const FILES: Array<DiffFile> = [
  {
    path: "src/sharing/revoke.ts",
    additions: 4,
    deletions: 2,
    oldContents: lines(REVOKE_OLD),
    newContents: lines(REVOKE_NEW),
    context: 2,
    markerAnchors: [
      { markerKey: "doc", side: "additions", lineNumber: 21 },
      { markerKey: "graph", side: "additions", lineNumber: 22 },
      { markerKey: "conflict", side: "additions", lineNumber: 23 },
      { markerKey: "batch", side: "additions", lineNumber: 23 },
      { markerKey: "test", side: "additions", lineNumber: 24 },
    ],
  },
  {
    path: "src/sharing/access-policy.ts",
    additions: 2,
    deletions: 1,
    oldContents: lines(POLICY_OLD),
    newContents: lines(POLICY_NEW),
    context: 1,
    markerAnchors: [
      { markerKey: "history", side: "additions", lineNumber: 42 },
    ],
  },
]

const NEIGHBOR_PATCH = `diff --git a/src/gen/api-client.ts b/src/gen/api-client.ts
--- a/src/gen/api-client.ts
+++ b/src/gen/api-client.ts
@@ -88,3 +88,3 @@ export class ApiClient {
   revokeShareLink(id: string) {
-    return this.post(\`/links/\${id}/revoke\`);
+    return this.post(\`/links/\${id}/revoke\`, { expect: [204, 404] });
   }
`

const DRAFT_SUGGESTION =
  "Confirm whether open sessions should end on revoke (SHR-212) or survive it (7d1e0b4) before this lands."

export const reviewDeskFixture: ReviewDeskData = {
  repo: "acme/docs-app",
  branch: "shr-212-revoke-links",
  revision: "a3f9c2e",
  reviewer: { id: "reviewer-local", name: "You", initials: "YO" },
  cycle: 2,
  batchTitle: "Revoked share links stop working",
  unit: {
    id: REVIEW_UNIT_ID,
    title: "Revoke cuts off open sessions",
    lane: "human-required",
    position: { index: 1, of: 2 },
    briefing: [
      {
        kind: "text",
        text: "Revoking a link now bumps its version and ends open sessions. SHR-212 asks for an immediate cut-off, but a May decision kept sessions alive ",
      },
      {
        kind: "cite",
        label: "1",
        markerKey: "conflict",
        ariaLabel: "Open context 1: conflicting intent",
      },
      {
        kind: "text",
        text: ". The only test checks the 204, not denied access ",
      },
      {
        kind: "cite",
        label: "2",
        markerKey: "test",
        ariaLabel: "Open context 2: test evidence",
      },
      { kind: "text", text: ", and the session helper is still unapproved " },
      {
        kind: "cite",
        label: "3",
        markerKey: "batch",
        ariaLabel: "Open context 3: same-batch helper",
      },
      { kind: "text", text: "." },
    ],
    stats: "2 files · 3 hunks · 6 markers · 4.6k tokens",
    hunkCount: 3,
    defaultAttachment: "conflict",
    draftSuggestion: DRAFT_SUGGESTION,
    scopeNote:
      "Only this unit’s human-required hunks. The read-only neighbor keeps its own result.",
  },
  railUnits: [
    {
      id: REVIEW_UNIT_ID,
      title: "Revoke cuts off open sessions",
      hunkCount: 3,
    },
    {
      id: "workspace-admins-may-revoke",
      title: "Workspace admins may revoke any link",
      hunkCount: 2,
    },
  ],
  elsewhere: [
    {
      lane: "human-suggested",
      label: "Suggested",
      count: 3,
      note: "Agent approved · optional",
    },
    { lane: "agentic-review", label: "Agentic review", count: 7 },
    { lane: "static-automation", label: "Static automation", count: 12 },
  ],
  markers: MARKERS,
  files: FILES,
  neighbor: {
    path: "src/gen/api-client.ts",
    note: "Read-only · static automation ✓",
    patch: NEIGHBOR_PATCH,
  },
  humanRequiredTotal: 2,
}

export const batchOverviewFixture: BatchOverviewData = {
  repo: "acme/docs-app",
  title: "Revoked share links stop working immediately",
  ticket: "SHR-212",
  branch: "shr-212-revoke-links",
  revision: "a3f9c2e",
  unitCount: 24,
  briefing:
    "Revoking now also ends open sessions, reversing a May decision that kept them alive. Revoke and session invalidation ship together: reverting the helper alone reopens links for active viewers.",
  needYou: 2,
  firstUnitId: REVIEW_UNIT_ID,
  lanes: [
    {
      lane: "human-required",
      name: "Human-required",
      count: 2,
      line: "Only you can decide these.",
    },
    {
      lane: "human-suggested",
      name: "Human-suggested",
      count: 3,
      line: "Agent approved. Applies unless you step in.",
    },
    {
      lane: "agentic-review",
      name: "Agentic review",
      count: 7,
      line: "6 approved · 1 sent back to the implementer.",
    },
    {
      lane: "static-automation",
      name: "Static automation",
      count: 12,
      line: "Generated code, formatting, lockfile. All passed.",
    },
  ],
  judgment: [
    {
      id: REVIEW_UNIT_ID,
      title: "Revoke cuts off open sessions",
      signal: {
        text: "Ticket and history disagree",
        tone: "req",
        icon: "conflict",
      },
      files: 2,
      hunks: 3,
      markers: 6,
      unapproved: 1,
      evidence: { text: "1 gap", tone: "gap" },
      readers: 4,
    },
    {
      id: "workspace-admins-may-revoke",
      title: "Workspace admins may revoke any link",
      signal: { text: "Widens who can revoke", tone: "neutral", icon: "scope" },
      files: 1,
      hunks: 2,
      markers: 2,
      evidence: { text: "Checked", tone: "checked" },
      readers: 2,
    },
  ],
  verificationSummary: "1 missing · 1 shallow · 2 solid",
  verification: [
    {
      kind: "missing",
      id: "open-sessions-end",
      title: "Open sessions end on revoke",
      body: "This is the behavior SHR-212 exists for, and nothing exercises it. No check opens a document, revokes the link, then reloads. If it breaks, viewers keep reading after you revoke.",
      reasonLabel: "Why it may be missing",
      reason:
        "Commit 7d1e0b4 says sessions should survive. Until that’s settled, any check would encode one side.",
      unitId: REVIEW_UNIT_ID,
    },
    {
      kind: "capture",
      id: "old-link-denied",
      observedOn: "Observed on a3f9c2e",
      title: "Old link is denied",
      note: "Proves the fresh-visit path only. Doesn’t cover a viewer who already had it open.",
      steps: ["owner · Revoke link", "guest · reload /s/k7Q2"],
      outcome: { status: "403", message: "This link is no longer available" },
      duration: "0:12",
    },
    {
      kind: "test",
      id: "viewers-cant-revoke",
      strength: "solid",
      file: "permissions.test.ts",
      title: "Viewers can’t revoke",
      excerpt:
        "await api.revoke(link.id, viewer)\nexpect(res.status).toBe(403)",
      why: "Hits the new assertCanManage guard through the real route.",
      unitId: REVIEW_UNIT_ID,
    },
    {
      kind: "test",
      id: "revoke-succeeds-owner",
      strength: "shallow",
      file: "revoke.test.ts",
      title: "Revoke succeeds for owner",
      excerpt: "await api.revoke(link.id, owner)\nexpect(res.status).toBe(204)",
      why: "Checks the response, never the outcome. Passes even if the link still works.",
      unitId: REVIEW_UNIT_ID,
    },
  ],
}

/* ── Inline review comments ──────────────────────────────
 * Seed records for stories. Two were written on the revision under review;
 * one was written on an earlier revision of the same unit and is carried
 * forward by matching its line text (revoke.ts old line 20 → new line 21).
 */

export const REVIEWER = reviewDeskFixture.reviewer

export const reviewCommentFixtures: Array<ReviewCommentRecord> = [
  {
    schemaVersion: 2,
    id: "rc_seed_sessions",
    unitId: REVIEW_UNIT_ID,
    revision: reviewDeskFixture.revision,
    anchor: {
      filePath: "src/sharing/revoke.ts",
      range: { start: 22, side: "additions", end: 23 },
      hunk: { index: 0, header: "@@ -18,6 +18,8 @@" },
      lines: [
        {
          side: "additions",
          lineNumber: 22,
          text: "  await links.update(linkId, { revokedAt: now(), version: link.version + 1 });",
        },
        {
          side: "additions",
          lineNumber: 23,
          text: "  await sessions.invalidateByLink(linkId);",
        },
      ],
    },
    author: { id: "reviewer-maya", name: "Maya Chen", initials: "MC" },
    body: "If the second call throws after the version bump, the link is revoked but sessions survive. Should both happen in one transaction?",
    createdAt: "2026-10-02T15:12:00.000Z",
    status: "open",
  },
  {
    schemaVersion: 2,
    id: "rc_seed_policy",
    unitId: REVIEW_UNIT_ID,
    revision: reviewDeskFixture.revision,
    anchor: {
      filePath: "src/sharing/access-policy.ts",
      range: { start: 43, side: "additions", end: 43 },
      hunk: { index: 0, header: "@@ -40,3 +40,4 @@" },
      lines: [
        {
          side: "additions",
          lineNumber: 43,
          text: "  return link.active && viewer.linkVersion >= link.version;",
        },
      ],
    },
    author: REVIEWER,
    body: "Viewers issued before versioning have no linkVersion. Default it to 0 so they are denied, not crashed.",
    createdAt: "2026-10-03T09:40:00.000Z",
    status: "open",
  },
  {
    schemaVersion: 2,
    id: "rc_seed_earlier",
    unitId: REVIEW_UNIT_ID,
    revision: "6c41d0b",
    anchor: {
      filePath: "src/sharing/revoke.ts",
      range: { start: 20, side: "additions", end: 20 },
      hunk: { index: 0, header: "@@ -18,5 +18,6 @@" },
      lines: [
        {
          side: "additions",
          lineNumber: 20,
          text: "  await policy.assertCanManage(actor, link.documentId);",
        },
      ],
    },
    author: { id: "reviewer-maya", name: "Maya Chen", initials: "MC" },
    body: "Check the role before loading anything else.",
    createdAt: "2026-09-30T11:05:00.000Z",
    status: "resolved",
  },
]

/**
 * A range that crosses sides in the stacked view: from the removed 404
 * (−20) through its replacement (+20) — Pierre's {start, side, end, endSide}.
 */
export const crossSideCommentFixture: ReviewCommentRecord = {
  schemaVersion: 2,
  id: "rc_seed_notfound",
  unitId: REVIEW_UNIT_ID,
  revision: reviewDeskFixture.revision,
  anchor: {
    filePath: "src/sharing/revoke.ts",
    range: { start: 20, side: "deletions", end: 20, endSide: "additions" },
    hunk: { index: 0, header: "@@ -18,6 +18,8 @@" },
    lines: [
      {
        side: "deletions",
        lineNumber: 20,
        text: "  if (!link) return { status: 404 };",
      },
      {
        side: "deletions",
        lineNumber: 21,
        text: "  await links.update(linkId, { revokedAt: now() });",
      },
      {
        side: "additions",
        lineNumber: 20,
        text: "  if (!link) return notFound();",
      },
    ],
  },
  author: REVIEWER,
  body: "notFound() also logs; was the bare 404 intentional for revoked links?",
  createdAt: "2026-10-03T11:20:00.000Z",
  status: "open",
}

/* ── Long file (virtualization) ──────────────────────────
 * A generated 2,400-line module with three changed regions far apart, each
 * carrying markers or a comment, for the virtualized-overlay story. The
 * story shows the whole file (no folded context), so only rows near the
 * viewport render while the overlay stays aligned.
 */

const LONG_FILE_PATH = "src/sharing/audit-log.ts"
const LONG_FILE_LINES = 2400
const LONG_CHANGES = [122, 1210, 2330]

function longLine(n: number): string {
  const block = Math.floor((n - 1) / 8)
  switch ((n - 1) % 8) {
    case 0:
      return `export function auditEvent${block}(entry: AuditEntry) {`
    case 1:
      return `  const at = clock.now(); // event ${block}`
    case 2:
      return `  if (!entry.linkId) return skip("missing link", ${block});`
    case 3:
      return `  const actor = await actors.find(entry.actorId);`
    case 4:
      return `  await log.write({ kind: "share.${block}", actor, at });`
    case 5:
      return `  return { ok: true, id: entry.id };`
    case 6:
      return "}"
    default:
      return ""
  }
}

const longOld = Array.from({ length: LONG_FILE_LINES }, (_, i) =>
  longLine(i + 1)
)
const longNew = longOld.map((line, i) =>
  LONG_CHANGES.includes(i + 1)
    ? line.replace("clock.now()", "clock.monotonic()")
    : line
)

export const longDiffFile: DiffFile = {
  path: LONG_FILE_PATH,
  additions: LONG_CHANGES.length,
  deletions: LONG_CHANGES.length,
  oldContents: lines(longOld),
  newContents: lines(longNew),
  // Show every line: the virtualizer, not folding, keeps the DOM small.
  context: LONG_FILE_LINES,
  markerAnchors: [
    { markerKey: "doc", side: "additions", lineNumber: 122 },
    { markerKey: "graph", side: "additions", lineNumber: 1210 },
    { markerKey: "history", side: "additions", lineNumber: 2330 },
  ],
}

export const longFileDeskFixture: ReviewDeskData = {
  ...reviewDeskFixture,
  files: [longDiffFile],
  unit: {
    ...reviewDeskFixture.unit,
    stats: `1 file · ${LONG_FILE_LINES.toLocaleString("en-US")} lines · 3 markers`,
  },
}

export const longFileCommentFixtures: Array<ReviewCommentRecord> = [
  {
    schemaVersion: 2,
    id: "rc_seed_long",
    unitId: REVIEW_UNIT_ID,
    revision: reviewDeskFixture.revision,
    anchor: {
      filePath: LONG_FILE_PATH,
      range: { start: 1209, side: "additions", end: 1211 },
      hunk: { index: 0, header: "@@ -1,2400 +1,2400 @@" },
      lines: [1209, 1210, 1211].map((lineNumber) => ({
        side: "additions" as const,
        lineNumber,
        text: longNew[lineNumber - 1] ?? "",
      })),
    },
    author: REVIEWER,
    body: "Monotonic time is right for ordering, but the log reader sorts by wall clock. Keep both?",
    createdAt: "2026-10-03T10:02:00.000Z",
    status: "open",
  },
]
