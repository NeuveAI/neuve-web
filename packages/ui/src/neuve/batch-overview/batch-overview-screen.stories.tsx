import type { Meta, StoryObj } from "@storybook/react-vite"

import { batchOverviewFixture } from "@workspace/ui/fixtures/review-batch.fixtures"
import { BatchOverviewScreen } from "@workspace/ui/neuve/batch-overview/batch-overview-screen"

/** Batch overview screen (Overview.dc.html). */
const meta = {
  title: "Screens/Batch overview",
  component: BatchOverviewScreen,
  args: { data: batchOverviewFixture },
} satisfies Meta<typeof BatchOverviewScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Rest: Story = {}
export const SuggestedLane: Story = {
  args: { initialState: { activeLane: "human-suggested" } },
}
export const StaticAutomationLane: Story = {
  args: { initialState: { activeLane: "static-automation" } },
}
export const CapturePlaying: Story = {
  args: { initialState: { capturePlaying: true } },
}
