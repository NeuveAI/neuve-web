import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, waitFor } from "storybook/test"

import {
  reviewCommentFixtures,
  reviewDeskFixture,
  reviewThreadFixtures,
  threadStateFixtures,
} from "@workspace/ui/fixtures/review-batch.fixtures"
import {
  ContextCard,
  MarginPin,
} from "@workspace/ui/neuve/review-desk/context-margin"
import {
  CommentPreviewCard,
  ThreadCard,
} from "@workspace/ui/neuve/review-desk/thread-card"
import type { ReviewThread } from "@workspace/ui/neuve/review-comments/thread"
import { DiffFileCard } from "@workspace/ui/neuve/review-desk/diff-file"
import {
  onPaper,
  withReviewDeskState,
} from "@workspace/ui/neuve/review-desk/story-state"
import { reviewCommentToMarker } from "@workspace/ui/neuve/review-comments/markers"
import type { ContextualMarker } from "@workspace/ui/neuve/types"

const markers = reviewDeskFixture.markers
const marker = (key: string): ContextualMarker => {
  const found = markers[key]
  if (!found) throw new Error(`Unknown fixture marker ${key}`)
  return found
}
const revokeFile = reviewDeskFixture.files[0]!
const commentContext = {
  unitId: reviewDeskFixture.unit.id,
  revision: reviewDeskFixture.revision,
  author: reviewDeskFixture.reviewer,
  agentId: "i1",
}
const commentMarker = reviewCommentToMarker(reviewCommentFixtures[0]!)

/* ── L0 pins ───────────────────────────────────────────── */

const pinMeta = {
  title: "Review desk/Context margin (L0–L2)",
  component: MarginPin,
  decorators: [onPaper],
  args: {
    marker: marker("conflict"),
    on: false,
    disabled: false,
    onToggle: fn(),
    onHintStart: fn(),
    onHintEnd: fn(),
  },
} satisfies Meta<typeof MarginPin>

export default pinMeta
type PinStory = StoryObj<typeof pinMeta>

/**
 * Every source tone side by side: doc, graph, conflict, same batch, test,
 * history — then a review comment, which is a pill with a speech glyph and
 * initials instead of a source tone (it is not retrieved context).
 */
export const AllTones: PinStory = {
  render: (args) => (
    <div className="flex flex-wrap gap-1.5">
      {Object.values(markers).map((m) => (
        <MarginPin key={m.key} {...args} marker={m} />
      ))}
      <MarginPin {...args} marker={commentMarker} />
    </div>
  ),
}

/** A `review comment` marker pin (open body). */
export const ReviewComment: PinStory = {
  args: { marker: commentMarker, on: true },
}

export const Conflict: PinStory = {}
export const SameBatch: PinStory = { args: { marker: marker("batch") } }
export const Test: PinStory = { args: { marker: marker("test") } }
export const Committed: PinStory = { args: { marker: marker("doc") } }
/** The pin whose card is open: inverted ink tone, aria-expanded. */
export const On: PinStory = { args: { on: true } }
/** Another card is isolating the margin: no pointer, out of tab order (dimmed by its row). */
/**
 * Shared with other units: one small dot per other unit (max 3) in the pin's
 * own colour at 50% — Doc (1), Graph (2), Conflict (1), and History (none).
 */
export const SharedDots: PinStory = {
  render: (args) => (
    <div className="flex flex-wrap gap-1.5">
      {["doc", "graph", "conflict", "history"].map((key) => (
        <MarginPin key={key} {...args} marker={marker(key)} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const graph = canvasElement.querySelector<HTMLElement>(
      'button[aria-label^="Graph:"]'
    )
    await expect(graph?.getAttribute("data-shared")).toBe("2")
    await expect(graph?.getAttribute("aria-label")).toMatch(
      /also in 2 other units/
    )
    const history = canvasElement.querySelector<HTMLElement>(
      'button[aria-label^="History:"]'
    )
    await expect(history?.hasAttribute("data-shared")).toBe(false)
  },
}

/** A read-only neighbor's own context: muted outline pin. */
export const ReadOnlyPin: PinStory = {
  args: { marker: marker("doc"), readOnly: true },
}

export const Disabled: PinStory = {
  args: { disabled: true },
  render: (args) => (
    <div className="opacity-35">
      <MarginPin {...args} />
    </div>
  ),
}

/* ── L2 cards ──────────────────────────────────────────── */

const cardFrame = (m: ContextualMarker) => (
  <div className="relative w-[300px]">
    <ContextCard
      marker={m}
      sticky={false}
      onClose={fn()}
      onOpenSource={fn()}
      onCheckAction={fn()}
    />
  </div>
)

/** Decision signal: the two sources side by side, "vs". */
export const CardConflictingIntent: PinStory = {
  render: () => cardFrame(marker("conflict")),
}
/** Same batch · unreviewed: the helper as a wrapping, highlighted snippet. */
export const CardSameBatch: PinStory = {
  render: () => cardFrame(marker("batch")),
}
/** Evidence gap: the asserting line, highlighted. */
export const CardEvidenceGap: PinStory = {
  render: () => cardFrame(marker("test")),
}
/** Doc · committed: the cited sentence as a quote. */
export const CardDocumentation: PinStory = {
  render: () => cardFrame(marker("doc")),
}
/** Graph · blast radius: the read-by tree, "not traced" in red. */
export const CardCommittedGraph: PinStory = {
  render: () => cardFrame(marker("graph")),
}
/** Regression history: the incident as a quote. */
export const CardRegressionHistory: PinStory = {
  render: () => cardFrame(marker("history")),
}

/**
 * The graph tree's truncated file expands to its full `path:line` in a
 * tooltip, on real hover or keyboard focus, wrapped inside the card. The
 * play focuses a path by keyboard, then points at another.
 */
export const CardGraphPathTooltip: PinStory = {
  decorators: [withReviewDeskState()],
  render: () => cardFrame(marker("graph")),
  play: async ({ canvasElement, userEvent }) => {
    const card = canvasElement.querySelector<HTMLElement>(
      "[data-context-card]"
    )!
    await userEvent.tab()
    await userEvent.tab()
    const focused = canvasElement.ownerDocument.activeElement
    await expect(focused?.getAttribute("aria-label")).toBe(
      "src/sharing/access-policy.ts:41"
    )
    const tip = await waitFor(() => {
      const found = canvasElement.querySelector<HTMLElement>('[role="tooltip"]')
      expect(found?.textContent).toBe("src/sharing/access-policy.ts:41")
      return found!
    })
    const cardBox = card.getBoundingClientRect()
    const tipBox = tip.getBoundingClientRect()
    await expect(tipBox.right).toBeLessThanOrEqual(cardBox.right + 0.5)
    await expect(tipBox.left).toBeGreaterThanOrEqual(cardBox.left - 0.5)
    await userEvent.tab()
    await waitFor(() =>
      expect(canvasElement.querySelector('[role="tooltip"]')?.textContent).toBe(
        "src/routes/open.ts:12"
      )
    )
    const untraced = canvasElement.querySelector<HTMLElement>(
      '[data-tree-row="4"]'
    )!
    await userEvent.hover(untraced)
    await waitFor(() =>
      expect(canvasElement.querySelector('[role="tooltip"]')?.textContent).toBe(
        "src/cache/links.ts:8"
      )
    )
  },
}

/* ── Comment threads ───────────────────────────────────── */

const sessionsRecord = reviewCommentFixtures[0]!

const threadFrame = (thread: ReviewThread | undefined, width = 300) => (
  <div style={{ width }}>
    <ThreadCard
      record={sessionsRecord}
      rangeLabel="L22–23"
      thread={thread}
      fallbackAgentId="i1"
      reviewer={reviewDeskFixture.reviewer}
      sticky={false}
      onDismiss={fn()}
      onToggleStatus={fn()}
    />
  </div>
)

const threadStory = (thread: ReviewThread | undefined): PinStory => ({
  decorators: [
    withReviewDeskState({}, undefined, {
      threads: thread ? [thread] : [],
    }),
  ],
  render: () => threadFrame(thread),
})

/** Replied: the comment and Implementer 1's reply; the reply box is open. */
export const ThreadReplied: PinStory = threadStory(reviewThreadFixtures[0])
/** Your follow-up is queued: it reaches I1 when it's free. */
export const ThreadQueued: PinStory = threadStory(threadStateFixtures.queued)
/** Sent to I1 (no read receipts exist in ACP). */
export const ThreadSent: PinStory = threadStory(threadStateFixtures.sent)
/** Picked up: I1's turn started. */
export const ThreadPickedUp: PinStory = threadStory(
  threadStateFixtures["picked-up"]
)
/** Working: narration and tool calls collapse into "3 steps". */
export const ThreadWorking: PinStory = threadStory(threadStateFixtures.working)
/** Needs your input: Allow once / Deny. */
export const ThreadNeedsInput: PinStory = threadStory(
  threadStateFixtures["needs-input"]
)
/** Failed: the reason and Retry. */
export const ThreadFailed: PinStory = threadStory(threadStateFixtures.failed)
/** Replied with the inner-loop commit as a chip, not a new cycle. */
export const ThreadRepliedWithCommit: PinStory = threadStory(
  threadStateFixtures.replied
)

/** Working steps expand from "3 steps". */
export const ThreadWorkingStepsOpen: PinStory = {
  ...threadStory(threadStateFixtures.working),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /3 steps/ }))
    await expect(canvas.getByText("Edit src/sharing/revoke.ts")).toBeVisible()
  },
}

/* ── File + margin together ────────────────────────────── */

const fileFrame = () => (
  <div className="max-w-[1100px]">
    <DiffFileCard
      file={revokeFile}
      markers={markers}
      commentContext={commentContext}
    />
  </div>
)

/** Rest: dotted L0 underlines and pins, nothing open. */
export const FileWithMargin: PinStory = {
  decorators: [withReviewDeskState()],
  render: fileFrame,
}

/** Isolation: graph card open, its row ringed, every other pin dimmed and disabled. */
export const FileWithCardOpen: PinStory = {
  decorators: [withReviewDeskState({ openMarker: "graph" })],
  render: fileFrame,
}

/** L1: one shared hint layer per margin, under the hovered pin. */
export const FileWithHoverHint: PinStory = {
  decorators: [
    withReviewDeskState({
      hoverHint: { filePath: revokeFile.path, markerKey: "conflict" },
    }),
  ],
  render: fileFrame,
}

/**
 * In a 260px margin (≤1180px viewports) the header puts the range and count
 * under "Thread", so neither is cut off. The play checks the count fits.
 */
export const ThreadHeaderNarrowMargin: PinStory = {
  decorators: [
    withReviewDeskState({}, undefined, {
      threads: [threadStateFixtures.replied],
    }),
  ],
  render: () => threadFrame(threadStateFixtures.replied, 260),
  play: async ({ canvasElement }) => {
    const count = canvasElement.querySelector<HTMLElement>(
      "[data-thread-count]"
    )!
    await expect(count.textContent).toMatch(/L22–23 · 3 messages/)
    const card = canvasElement.querySelector<HTMLElement>("[data-thread-card]")!
    await expect(count.getBoundingClientRect().right).toBeLessThanOrEqual(
      card.getBoundingClientRect().right
    )
    await expect(count.scrollWidth).toBeLessThanOrEqual(count.clientWidth + 1)
  },
}

/** "Show comments": the compact preview, which opens the thread. */
export const CommentPreview: PinStory = {
  decorators: [
    withReviewDeskState({}, undefined, { threads: reviewThreadFixtures }),
  ],
  render: () => (
    <div className="w-[300px]">
      <CommentPreviewCard
        record={sessionsRecord}
        rangeLabel="L22–23"
        thread={reviewThreadFixtures[0]}
        onOpen={fn()}
      />
    </div>
  ),
}
