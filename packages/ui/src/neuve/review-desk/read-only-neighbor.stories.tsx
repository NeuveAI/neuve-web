import type { Meta, StoryObj } from "@storybook/react-vite"

import { reviewDeskFixture } from "@workspace/ui/fixtures/review-batch.fixtures"
import { ReadOnlyNeighbor } from "@workspace/ui/neuve/review-desk/read-only-neighbor"
import {
  onPaper,
  withReviewDeskState,
} from "@workspace/ui/neuve/review-desk/story-state"

const meta = {
  title: "Review desk/Read-only neighbor",
  component: ReadOnlyNeighbor,
  args: { neighbor: reviewDeskFixture.neighbor },
} satisfies Meta<typeof ReadOnlyNeighbor>

export default meta
type Story = StoryObj<typeof meta>

/** Default: collapsed. */
export const Collapsed: Story = {
  decorators: [withReviewDeskState(), onPaper],
}

export const Expanded: Story = {
  decorators: [withReviewDeskState({ neighborOpen: true }), onPaper],
}
