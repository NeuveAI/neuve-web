import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, waitFor, within } from "storybook/test"

import {
  SESSIONS_COMMENT_ID,
  agenticUnitFixture,
  reviewCommentFixtures,
  reviewDeskFixture,
  reviewDeskLiveFixture,
  reviewDeskWithNewCommitFixture,
  staticUnitFixture,
  suggestedUnitFixture,
  threadPermissionScript,
  threadReplyScript,
  threadRetryScript,
  threadStateFixtures,
} from "@workspace/ui/fixtures/review-batch.fixtures"
import { ReviewDeskScreen } from "@workspace/ui/neuve/review-desk/review-desk-screen"
import { commentMarkerKey } from "@workspace/ui/neuve/review-comments/markers"
import { createMockThreadRelay } from "@workspace/ui/neuve/review-comments/mock-thread-relay"
import { createMemoryReviewCommentRepository } from "@workspace/ui/neuve/review-comments/repository"

/**
 * Review desk screen (Main.dc.html). Every state of the disclosure model and
 * the decision dock is reachable by interaction from `Rest`; the other
 * stories seed one state directly.
 */
const meta = {
  title: "Screens/Review desk",
  component: ReviewDeskScreen,
  // Stories never read or write the reviewer's real local comments.
  args: {
    data: reviewDeskLiveFixture,
    commentRepository: createMemoryReviewCommentRepository(),
    initialState: { railCollapsed: false },
  },
  argTypes: {
    commentRepository: { control: false },
    threadEvents: { control: false },
    agentConnector: { control: false },
  },
} satisfies Meta<typeof ReviewDeskScreen>

export default meta
type Story = StoryObj<typeof meta>

const SESSIONS_MARKER = commentMarkerKey(SESSIONS_COMMENT_ID)

/** Every diff host (unit files and the neighbor). */
function hosts(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>("diffs-container"))
}

export const Rest: Story = {}

/** L2: the conflict card is open; other pins dim and leave the tab order. */
export const ContextCardOpen: Story = {
  args: { initialState: { openMarker: "conflict", railCollapsed: false } },
}

/** L2 on a second pin of the same line (sibling pin stays enabled). */
export const SameBatchCardOpen: Story = {
  args: { initialState: { openMarker: "batch", railCollapsed: false } },
}

/** Graph card open: the read-by tree, and its two suggested units linked in the rail. */
export const GraphCardOpen: Story = {
  args: { initialState: { openMarker: "graph", railCollapsed: false } },
}

/**
 * The open card sticks at the top while the unit scrolls, capped at the
 * viewport and scrolling inside itself. The play scrolls the unit column.
 */
export const CardSticksWhileScrolling: Story = {
  args: { initialState: { openMarker: "conflict", railCollapsed: false } },
  play: async ({ canvasElement }) => {
    const card = await waitFor(() => {
      const found = canvasElement.querySelector<HTMLElement>(
        "[data-context-card]"
      )
      expect(found).toBeTruthy()
      return found!
    })
    const scroller = canvasElement.querySelector<HTMLElement>("main > div")!
    scroller.scrollTop = 600
    await waitFor(() => {
      const top = card.getBoundingClientRect().top
      const rootTop = scroller.getBoundingClientRect().top
      expect(top).toBeGreaterThanOrEqual(rootTop + 15)
    })
    await expect(card.getBoundingClientRect().height).toBeLessThanOrEqual(
      window.innerHeight - 31
    )
  },
}

/** L1: the shared hover hint for the Graph pin, with linked units in the rail. */
export const HoverHint: Story = {
  args: {
    initialState: {
      railCollapsed: false,
      hoverHint: { filePath: "src/sharing/revoke.ts", markerKey: "graph" },
    },
  },
}

/**
 * Shared markers: hovering the Doc pin tone-shifts the admins unit in the
 * rail (link glyph); hovering Graph lights the Suggested group with two dots.
 */
export const SharedMarkerHover: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const pin = await waitFor(() => {
      const found = canvasElement.querySelector<HTMLElement>(
        'button[data-marker-key="doc"]'
      )
      // The overlay places (un-hides) its items on its next frame.
      expect(found).toBeVisible()
      return found!
    })
    await userEvent.hover(pin)
    const rail = within(
      canvasElement.querySelector<HTMLElement>(
        'nav[aria-label="Review units"]'
      )!
    )
    await waitFor(() =>
      expect(
        rail.getByRole("link", { name: /Workspace admins may revoke any link/ })
      ).toHaveAttribute("data-linked")
    )
    await userEvent.unhover(pin)
    const graph = canvasElement.querySelector<HTMLElement>(
      'button[data-marker-key="graph"]'
    )!
    await userEvent.hover(graph)
    await waitFor(() =>
      expect(
        rail.getByRole("img", {
          name: "2 suggested units share the open context",
        })
      ).toBeVisible()
    )
    await userEvent.unhover(graph)
    await waitFor(() =>
      expect(
        rail.queryByRole("img", {
          name: "2 suggested units share the open context",
        })
      ).toBeNull()
    )
  },
}

/** L3: the ticket behind the conflict, drilled from its card. */
export const SourceSheetOpen: Story = {
  args: {
    initialState: {
      openMarker: "conflict",
      sheetMarker: "conflict",
      railCollapsed: false,
    },
  },
}

/** L3 for code: editor actions, facts, highlighted lines, "Go to its unit". */
export const SourceSheetCode: Story = {
  args: {
    initialState: {
      openMarker: "batch",
      sheetMarker: "batch",
      railCollapsed: false,
    },
  },
}

/** L3 for the graph: readers with their paths, coverage in red. */
export const SourceSheetGraph: Story = {
  args: {
    initialState: {
      openMarker: "graph",
      sheetMarker: "graph",
      railCollapsed: false,
    },
  },
}

/** L3 for history: Show commit, the incident, the files it touched. */
export const SourceSheetHistory: Story = {
  args: {
    initialState: {
      openMarker: "history",
      sheetMarker: "history",
      railCollapsed: false,
    },
  },
}

/** Read-only neighbor expanded: muted pins of its own context. */
export const NeighborExpanded: Story = {
  args: { initialState: { neighborOpen: true, railCollapsed: false } },
}

/* ── Diff layout and wrapping ─────────────────────────── */

/** Split: removed and added rows side by side; pins on the new-side row. */
export const Split: Story = {
  args: { initialState: { layout: "split", railCollapsed: false } },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(hosts(canvasElement)[0]?.dataset.layout).toBe("split")
    )
  },
}

/** Wrap off: long lines scroll sideways per file, gutter pinned. */
export const WrapOff: Story = {
  args: { initialState: { wrap: false, railCollapsed: false } },
}

export const SplitWrapOff: Story = {
  args: {
    initialState: { layout: "split", wrap: false, railCollapsed: false },
  },
}

/** The play turns Wrap off and back on, and switches to Split. */
export const LayoutAndWrapToggles: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    const wrap = canvas.getByRole("button", { name: "Wrap long lines" })
    await expect(wrap).toHaveAttribute("aria-pressed", "true")
    await waitFor(() =>
      expect(hosts(canvasElement)[0]?.dataset.wrap).toBe("true")
    )
    await userEvent.click(wrap)
    await waitFor(() =>
      expect(hosts(canvasElement)[0]?.dataset.wrap).toBe("false")
    )
    await userEvent.click(wrap)
    await waitFor(() =>
      expect(hosts(canvasElement)[0]?.dataset.wrap).toBe("true")
    )
    await userEvent.click(canvas.getByRole("radio", { name: "Split" }))
    await waitFor(() =>
      expect(hosts(canvasElement)[0]?.dataset.layout).toBe("split")
    )
  },
}

/**
 * Split falls back to Stacked when the unit column is under 980px
 * (measured on the column, not the viewport): the toggle shows Stacked,
 * Split is unavailable and says why.
 */
export const SplitFallsBackWhenNarrow: Story = {
  args: { initialState: { layout: "split", railCollapsed: false } },
  render: (args) => (
    <div style={{ width: 1100 }}>
      <ReviewDeskScreen {...args} />
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    await waitFor(() =>
      expect(
        canvasElement.querySelector("[data-split-fallback]")
      ).toHaveTextContent("Split shows as stacked below 980px")
    )
    await expect(canvas.getByRole("radio", { name: "Split" })).toBeDisabled()
    await expect(
      canvas.getByRole("radio", { name: "Stacked" })
    ).toHaveAttribute("aria-checked", "true")
    await waitFor(() =>
      expect(hosts(canvasElement)[0]?.dataset.layout).toBe("stacked")
    )
  },
}

/* ── Rail ──────────────────────────────────────────────── */

/** The rail collapsed to its 60px icon column. */
export const RailCollapsed: Story = {
  args: { initialState: { railCollapsed: true } },
}

/** "[" collapses and expands the rail (the desk's keyboard shortcut). */
export const RailShortcut: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const nav = canvasElement.querySelector<HTMLElement>(
      'nav[aria-label="Review units"]'
    )!
    canvasElement.ownerDocument.body.focus()
    await userEvent.keyboard("[")
    await waitFor(() => expect(nav).toHaveAttribute("data-collapsed"))
    await userEvent.keyboard("[")
    await waitFor(() => expect(nav).not.toHaveAttribute("data-collapsed"))
  },
}

/* ── Agents ────────────────────────────────────────────── */

export const AgentsOpen: Story = {
  render: (args) => <ReviewDeskScreen {...args} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", {
        name: "4 agents on this branch, 3 connected",
      })
    )
  },
}

/* ── Threads ───────────────────────────────────────────── */

const threadRepository = () =>
  createMemoryReviewCommentRepository(reviewCommentFixtures)

/** An open thread: Maya's comment and Implementer 1's reply. */
export const ThreadOpen: Story = {
  args: {
    commentRepository: threadRepository(),
    initialState: { openMarker: SESSIONS_MARKER, railCollapsed: false },
  },
}

/**
 * An open thread behaves like a context card: the play clicks Maya's pin —
 * the thread becomes the one expanded layer (other pins dimmed and inert,
 * the dismiss layer up), stays pinned while the unit scrolls, and an
 * outside click closes it.
 */
export const ThreadIsolatesAndSticks: Story = {
  args: { commentRepository: threadRepository() },
  play: async ({ canvasElement, userEvent }) => {
    const pin = await waitFor(() => {
      const found = canvasElement.querySelector<HTMLElement>(
        `button[data-marker-key="${SESSIONS_MARKER}"]`
      )
      expect(found).toBeVisible()
      return found!
    })
    await userEvent.click(pin)
    const thread = await waitFor(() => {
      const found =
        canvasElement.querySelector<HTMLElement>("[data-thread-card]")
      expect(found).toBeVisible()
      return found!
    })
    await expect(pin).toHaveAttribute("aria-expanded", "true")
    const root = hosts(canvasElement)[0]!.shadowRoot!
    await waitFor(() =>
      expect(
        root.querySelectorAll("[data-overlay-item][inert]").length
      ).toBeGreaterThan(0)
    )
    await expect(
      canvasElement.querySelector('button[aria-label="Close context"]')
    ).toBeTruthy()
    const scroller = canvasElement.querySelector<HTMLElement>("main > div")!
    scroller.scrollTop = 500
    await waitFor(() =>
      expect(thread.getBoundingClientRect().top).toBeGreaterThanOrEqual(
        scroller.getBoundingClientRect().top + 15
      )
    )
    scroller.scrollTop = 0
    await userEvent.click(
      canvasElement.querySelector<HTMLElement>(
        'button[aria-label="Close context"]'
      )!
    )
    await waitFor(() =>
      expect(canvasElement.querySelector("[data-thread-card]")).toBeNull()
    )
  },
}

/**
 * "Show comments" shows each comment as a compact preview (no isolation);
 * clicking a preview opens its thread; "Dismiss all" collapses everything.
 */
export const ShowCommentsPreviews: Story = {
  args: { commentRepository: threadRepository() },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: "Show comments" })
    )
    const preview = await waitFor(() => {
      const found = canvasElement.querySelector<HTMLElement>(
        "[data-comment-preview]"
      )
      expect(found).toBeVisible()
      return found!
    })
    await userEvent.click(preview)
    await waitFor(() =>
      expect(canvasElement.querySelector("[data-thread-card]")).toBeVisible()
    )
    await userEvent.keyboard("{Escape}")
    await userEvent.click(
      await canvas.findByRole("button", { name: "Dismiss all" })
    )
    await waitFor(() =>
      expect(canvasElement.querySelector("[data-comment-preview]")).toBeNull()
    )
  },
}

/** Implementer 1 is working on your follow-up (steps collapsed). */
export const ThreadWorking: Story = {
  args: {
    commentRepository: threadRepository(),
    data: {
      ...reviewDeskLiveFixture,
      threads: [threadStateFixtures.working],
    },
    initialState: { openMarker: SESSIONS_MARKER, railCollapsed: false },
  },
}

/** Implementer 1 needs your input: Allow once / Deny. */
export const ThreadNeedsInput: Story = {
  args: {
    commentRepository: threadRepository(),
    data: {
      ...reviewDeskLiveFixture,
      threads: [threadStateFixtures["needs-input"]],
    },
    initialState: { openMarker: SESSIONS_MARKER, railCollapsed: false },
  },
}

/** Delivery failed: Retry. */
export const ThreadFailed: Story = {
  args: {
    commentRepository: threadRepository(),
    data: {
      ...reviewDeskLiveFixture,
      threads: [threadStateFixtures.failed],
    },
    initialState: { openMarker: SESSIONS_MARKER, railCollapsed: false },
  },
}

/**
 * Thread state progression from a mock relay (no real ACP): the play sends
 * a reply and follows queued → sent → picked up → working → needs your
 * input, answers "Allow once", and waits for the final reply with its
 * inner-loop commit as a chip.
 */
export const ThreadProgression: Story = {
  args: {
    commentRepository: threadRepository(),
    initialState: { openMarker: SESSIONS_MARKER, railCollapsed: false },
    threadEvents: createMockThreadRelay({
      onReply: threadReplyScript,
      onPermission: threadPermissionScript,
      onRetry: threadRetryScript,
    }),
  },
  play: async ({ canvasElement, userEvent }) => {
    const thread = await waitFor(() => {
      const found = canvasElement.querySelector<HTMLElement>(
        'article[aria-label^="Comment thread"]'
      )
      expect(found).toBeTruthy()
      return found!
    })
    const view = within(thread)
    // The overlay places (un-hides) the thread on its next frame.
    const reply = await waitFor(() => {
      const found = view.getByRole("textbox", { name: "Reply" })
      expect(found).toBeVisible()
      return found
    })
    // The layer re-places its items over the first frames (which can drop
    // focus); keep focusing until focus survives two frames.
    await waitFor(
      async () => {
        reply.focus()
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        )
        expect(reply.ownerDocument.activeElement).toBe(reply)
      },
      { timeout: 3000 }
    )
    await userEvent.keyboard(
      "Go with SHR-212. Add a test that reloads an open session."
    )
    const send = view.getByRole("button", { name: "Send" })
    await waitFor(() => expect(send).toBeEnabled())
    await userEvent.click(send)
    const state = () => thread.getAttribute("data-thread-state")
    await expect(state()).toBe("queued")
    await waitFor(() => expect(state()).toBe("sent"), { timeout: 3000 })
    await waitFor(() => expect(state()).toBe("picked-up"), { timeout: 3000 })
    await waitFor(() => expect(state()).toBe("working"), { timeout: 3000 })
    await waitFor(() => expect(state()).toBe("needs-input"), { timeout: 4000 })
    await userEvent.click(view.getByRole("button", { name: "Allow once" }))
    await waitFor(() => expect(state()).toBe("replied"), { timeout: 5000 })
    await expect(
      view.getByText(/Sessions end on revoke, and a test now reloads/)
    ).toBeVisible()
    await expect(view.getByText("b71e5aa")).toBeVisible()
  },
}

/* ── New commit mid-review (Cycle.dc.html) ─────────────── */

/** A new commit landed: the dark notice, Later / What changed. */
export const NewCommitNotice: Story = {
  args: { data: reviewDeskWithNewCommitFixture },
}

/** Parked as a corner pill after Later. */
export const NewCommitParked: Story = {
  args: {
    data: reviewDeskWithNewCommitFixture,
    initialState: { notice: "parked", railCollapsed: false },
  },
}

/** The play presses Later: the notice shrinks to the corner pill. */
export const NewCommitLater: Story = {
  args: { data: reviewDeskWithNewCommitFixture },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Later" }))
    await waitFor(() =>
      expect(
        canvas.getByRole("link", {
          name: /New commit b71e5aa: 3 units need you/,
        })
      ).toBeVisible()
    )
  },
}

/* ── Units in other lanes (Lanes.dc.html) ──────────────── */

/** Suggested: Agent approved · Request changes or Agree. */
export const SuggestedUnit: Story = {
  args: { data: suggestedUnitFixture },
}

export const SuggestedAgreed: Story = {
  args: { data: suggestedUnitFixture, initialState: { dock: "agreed" } },
}

/** Request changes on a suggested unit overrides the agent's approval. */
export const SuggestedRequestingChanges: Story = {
  args: { data: suggestedUnitFixture, initialState: { dock: "composing" } },
}

/** Agentic review: the agent sent it back; you can only Comment. */
export const AgenticUnit: Story = {
  args: { data: agenticUnitFixture },
}

export const AgenticCommenting: Story = {
  args: { data: agenticUnitFixture, initialState: { dock: "composing" } },
}

export const AgenticCommented: Story = {
  args: { data: agenticUnitFixture, initialState: { dock: "commented" } },
}

/** Static automation: checks that passed, the generated diff collapsed. */
export const StaticUnit: Story = {
  args: { data: staticUnitFixture },
}

/** The static unit's generated diff: the play expands and collapses it. */
export const StaticGeneratedDiff: Story = {
  args: { data: staticUnitFixture },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const toggle = canvas.getByRole("button", { name: /Show generated diff/ })
    await expect(toggle).toHaveAttribute("aria-expanded", "false")
    await expect(toggle).toHaveTextContent(/\d+ lines/)
    await expect(hosts(canvasElement)).toHaveLength(0)
    await userEvent.click(toggle)
    await waitFor(() => expect(hosts(canvasElement)).toHaveLength(1))
    await userEvent.click(
      canvas.getByRole("button", { name: /Hide generated diff/ })
    )
    await waitFor(() => expect(hosts(canvasElement)).toHaveLength(0))
  },
}

export const StaticGeneratedDiffOpen: Story = {
  args: { data: staticUnitFixture, initialState: { generatedOpen: true } },
}

/* ── Dock ──────────────────────────────────────────────── */

export const Composing: Story = {
  args: {
    initialState: {
      dock: "composing",
      attachment: "conflict",
      railCollapsed: false,
    },
  },
}

export const ComposingWithDraft: Story = {
  args: {
    initialState: {
      dock: "composing",
      attachment: "conflict",
      draft: reviewDeskFixture.unit.draftSuggestion,
      railCollapsed: false,
    },
  },
}

export const Approved: Story = {
  args: { initialState: { dock: "approved", railCollapsed: false } },
}

export const ChangesRequested: Story = {
  args: { initialState: { dock: "changes-requested", railCollapsed: false } },
}
