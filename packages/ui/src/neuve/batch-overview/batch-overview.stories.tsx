import type { ReactNode } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { batchOverviewFixture } from "@workspace/ui/fixtures/review-batch.fixtures"
import { BatchHero } from "@workspace/ui/neuve/batch-overview/batch-hero"
import { JudgmentTable } from "@workspace/ui/neuve/batch-overview/judgment-table"
import { LaneBar } from "@workspace/ui/neuve/batch-overview/lane-bar"
import { withBatchOverviewState } from "@workspace/ui/neuve/batch-overview/story-state"
import {
  CaptureTile,
  MissingEvidenceTile,
  TestEvidenceTile,
  VerificationGrid,
} from "@workspace/ui/neuve/batch-overview/verification-grid"
import type { VerificationCard } from "@workspace/ui/neuve/types"

const data = batchOverviewFixture
const card = <TKind extends VerificationCard["kind"]>(
  kind: TKind,
  id?: string
) => {
  const found = data.verification.find(
    (c): c is Extract<VerificationCard, { kind: TKind }> =>
      c.kind === kind && (id === undefined || c.id === id)
  )
  if (!found) throw new Error(`No ${kind} card in fixture`)
  return found
}

const meta = {
  title: "Batch overview/Sections",
  component: LaneBar,
  args: { lanes: data.lanes },
  decorators: [
    (Story) => (
      <div className="min-h-svh bg-paper p-8 font-sans text-sm text-ink">
        <div className="mx-auto max-w-[1132px]">
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof LaneBar>

export default meta
type Story = StoryObj<typeof meta>

/** Rest: human-required lane active. Hover a lane for its caption. */
export const LanesRest: Story = { decorators: [withBatchOverviewState()] }
export const LanesSuggested: Story = {
  decorators: [withBatchOverviewState({ activeLane: "human-suggested" })],
}
export const LanesAgentic: Story = {
  decorators: [withBatchOverviewState({ activeLane: "agentic-review" })],
}
/** Last lane: the caption anchors right. */
export const LanesStatic: Story = {
  decorators: [withBatchOverviewState({ activeLane: "static-automation" })],
}

export const Hero: Story = {
  render: () => <BatchHero data={data} />,
}

export const NeedsYourJudgment: Story = {
  render: () => <JudgmentTable units={data.judgment} />,
}

export const Verification: Story = {
  decorators: [withBatchOverviewState()],
  render: () => (
    <VerificationGrid
      summary={data.verificationSummary}
      cards={data.verification}
    />
  ),
}

const tile = (node: ReactNode) => (
  <div className="grid grid-cols-12 gap-3">{node}</div>
)

export const MissingEvidence: Story = {
  render: () => tile(<MissingEvidenceTile card={card("missing")} />),
}
/** Mini-player paused on the observed outcome. */
export const CapturePaused: Story = {
  decorators: [withBatchOverviewState()],
  render: () => tile(<CaptureTile card={card("capture")} />),
}
/** Mini-player running its 12s timeline. */
export const CapturePlaying: Story = {
  decorators: [withBatchOverviewState({ capturePlaying: true })],
  render: () => tile(<CaptureTile card={card("capture")} />),
}
export const SolidTest: Story = {
  render: () =>
    tile(<TestEvidenceTile card={card("test", "viewers-cant-revoke")} />),
}
export const ShallowTest: Story = {
  render: () =>
    tile(<TestEvidenceTile card={card("test", "revoke-succeeds-owner")} />),
}
