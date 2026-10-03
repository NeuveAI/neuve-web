import type { Meta, StoryObj } from "@storybook/react-vite"

import { reviewDeskFixture } from "@workspace/ui/fixtures/review-batch.fixtures"
import { ReviewDeskScreen } from "@workspace/ui/neuve/review-desk/review-desk-screen"
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
    data: reviewDeskFixture,
    commentRepository: createMemoryReviewCommentRepository(),
  },
  argTypes: { commentRepository: { control: false } },
} satisfies Meta<typeof ReviewDeskScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Rest: Story = {}

/** L2: the conflict card is open; other pins dim and leave the tab order. */
export const ContextCardOpen: Story = {
  args: { initialState: { openMarker: "conflict" } },
}

/** L2 on a second pin of the same line (sibling pin stays enabled). */
export const SameBatchCardOpen: Story = {
  args: { initialState: { openMarker: "batch" } },
}

/** L1: the shared hover hint for the Graph pin. */
export const HoverHint: Story = {
  args: {
    initialState: {
      hoverHint: { filePath: "src/sharing/revoke.ts", markerKey: "graph" },
    },
  },
}

/** L3: the ticket behind the conflict, drilled from its card. */
export const SourceSheetOpen: Story = {
  args: { initialState: { openMarker: "conflict", sheetMarker: "conflict" } },
}

export const NeighborExpanded: Story = {
  args: { initialState: { neighborOpen: true } },
}

export const Composing: Story = {
  args: { initialState: { dock: "composing", attachment: "conflict" } },
}

export const ComposingWithDraft: Story = {
  args: {
    initialState: {
      dock: "composing",
      attachment: "conflict",
      draft: reviewDeskFixture.unit.draftSuggestion,
    },
  },
}

export const Approved: Story = {
  args: { initialState: { dock: "approved" } },
}

export const ChangesRequested: Story = {
  args: { initialState: { dock: "changes-requested" } },
}
