import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, waitFor } from "storybook/test"

import {
  REVIEW_UNIT_ID,
  agentRegistryFixture,
  commitLineageFixture,
  newCommitFixture,
} from "@workspace/ui/fixtures/review-batch.fixtures"
import { LineageScreen } from "@workspace/ui/neuve/cycle/lineage-screen"
import { NewCommitNotice } from "@workspace/ui/neuve/cycle/new-commit-notice"
import { withReviewDeskState } from "@workspace/ui/neuve/review-desk/story-state"

/**
 * New revision mid-review (Cycle.dc.html): a Git event becomes a notice over
 * the unit column; "What changed" opens the commit lineage.
 */
const meta = {
  title: "Screens/Commit lineage",
  component: LineageScreen,
  args: {
    lineage: commitLineageFixture,
    agents: agentRegistryFixture,
    back: { to: "unit", unitId: REVIEW_UNIT_ID },
  },
} satisfies Meta<typeof LineageScreen>

export default meta
type Story = StoryObj<typeof meta>

/** "What b71e5aa asks of you", the renewed signal open. */
export const RenewedOpen: Story = {}

/** The correction that answers your comment, open. */
export const CorrectedOpen: Story = { args: { initialOpen: "corrected" } }

/** Regrouped hunks: earlier approvals stay with the hunks they covered. */
export const RegroupedOpen: Story = { args: { initialOpen: "regrouped" } }

/** Carried forward: no decision needed. */
export const CarriedOpen: Story = { args: { initialOpen: "audit" } }

/** Everything closed; the play opens and closes a row. */
export const AllClosed: Story = {
  args: { initialOpen: null },
  play: async ({ canvas, userEvent }) => {
    const row = canvas.getByRole("button", { name: /Corrected/ })
    await expect(row).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(row)
    await expect(row).toHaveAttribute("aria-expanded", "true")
    await expect(canvas.getByRole("link", { name: /Open unit/ })).toBeVisible()
    await userEvent.click(row)
    await waitFor(() => expect(row).toHaveAttribute("aria-expanded", "false"))
  },
}

const noticeFrame = () => (
  <div className="relative h-[240px] bg-paper font-sans text-sm text-ink">
    <NewCommitNotice event={newCommitFixture} />
  </div>
)

/** The notice on its own. */
export const Notice: Story = {
  decorators: [withReviewDeskState({ notice: "shown" })],
  render: noticeFrame,
}

/** Parked as the corner pill. */
export const NoticeParked: Story = {
  decorators: [withReviewDeskState({ notice: "parked" })],
  render: noticeFrame,
}
