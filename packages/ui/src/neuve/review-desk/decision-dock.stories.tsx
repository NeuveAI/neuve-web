import type { Meta, StoryObj } from "@storybook/react-vite"

import { reviewDeskFixture } from "@workspace/ui/fixtures/review-batch.fixtures"
import { DecisionDock } from "@workspace/ui/neuve/review-desk/decision-dock"
import { withReviewDeskState } from "@workspace/ui/neuve/review-desk/story-state"

const meta = {
  title: "Review desk/Decision dock",
  component: DecisionDock,
  args: { unit: reviewDeskFixture.unit, markers: reviewDeskFixture.markers },
  decorators: [
    (Story) => (
      <div className="flex min-h-[420px] flex-col justify-end bg-paper font-sans text-sm text-ink">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DecisionDock>

export default meta
type Story = StoryObj<typeof meta>

/** Rest. Hover or focus "Covers 3 hunks" for the scope note. */
export const Rest: Story = { decorators: [withReviewDeskState()] }

/** Composer with the suggested draft offered and the open context attached. */
export const Composing: Story = {
  decorators: [
    withReviewDeskState({ dock: "composing", attachment: "conflict" }),
  ],
}

/** Draft accepted: the suggestion fills the comment and the offer disappears. */
export const ComposingWithDraft: Story = {
  decorators: [
    withReviewDeskState({
      dock: "composing",
      attachment: "conflict",
      draft: reviewDeskFixture.unit.draftSuggestion,
    }),
  ],
}

/** Attachment removed. */
export const ComposingDetached: Story = {
  decorators: [withReviewDeskState({ dock: "composing", attachment: null })],
}

export const Approved: Story = {
  decorators: [withReviewDeskState({ dock: "approved" })],
}

export const ChangesRequested: Story = {
  decorators: [withReviewDeskState({ dock: "changes-requested" })],
}
