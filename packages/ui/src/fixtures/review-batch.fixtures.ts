/**
 * Sample review batch — the single fixtures module for the UI package.
 *
 * Content is transcribed from the approved design source (Main.dc.html
 * MARKERS / FILES / NEIGHBOR_ROWS and Overview.dc.html LANES and copy) for
 * the `acme/docs-app` SHR-212 batch. Stories and, until a backend exists, the
 * app routes both read from here. Nothing else in the repo defines sample
 * data.
 */
import type { ScriptStep } from "../neuve/review-comments/mock-thread-relay"
import type { ReviewCommentRecord } from "../neuve/review-comments/record"
import type {
  ReviewThread,
  ThreadMessage,
} from "../neuve/review-comments/thread"
import type {
  AgentRegistry,
  BatchOverviewData,
  BatchUnit,
  CommitLineage,
  ContextualMarker,
  DiffFile,
  ReviewDeskData,
  SourceAction,
} from "../neuve/types"

export const REVIEW_UNIT_ID = "revoke-cuts-off-open-sessions"

/* ── Units of the batch ───────────────────────────────────
 * Every unit a shared marker can link to (Main.dc.html UNITS), with its
 * lane. The rail tone-shifts the linked ones while a shared marker is
 * pointed at or open.
 */

export const ADMINS_UNIT_ID = "workspace-admins-may-revoke"
export const LINK_LIST_UNIT_ID = "link-list-shows-revoked-state"
export const AUDIT_UNIT_ID = "audit-event-for-revocation"
export const SESSIONS_UNIT_ID = "session-invalidation-by-link"
export const RATE_LIMIT_UNIT_ID = "rate-limit-the-revoke-endpoint"
export const API_CLIENT_UNIT_ID = "regenerated-api-client"
export const LINK_CACHE_UNIT_ID = "link-cache-eviction"
export const LOCKFILE_UNIT_ID = "lockfile-update"

const BATCH_UNITS: Array<BatchUnit> = [
  {
    id: REVIEW_UNIT_ID,
    title: "Revoke cuts off open sessions",
    lane: "human-required",
  },
  {
    id: ADMINS_UNIT_ID,
    title: "Workspace admins may revoke any link",
    lane: "human-required",
  },
  {
    id: LINK_LIST_UNIT_ID,
    title: "Link list shows revoked state",
    lane: "human-suggested",
  },
  {
    id: AUDIT_UNIT_ID,
    title: "Audit event for revocation",
    lane: "human-suggested",
  },
  {
    id: RATE_LIMIT_UNIT_ID,
    title: "Rate-limit the revoke endpoint",
    lane: "human-suggested",
  },
  {
    id: SESSIONS_UNIT_ID,
    title: "Session invalidation by link",
    lane: "agentic-review",
  },
  {
    id: LINK_CACHE_UNIT_ID,
    title: "Link cache eviction",
    lane: "agentic-review",
  },
  {
    id: API_CLIENT_UNIT_ID,
    title: "Regenerated API client",
    lane: "static-automation",
  },
  {
    id: LOCKFILE_UNIT_ID,
    title: "Lockfile update",
    lane: "static-automation",
  },
]

/* ── Agents on the branch ─────────────────────────────────
 * Header.dc.html AGENTS. Roles, scopes and routing are Neuve's (the ACP
 * research found ACP carries none of them). `configured` is the server-side
 * registry Connect picks from; the browser never supplies a command.
 */

export const agentRegistryFixture: AgentRegistry = {
  agents: [
    {
      id: "i1",
      short: "I1",
      name: "Implementer 1",
      role: "implementer",
      scope: { label: "Sharing", paths: ["src/sharing/**"] },
      unitCount: 4,
    },
    {
      id: "i2",
      short: "I2",
      name: "Implementer 2",
      role: "implementer",
      scope: { label: "Sessions", paths: ["src/sessions/**"] },
      unitCount: 2,
    },
    {
      id: "r1",
      short: "R1",
      name: "Reviewer 1",
      role: "reviewer",
      scope: { label: "Sharing", paths: ["src/sharing/**"] },
      unitCount: 4,
    },
    {
      id: "r2",
      short: "R2",
      name: "Reviewer 2",
      role: "reviewer",
      scope: { label: "Sessions", paths: ["src/sessions/**"] },
      unitCount: 2,
    },
  ],
  configured: [
    {
      id: "eve-local",
      label: "eve local harness",
      roles: ["reviewer"],
    },
    {
      id: "claude-code-local",
      label: "Claude Code on this machine",
      roles: ["implementer", "reviewer"],
    },
  ],
  connections: {
    i1: {
      status: "connected",
      harnessId: "claude-code-local",
      activity: "Working · Bump link version",
    },
    i2: {
      status: "connected",
      harnessId: "claude-code-local",
      activity: "Idle",
    },
    r1: { status: "connected", harnessId: "eve-local", activity: "Reviewing" },
    r2: { status: "disconnected" },
  },
}

/* ── Contextual markers ───────────────────────────────────
 * Main.dc.html MARKERS + KIND + VIZ + SHEETS + SHARED: the L1 peek, the L2
 * card (kind label, excerpt, why it's here, "Before you decide"), the L3
 * source sheet, and the units that share each marker.
 */

const EDITORS = (path: string): Array<SourceAction> => [
  { kind: "editor", editor: "VS Code", path },
  { kind: "editor", editor: "Cursor", path },
  { kind: "editor", editor: "Zed", path },
  { kind: "copy-path", path },
]

const MARKERS: Record<string, ContextualMarker> = {
  doc: {
    key: "doc",
    tone: "doc",
    short: "Doc",
    peek: "Only owners and editors may revoke a link.",
    kindLabel: "Doc · committed",
    title: "docs/sharing/permissions.md",
    meta: "§ Managing links · 9c04e1a",
    quote:
      "Only the document owner and editors can revoke a share link. Viewers never can.",
    excerpt: {
      kind: "quote",
      text: "Only the document owner and editors can revoke a share link. Viewers never can.",
    },
    applies: "This line adds the editor check the doc requires.",
    check:
      "The doc says owners and editors. It never mentions workspace admins, so that call sits in the admins unit.",
    checkAction: {
      kind: "unit",
      label: "Open admins unit",
      unitId: ADMINS_UNIT_ID,
    },
    sharedWith: [ADMINS_UNIT_ID],
    source: {
      kind: "Doc",
      chips: [{ text: "Committed", tone: "neutral" }],
      title: "Managing share links",
      subtitle: "docs/sharing/permissions.md · § Managing links",
      actions: EDITORS("docs/sharing/permissions.md"),
      facts: [
        { label: "Owner", value: "Docs team" },
        { label: "Changed", value: "2026-04-11" },
      ],
      blocks: [
        {
          kind: "text",
          text: "Share links give anyone with the URL read access until the link expires or is revoked.",
        },
        {
          kind: "quote",
          text: "Only the document owner and editors can revoke a share link. Viewers never can.",
        },
        { kind: "text", text: "Revoking a link is recorded in the audit log." },
      ],
      citedBy: ["This unit", "Workspace admins may revoke any link"],
    },
  },
  graph: {
    key: "graph",
    tone: "graph",
    short: "Graph",
    peek: "link.version is read by 4 entities within 2 hops.",
    kindLabel: "Graph · blast radius",
    title: "Blast radius of link.version",
    meta: "incoming CALLS · 2 hops · 9c04e1a",
    quote: "link.version is read by 4 entities within 2 hops.",
    excerpt: {
      kind: "tree",
      nodes: [
        { prefix: "", name: "link.version", where: "", tone: "root" },
        {
          prefix: "├ ",
          name: "canOpen",
          where: "access-policy.ts",
          fullPath: "src/sharing/access-policy.ts:41",
          tone: "node",
        },
        {
          prefix: "│ └ ",
          name: "openSharedDocument",
          where: "routes/open.ts",
          fullPath: "src/routes/open.ts:12",
          tone: "node",
        },
        {
          prefix: "├ ",
          name: "exportLinkReport",
          where: "reports/links.ts",
          fullPath: "src/reports/links.ts:30",
          tone: "node",
        },
        {
          prefix: "└ ",
          name: "syncLinkCache",
          where: "not traced",
          fullPath: "src/cache/links.ts:8",
          tone: "untraced",
        },
      ],
    },
    applies: "Every reader in this tree sees the new version bump.",
    check:
      "syncLinkCache couldn’t be traced. Confirm it doesn’t keep serving the old version.",
    checkAction: {
      kind: "file",
      label: "Open cache/links.ts",
      path: "src/cache/links.ts",
    },
    sharedWith: [LINK_LIST_UNIT_ID, AUDIT_UNIT_ID],
    source: {
      kind: "Graph",
      chips: [{ text: "Committed · 9c04e1a", tone: "neutral" }],
      title: "Readers of link.version",
      subtitle: "incoming · CALLS · depth 2",
      actions: [],
      facts: [
        { label: "Readers", value: "4 within 2 hops" },
        { label: "Coverage", value: "1 edge unresolved", tone: "req" },
      ],
      blocks: [
        {
          kind: "rows",
          mono: true,
          rows: [
            {
              mark: "1 hop",
              label: "canOpen",
              sub: "src/sharing/access-policy.ts:41",
              meta: "",
              openPath: "src/sharing/access-policy.ts:41",
            },
            {
              mark: "2 hops",
              label: "openSharedDocument",
              sub: "src/routes/open.ts:12",
              meta: "",
              openPath: "src/routes/open.ts:12",
            },
            {
              mark: "1 hop",
              label: "exportLinkReport",
              sub: "src/reports/links.ts:30",
              meta: "",
              openPath: "src/reports/links.ts:30",
            },
            {
              mark: "1 hop",
              label: "syncLinkCache · unresolved",
              sub: "src/cache/links.ts:8",
              meta: "",
              tone: "req",
              openPath: "src/cache/links.ts:8",
            },
          ],
        },
        {
          kind: "text",
          text: "Committed tree only. Same-batch hunks aren’t in this graph.",
        },
      ],
      citedBy: ["This unit", "Link list shows revoked state"],
    },
  },
  conflict: {
    key: "conflict",
    tone: "conflict",
    short: "Conflict",
    peek: "SHR-212 and 7d1e0b4 disagree about open sessions.",
    kindLabel: "Decision signal",
    title: "Conflicting intent",
    meta: "Ticket SHR-212 · history 7d1e0b4",
    quote:
      "Revoking a link must end access immediately, including people who already have the document open.",
    excerpt: {
      kind: "versus",
      a: {
        source: "SHR-212 · ticket",
        text: "End access immediately, open sessions included.",
      },
      b: {
        source: "7d1e0b4 · May",
        text: "Keep viewer sessions alive across permission changes.",
      },
    },
    applies: "This line ends open sessions, which follows SHR-212.",
    check:
      "Pick which intent wins before you approve. Tests can’t settle this.",
    checkAction: { kind: "ask", label: "Ask the implementer" },
    sharedWith: [SESSIONS_UNIT_ID],
    source: {
      kind: "Ticket",
      chips: [
        { text: "Pinned scope", tone: "sug" },
        { text: "In progress", tone: "neutral" },
      ],
      title: "Revoke share links immediately",
      subtitle: "SHR-212 · Linear",
      actions: [
        {
          kind: "external",
          label: "Open in Linear",
          href: "https://linear.app/acme/issue/SHR-212",
        },
      ],
      facts: [
        { label: "Owner", value: "Maya Chen" },
        { label: "Opened", value: "2026-09-22" },
        {
          label: "Conflicts with",
          value: "7d1e0b4 · keep sessions alive",
          tone: "req",
        },
      ],
      blocks: [
        {
          kind: "quote",
          text: "Revoking a link must end access immediately, including people who already have the document open.",
        },
        { kind: "label", text: "Done when" },
        {
          kind: "rows",
          rows: [
            {
              mark: "◉",
              label: "The old link is denied",
              meta: "observed",
              tone: "agt",
            },
            {
              mark: "!",
              label: "Open sessions are denied",
              meta: "no evidence",
              tone: "req",
            },
          ],
        },
      ],
      citedBy: [
        "Revoke cuts off open sessions",
        "Session invalidation by link",
      ],
    },
  },
  batch: {
    key: "batch",
    tone: "batch",
    short: "Same batch",
    peek: "Defined in an unstaged hunk — still unapproved.",
    kindLabel: "Same batch · unreviewed",
    title: "invalidateByLink",
    meta: "src/sessions/sessions.ts · unstaged",
    quote:
      "export async function invalidateByLink(linkId) {\n  await store.deleteWhere({ linkId });\n}",
    excerpt: {
      kind: "code",
      code: "export async function invalidateByLink(linkId) {\n  await store.deleteWhere({ linkId });\n}",
    },
    applies: "Line 23 calls this helper.",
    check:
      "Your approval covers the call, not the helper. The helper has its own unit, and the agent already sent it back.",
    checkAction: {
      kind: "unit",
      label: "Go to that unit",
      unitId: SESSIONS_UNIT_ID,
    },
    sharedWith: [SESSIONS_UNIT_ID],
    source: {
      kind: "Code",
      chips: [{ text: "Unapproved · same batch", tone: "outline" }],
      title: "invalidateByLink",
      subtitle: "src/sessions/sessions.ts:12–14",
      actions: EDITORS("src/sessions/sessions.ts:12"),
      facts: [
        { label: "Its unit", value: "Session invalidation by link" },
        {
          label: "Lane",
          value: "Agentic review · changes requested",
          tone: "req",
        },
        {
          label: "Called from",
          value: "revoke.ts:23 · this unit",
          mono: true,
        },
        { label: "Changed", value: "Unstaged · 4 min ago" },
      ],
      blocks: [
        {
          kind: "code",
          lines: [
            {
              number: 10,
              text: "import { store } from './store';",
              cited: false,
            },
            { number: 11, text: "", cited: false },
            {
              number: 12,
              text: "export async function invalidateByLink(linkId) {",
              cited: true,
            },
            {
              number: 13,
              text: "  await store.deleteWhere({ linkId });",
              cited: true,
            },
            { number: 14, text: "}", cited: true },
            { number: 15, text: "", cited: false },
          ],
        },
        {
          kind: "text",
          text: "Explains the call on line 23. Approving the unit doesn’t approve this.",
        },
      ],
      citedBy: ["This unit"],
      goToUnit: SESSIONS_UNIT_ID,
    },
  },
  test: {
    key: "test",
    tone: "test",
    short: "Test",
    peek: "Checks the 204 response only.",
    kindLabel: "Evidence gap",
    title: "test/sharing/revoke.test.ts",
    meta: "“returns 204 for owner” · passed on a3f9c2e",
    quote: "expect(res.status).toBe(204)",
    excerpt: { kind: "code", code: "expect(res.status).toBe(204)" },
    applies: "It exercises this return path.",
    check:
      "No test opens the old link after revoking. Ask for one before relying on it.",
    checkAction: { kind: "request-check", label: "Request a check" },
    sharedWith: [AUDIT_UNIT_ID],
    source: {
      kind: "Test",
      chips: [{ text: "Evidence gap", tone: "sug" }],
      title: "returns 204 for owner",
      subtitle: "test/sharing/revoke.test.ts:14",
      actions: EDITORS("test/sharing/revoke.test.ts:14"),
      facts: [
        { label: "Ran on", value: "a3f9c2e", mono: true },
        { label: "Result", value: "Passed · response only", tone: "sug" },
      ],
      blocks: [
        {
          kind: "code",
          lines: [
            {
              number: 14,
              text: "it('returns 204 for owner', async () => {",
              cited: false,
            },
            {
              number: 15,
              text: "  const res = await api.revoke(link.id, owner);",
              cited: false,
            },
            {
              number: 16,
              text: "  expect(res.status).toBe(204);",
              cited: true,
            },
            { number: 17, text: "});", cited: false },
          ],
        },
        {
          kind: "text",
          text: "Not covered: opening the old link, or an open session, after revoking it.",
        },
      ],
      citedBy: ["This unit", "Audit event for revocation"],
    },
  },
  history: {
    key: "history",
    tone: "history",
    short: "History",
    peek: "March regression: revoked links opened from cache.",
    kindLabel: "Regression history",
    title: "Commit 2c88f10 · hotfix",
    meta: "Mar 2026 · INC-41",
    quote: "Revoked links still opened when the viewer was served from cache.",
    excerpt: {
      kind: "quote",
      text: "Revoked links still opened when the viewer was served from cache.",
    },
    applies: "This moves the March hotfix check into canOpen.",
    check:
      "The old check in routes/open.ts may now be redundant. Decide whether it stays.",
    checkAction: {
      kind: "file",
      label: "Open routes/open.ts",
      path: "src/routes/open.ts",
    },
    sharedWith: [],
    source: {
      kind: "History",
      chips: [{ text: "Regression", tone: "req" }],
      title: "Hotfix: deny revoked links served from cache",
      subtitle: "2c88f10 · 2026-03-04 · INC-41",
      actions: [
        {
          kind: "link",
          label: "Show commit",
          href: "https://github.com/acme/docs-app/commit/2c88f10",
        },
        {
          kind: "external",
          label: "INC-41",
          href: "https://linear.app/acme/issue/INC-41",
        },
      ],
      facts: [
        { label: "Author", value: "Maya Chen" },
        { label: "Reviewed", value: "Human-required · approved" },
      ],
      blocks: [
        {
          kind: "quote",
          text: "Revoked links still opened when the viewer was served from cache.",
        },
        {
          kind: "rows",
          mono: true,
          rows: [
            {
              mark: "▢",
              label: "src/routes/open.ts",
              meta: "",
              stat: { additions: 6, deletions: 1 },
            },
            {
              mark: "▢",
              label: "test/routes/open.test.ts",
              meta: "",
              stat: { additions: 18 },
            },
          ],
        },
        {
          kind: "text",
          text: "This unit moves that check into canOpen. The route check may now be redundant.",
        },
      ],
      citedBy: ["This unit"],
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

/* ── Read-only neighbor ──────────────────────────────────
 * The regenerated API client (static automation). Lines 88–90 are the
 * artboard rows; the rest is generated-looking filler so the forked renderer
 * can fold and expand context like any other file.
 */

const API_CLIENT_ENDPOINTS = [
  "listDocuments",
  "getDocument",
  "createDocument",
  "renameDocument",
  "archiveDocument",
  "listShareLinks",
  "createShareLink",
  "updateShareLink",
  "listMembers",
  "inviteMember",
]

const API_CLIENT_HEAD = [
  "// Code generated from openapi.yaml. DO NOT EDIT.",
  'import { HttpClient } from "./http";',
  "",
  "export class ApiClient extends HttpClient {",
  ...API_CLIENT_ENDPOINTS.flatMap((name, i) => [
    `  ${name}(id: string) {`,
    `    return this.get(\`/v1/${name}/\${id}\`);`,
    "  }",
    "",
    `  // ${name} · operation ${i + 1}`,
    `  ${name}Raw(id: string) {`,
    `    return this.raw(\`/v1/${name}/\${id}\`);`,
    "  }",
  ]),
]

const API_CLIENT_FILL = Array.from(
  { length: 87 - API_CLIENT_HEAD.length },
  (_, i) => `  // reserved ${i + 1}`
)

const API_CLIENT_TAIL = ["}"]

const API_CLIENT_OLD = [
  ...API_CLIENT_HEAD,
  ...API_CLIENT_FILL,
  "  revokeShareLink(id: string) {",
  "    return this.post(`/links/${id}/revoke`);",
  "  }",
  ...API_CLIENT_TAIL,
]

const API_CLIENT_NEW = [
  ...API_CLIENT_HEAD,
  ...API_CLIENT_FILL,
  "  revokeShareLink(id: string) {",
  "    return this.post(`/links/${id}/revoke`, { expect: [204, 404] });",
  "  }",
  ...API_CLIENT_TAIL,
]

const NEIGHBOR_FILE: DiffFile = {
  path: "src/gen/api-client.ts",
  additions: 1,
  deletions: 1,
  oldContents: lines(API_CLIENT_OLD),
  newContents: lines(API_CLIENT_NEW),
  context: 1,
  markerAnchors: [],
}

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
    agentId: "i1",
  },
  railUnits: [
    {
      id: REVIEW_UNIT_ID,
      title: "Revoke cuts off open sessions",
      hunkCount: 3,
      agentId: "i1",
    },
    {
      id: ADMINS_UNIT_ID,
      title: "Workspace admins may revoke any link",
      hunkCount: 2,
      agentId: "i2",
    },
  ],
  elsewhere: [
    {
      lane: "human-suggested",
      label: "Suggested",
      count: 3,
      note: "Agent approved · yours to override",
      units: [
        {
          id: AUDIT_UNIT_ID,
          title: "Audit event for revocation",
          result: "agent ✓",
        },
        {
          id: LINK_LIST_UNIT_ID,
          title: "Link list shows revoked state",
          result: "agent ✓",
        },
        {
          id: RATE_LIMIT_UNIT_ID,
          title: "Rate-limit the revoke endpoint",
          result: "agent ✓",
        },
      ],
    },
    {
      lane: "agentic-review",
      label: "Agentic review",
      count: 7,
      units: [
        {
          id: SESSIONS_UNIT_ID,
          title: "Session invalidation by link",
          result: "changes",
          tone: "req",
        },
        {
          id: LINK_CACHE_UNIT_ID,
          title: "Link cache eviction",
          result: "agent ✓",
        },
      ],
    },
    {
      lane: "static-automation",
      label: "Static automation",
      count: 12,
      units: [
        {
          id: API_CLIENT_UNIT_ID,
          title: "Regenerated API client",
          result: "passed",
        },
        { id: LOCKFILE_UNIT_ID, title: "Lockfile update", result: "passed" },
      ],
    },
  ],
  batchUnits: BATCH_UNITS,
  agents: agentRegistryFixture,
  markers: MARKERS,
  files: FILES,
  neighbor: {
    path: "src/gen/api-client.ts",
    note: "Read-only · static automation ✓",
    unitId: API_CLIENT_UNIT_ID,
    laneLabel: "static automation",
    file: NEIGHBOR_FILE,
    contextNotes: [
      {
        key: "neighbor-doc",
        short: "Doc",
        note: "Generated from openapi.yaml · same batch",
        side: "additions",
        lineNumber: 88,
      },
      {
        key: "neighbor-test",
        short: "Test",
        note: "Client regen check passed on a3f9c2e",
        side: "additions",
        lineNumber: 89,
      },
    ],
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
      agentId: "i1",
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
      id: ADMINS_UNIT_ID,
      title: "Workspace admins may revoke any link",
      agentId: "i2",
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
  agents: agentRegistryFixture,
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

/* ── Comment threads (Threads.dc.html, Main.dc.html c1/c2) ─
 * Replies after each seeded comment, and one thread per state for stories.
 * Times are relative to load so "18 min" reads the same in every run.
 */

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString()

const I1 = {
  kind: "agent",
  agentId: "i1",
  name: "Implementer 1",
  short: "I1",
} as const

export const SESSIONS_COMMENT_ID = "rc_seed_sessions"
export const POLICY_COMMENT_ID = "rc_seed_policy"

export const reviewThreadFixtures: Array<ReviewThread> = [
  {
    commentId: SESSIONS_COMMENT_ID,
    agentId: "i1",
    state: "replied",
    steps: [],
    messages: [
      {
        id: "tm_sessions_1",
        author: I1,
        body: "Agreed. I’ll wrap both in links.transaction() in the next revision.",
        at: minutesAgo(15),
      },
    ],
  },
  {
    commentId: POLICY_COMMENT_ID,
    agentId: "i1",
    state: "replied",
    steps: [],
    messages: [
      {
        id: "tm_policy_1",
        author: I1,
        body: "Done in a3f9c2e.",
        at: minutesAgo(52),
        chips: [{ text: "a3f9c2e", tone: "neutral" }],
      },
    ],
  },
]

/** The reviewer's follow-up in Threads.dc.html. */
export const followUpReply: ThreadMessage = {
  id: "tm_sessions_you",
  author: { kind: "human", ...reviewDeskFixture.reviewer },
  body: "Go with SHR-212. Add a test that reloads an open session.",
  at: minutesAgo(1),
}

const AGENT_REPLY: ThreadMessage = {
  id: "tm_sessions_done",
  author: I1,
  body: "Done. Sessions end on revoke, and a test now reloads an open session after revoking.",
  at: minutesAgo(0),
  chips: [
    { text: "b71e5aa", tone: "neutral" },
    { text: "+1 test", tone: "agt" },
  ],
}

const STEPS = [
  {
    id: "s1",
    kind: "narration",
    text: "Reading revoke.ts and the session store",
  },
  { id: "s2", kind: "tool", text: "Edit src/sharing/revoke.ts" },
  { id: "s3", kind: "tool", text: "Run bun test test/sharing" },
] as const

const base = reviewThreadFixtures[0]!

/** The sessions thread after the follow-up, in each delivery state. */
export const threadStateFixtures: Record<ReviewThread["state"], ReviewThread> =
  {
    queued: {
      ...base,
      state: "queued",
      messages: [...base.messages, followUpReply],
    },
    sent: {
      ...base,
      state: "sent",
      messages: [...base.messages, followUpReply],
    },
    "picked-up": {
      ...base,
      state: "picked-up",
      messages: [...base.messages, followUpReply],
    },
    working: {
      ...base,
      state: "working",
      messages: [...base.messages, followUpReply],
      steps: [...STEPS],
    },
    "needs-input": {
      ...base,
      state: "needs-input",
      messages: [...base.messages, followUpReply],
      steps: [...STEPS.slice(0, 2)],
      permission: {
        id: "perm_1",
        request: "Run bun test test/sharing",
        detail: "Runs the sharing tests on this machine.",
      },
    },
    failed: {
      ...base,
      state: "failed",
      messages: [...base.messages, followUpReply],
      failure: "Implementer 1 disconnected before the reply was delivered.",
    },
    replied: {
      ...base,
      state: "replied",
      messages: [...base.messages, followUpReply, AGENT_REPLY],
    },
  }

/**
 * Mock relay script for a reply: sent → picked up → working (narration,
 * a tool call, a permission request) → … The rest plays after the answer.
 */
export function threadReplyScript(commentId: string): Array<ScriptStep> {
  return [
    { after: 500, event: { type: "sent", commentId } },
    { after: 700, event: { type: "picked-up", commentId } },
    {
      after: 700,
      event: {
        type: "narration",
        commentId,
        stepId: "n1",
        text: "Reading revoke.ts and the session store",
      },
    },
    {
      after: 600,
      event: {
        type: "tool-call",
        commentId,
        stepId: "t1",
        text: "Edit src/sharing/revoke.ts",
      },
    },
    {
      after: 600,
      event: {
        type: "permission-requested",
        commentId,
        permission: {
          id: "perm_run_tests",
          request: "Run bun test test/sharing",
          detail: "Runs the sharing tests on this machine.",
        },
      },
    },
  ]
}

/** After "Allow once": tests run, an inner-loop commit, the final reply. */
export function threadPermissionScript(
  commentId: string,
  outcome: "allowed" | "denied"
): Array<ScriptStep> {
  if (outcome === "denied") {
    return [
      {
        after: 800,
        event: {
          type: "replied",
          commentId,
          message: {
            ...AGENT_REPLY,
            id: `${commentId}_denied`,
            body: "Understood. I left the tests for you to run; the change is in b71e5aa.",
            chips: [{ text: "b71e5aa", tone: "neutral" }],
          },
        },
      },
    ]
  }
  return [
    {
      after: 700,
      event: {
        type: "tool-call",
        commentId,
        stepId: "t2",
        text: "Run bun test test/sharing · 14 passed",
      },
    },
    {
      after: 700,
      event: {
        type: "commit",
        commentId,
        stepId: "c1",
        commit: "b71e5aa",
        text: "End sessions on revoke; reload test",
      },
    },
    {
      after: 700,
      event: {
        type: "replied",
        commentId,
        message: { ...AGENT_REPLY, id: `${commentId}_reply` },
      },
    },
  ]
}

/** Retry after a failure: delivered this time, then the same reply flow. */
export function threadRetryScript(commentId: string): Array<ScriptStep> {
  return threadReplyScript(commentId)
}

/* ── New commit mid-review (Cycle.dc.html) ─────────────── */

export const newCommitFixture = {
  commit: "b71e5aa",
  needYou: 3,
  reviewing: "a3f9c2e",
}

export const reviewDeskWithNewCommitFixture: ReviewDeskData = {
  ...reviewDeskFixture,
  threads: reviewThreadFixtures,
  newCommit: newCommitFixture,
}

export const commitLineageFixture: CommitLineage = {
  repo: "acme/docs-app",
  branch: "shr-212-revoke-links",
  from: "a3f9c2e",
  to: "b71e5aa",
  cycle: 3,
  needYou: 3,
  carried: 2,
  entries: [
    {
      id: "renewed",
      relation: "renewed",
      before: [{ title: "canOpen guard", result: "you ✓", tone: "approved" }],
      after: "Same hunk · text unchanged",
      afterNote: "A helper it calls changed",
      needsYou: true,
      unitId: ADMINS_UNIT_ID,
      renewed: {
        approved: {
          file: "access-policy.ts",
          note: "unchanged · you approved",
          line: 43,
          text: "  return link.active && viewer.linkVersion >= link.version;",
        },
        changed: {
          file: "viewer.ts",
          note: "changed in b71e5aa",
          line: 17,
          removed: "  linkVersion: link.version,",
          added: "  linkVersion: session.linkVersion ?? 0,",
        },
        why: "Older sessions now default to version 0, so the guard you approved denies every existing viewer.",
        evidence: "graph · viewer.linkVersion · 1 hop · no test yet",
      },
    },
    {
      id: "corrected",
      relation: "corrected",
      before: [
        {
          title: "canOpen checks active only",
          result: "you ✕",
          tone: "changes",
        },
      ],
      after: "Bump link version on revoke",
      afterNote: "Answers your comment",
      needsYou: true,
      unitId: REVIEW_UNIT_ID,
      quote: "“Stale viewers can still open the link.”",
      note: "The correction links your comment as its reason.",
    },
    {
      id: "regrouped",
      relation: "regrouped",
      before: [
        { title: "Revoke returns 204", result: "you ✓", tone: "approved" },
        { title: "Session store cleanup", result: "agent ✓", tone: "agent" },
      ],
      after: "Revoke cuts off open sessions",
      afterNote: "2 changed hunks",
      needsYou: true,
      unitId: REVIEW_UNIT_ID,
      note: "Both earlier approvals stay with the hunks they covered. Only the two changed hunks ask for a decision.",
    },
    {
      id: "audit",
      relation: "carried",
      before: [
        {
          title: "Audit event for revocation",
          result: "agent ✓",
          tone: "agent",
        },
      ],
      after: "No decision needed",
      afterNote: "Shown as context where it helps",
      needsYou: false,
      note: "Unaffected by b71e5aa. Its evidence is reused, not re-run.",
    },
    {
      id: "rate",
      relation: "carried",
      before: [
        {
          title: "Rate-limit the revoke endpoint",
          result: "agent ✓",
          tone: "agent",
        },
      ],
      after: "No decision needed",
      afterNote: "Unaffected",
      needsYou: false,
      note: "Unaffected by b71e5aa.",
    },
  ],
}

/* ── Units in other lanes (Lanes.dc.html) ─────────────────
 * Per-unit decisions only: a suggested unit takes Agree / Request changes;
 * agentic and static units take a Comment for their next cycle.
 */

const AUDIT_OLD = [
  'import { audit } from "../db/audit";',
  "",
  "export function recordRevocation(linkId: string) {",
  "  return Promise.resolve(linkId);",
  "}",
]

const AUDIT_NEW = [
  'import { audit } from "../db/audit";',
  "",
  "export function recordRevocation(linkId: string, actor: Actor) {",
  '  return audit.write("link.revoked", { linkId, actor: actor.id });',
  "}",
]

const SESSIONS_OLD = [
  "import { store } from './store';",
  "",
  "export async function invalidateBySession(sessionId) {",
  "  await store.delete(sessionId);",
  "}",
]

const SESSIONS_NEW = [
  "import { store } from './store';",
  "",
  "export async function invalidateBySession(sessionId) {",
  "  await store.delete(sessionId);",
  "}",
  "",
  "export async function invalidateByLink(linkId) {",
  "  await store.deleteWhere({ linkId });",
  "}",
]

function laneUnit(
  unit: Partial<ReviewDeskData["unit"]> &
    Pick<ReviewDeskData["unit"], "id" | "title" | "lane" | "attribution">,
  files: Array<DiffFile>
): ReviewDeskData {
  return {
    ...reviewDeskFixture,
    unit: {
      ...reviewDeskFixture.unit,
      briefing: [],
      defaultAttachment: "",
      draftSuggestion: "",
      hunkCount: files.length,
      stats: `${files.length} file${files.length === 1 ? "" : "s"}`,
      position: { index: 1, of: 1 },
      ...unit,
    },
    markers: {},
    files,
    neighbor: undefined,
  }
}

export const suggestedUnitFixture: ReviewDeskData = laneUnit(
  {
    id: AUDIT_UNIT_ID,
    title: "Audit event for revocation",
    lane: "human-suggested",
    agentId: "i1",
    attribution: {
      headline: "Agent approved",
      meta: "agentic review · a3f9c2e",
      summary:
        "Writes link.revoked to the audit log on every revoke. The event omits the actor’s role.",
      outcome: "approved",
      evidence: ["audit.test.ts ✓"],
    },
  },
  [
    {
      path: "src/sharing/audit.ts",
      additions: 2,
      deletions: 2,
      oldContents: lines(AUDIT_OLD),
      newContents: lines(AUDIT_NEW),
      context: 2,
      markerAnchors: [],
    },
  ]
)

export const agenticUnitFixture: ReviewDeskData = laneUnit(
  {
    id: SESSIONS_UNIT_ID,
    title: "Session invalidation by link",
    lane: "agentic-review",
    agentId: "i2",
    attribution: {
      headline: "Agent requested changes",
      meta: "sent back to the implementer",
      summary:
        "deleteWhere drops sessions for every link on the document, not just this one.",
      outcome: "changes-requested",
      waiting: "Waiting for the next revision",
      checks: [
        {
          title: "Over-broad delete in sessions.ts:14",
          detail: "",
          meta: "blocking",
          tone: "blocking",
        },
        {
          title: "No index on sessions.linkId",
          detail: "",
          meta: "note",
          tone: "note",
        },
      ],
    },
  },
  [
    {
      path: "src/sessions/sessions.ts",
      additions: 4,
      deletions: 0,
      oldContents: lines(SESSIONS_OLD),
      newContents: lines(SESSIONS_NEW),
      context: 2,
      markerAnchors: [],
    },
  ]
)

export const staticUnitFixture: ReviewDeskData = laneUnit(
  {
    id: API_CLIENT_UNIT_ID,
    title: "Regenerated API client",
    lane: "static-automation",
    attribution: {
      headline: "Passed static automation",
      meta: "checked by tools",
      outcome: "passed",
      checks: [
        {
          title: "Matches openapi.yaml",
          detail: "bun run gen:client --check",
          meta: "2.1s",
          tone: "passed",
        },
        {
          title: "Types",
          detail: "tsc --noEmit",
          meta: "6.8s",
          tone: "passed",
        },
      ],
      generatedDiff: { label: "Show generated diff", file: NEIGHBOR_FILE },
    },
  },
  []
)

/** The desk as the app serves it today: fixtures plus the seeded threads. */
export const reviewDeskLiveFixture: ReviewDeskData = {
  ...reviewDeskFixture,
  threads: reviewThreadFixtures,
}
