import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, waitFor } from "storybook/test"

import { reviewDeskFixture } from "@workspace/ui/fixtures/review-batch.fixtures"
import { ReadOnlyNeighbor } from "@workspace/ui/neuve/review-desk/read-only-neighbor"
import {
  onPaper,
  withReviewDeskState,
} from "@workspace/ui/neuve/review-desk/story-state"

const neighbor = reviewDeskFixture.neighbor!

const meta = {
  title: "Review desk/Read-only neighbor",
  component: ReadOnlyNeighbor,
  args: {
    neighbor,
    commentContext: {
      unitId: reviewDeskFixture.unit.id,
      revision: reviewDeskFixture.revision,
      author: reviewDeskFixture.reviewer,
    },
  },
} satisfies Meta<typeof ReadOnlyNeighbor>

export default meta
type Story = StoryObj<typeof meta>

/** Default: collapsed, with its "2 context" count. */
export const Collapsed: Story = {
  decorators: [withReviewDeskState(), onPaper],
}

/**
 * Expanded: muted grayscale rows, its own context as muted pins with their
 * note, and "You can comment here" — its decision stays with its lane.
 */
export const Expanded: Story = {
  decorators: [withReviewDeskState({ neighborOpen: true }), onPaper],
  play: async ({ canvasElement }) => {
    const host = await waitFor(() => {
      const found = canvasElement.querySelector("diffs-container")
      expect(found).toBeTruthy()
      return found!
    })
    await expect(host.classList.contains("nv-diff-readonly")).toBe(true)
    await expect(
      canvasElement.querySelector(
        '[aria-label="Doc: Generated from openapi.yaml · same batch"]'
      )
    ).toBeTruthy()
  },
}

/** Commenting on the neighbor: the composer saves to the neighbor's own unit. */
export const ExpandedComposing: Story = {
  decorators: [
    withReviewDeskState({
      neighborOpen: true,
      composer: {
        filePath: neighbor.file.path,
        range: { start: 89, side: "additions", end: 89 },
      },
      lineSelection: {
        filePath: neighbor.file.path,
        range: { start: 89, side: "additions", end: 89 },
      },
    }),
    onPaper,
  ],
}
