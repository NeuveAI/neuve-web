import type { Meta, StoryObj } from "@storybook/react-vite"

import { reviewDeskFixture } from "@workspace/ui/fixtures/review-batch.fixtures"
import { SourceSheet } from "@workspace/ui/neuve/review-desk/source-sheet"
import { withReviewDeskState } from "@workspace/ui/neuve/review-desk/story-state"

/** The sheet renders inside a positioned unit column, as it does in the desk. */
function SheetFrame() {
  return (
    <main className="relative h-[640px] bg-paper font-sans text-sm text-ink">
      <SourceSheet markers={reviewDeskFixture.markers} />
    </main>
  )
}

const meta = {
  title: "Review desk/Source sheet (L3)",
  component: SheetFrame,
} satisfies Meta<typeof SheetFrame>

export default meta
type Story = StoryObj<typeof meta>

export const Ticket: Story = {
  decorators: [
    withReviewDeskState({ openMarker: "conflict", sheetMarker: "conflict" }),
  ],
}
export const Documentation: Story = {
  decorators: [withReviewDeskState({ openMarker: "doc", sheetMarker: "doc" })],
}
export const TransientContext: Story = {
  decorators: [
    withReviewDeskState({ openMarker: "batch", sheetMarker: "batch" }),
  ],
}
export const CommittedGraph: Story = {
  decorators: [
    withReviewDeskState({ openMarker: "graph", sheetMarker: "graph" }),
  ],
}
export const VerificationEvidence: Story = {
  decorators: [
    withReviewDeskState({ openMarker: "test", sheetMarker: "test" }),
  ],
}
export const RegressionHistory: Story = {
  decorators: [
    withReviewDeskState({ openMarker: "history", sheetMarker: "history" }),
  ],
}
