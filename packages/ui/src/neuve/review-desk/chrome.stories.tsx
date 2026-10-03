import type { Meta, StoryObj } from "@storybook/react-vite"

import { reviewDeskFixture } from "@workspace/ui/fixtures/review-batch.fixtures"
import { Briefing } from "@workspace/ui/neuve/review-desk/briefing"
import { ReviewHeader } from "@workspace/ui/neuve/review-desk/review-header"
import { withReviewDeskState } from "@workspace/ui/neuve/review-desk/story-state"
import { UnitRail } from "@workspace/ui/neuve/review-desk/unit-rail"

const paper = "bg-paper font-sans text-sm text-ink"

const meta = {
  title: "Review desk/Chrome",
  component: ReviewHeader,
  args: { data: reviewDeskFixture },
} satisfies Meta<typeof ReviewHeader>

export default meta
type Story = StoryObj<typeof meta>

/** Header with the human gate at 0 of 2. */
export const Header: Story = {
  decorators: [withReviewDeskState()],
  render: (args) => (
    <div className={paper}>
      <ReviewHeader {...args} />
    </div>
  ),
}

/** Header after this unit is decided: gate 1 of 2. */
export const HeaderDecided: Story = {
  decorators: [withReviewDeskState({ dock: "approved" })],
  render: (args) => (
    <div className={paper}>
      <ReviewHeader {...args} />
    </div>
  ),
}

const rail = (args: { data: typeof reviewDeskFixture }) => (
  <div className={`${paper} flex w-[300px]`}>
    <UnitRail data={args.data} />
  </div>
)

/** Rail: current unit selected by tone, conflict chip. */
export const Rail: Story = { decorators: [withReviewDeskState()], render: rail }
export const RailApproved: Story = {
  decorators: [withReviewDeskState({ dock: "approved" })],
  render: rail,
}
export const RailChangesRequested: Story = {
  decorators: [withReviewDeskState({ dock: "changes-requested" })],
  render: rail,
}

/** Briefing with numbered citations that open margin cards. */
export const BriefingWithCitations: Story = {
  decorators: [withReviewDeskState()],
  render: (args) => (
    <div className={paper}>
      <Briefing unit={args.data.unit} />
    </div>
  ),
}
