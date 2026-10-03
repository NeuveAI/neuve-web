import { Provider } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import { MotionConfig } from "motion/react"

import { BatchHero } from "@workspace/ui/neuve/batch-overview/batch-hero"
import { JudgmentTable } from "@workspace/ui/neuve/batch-overview/judgment-table"
import { LaneBar } from "@workspace/ui/neuve/batch-overview/lane-bar"
import { VerificationGrid } from "@workspace/ui/neuve/batch-overview/verification-grid"
import { batchOverviewHydration } from "@workspace/ui/neuve/batch-overview/atoms"
import type { BatchOverviewState } from "@workspace/ui/neuve/batch-overview/atoms"
import { agentsHydration } from "@workspace/ui/neuve/agents/atoms"
import type { AgentConnector } from "@workspace/ui/neuve/agents/atoms"
import { AppHeader } from "@workspace/ui/neuve/shared/app-header"
import type { BatchOverviewData } from "@workspace/ui/neuve/types"

export interface BatchOverviewScreenProps {
  data: BatchOverviewData
  initialState?: Partial<BatchOverviewState>
  /** Connects agents from the header (a local mock by default). */
  agentConnector?: AgentConnector
  /** Opens the Agents popover (stories). */
  agentsOpen?: boolean
}

function BatchOverview({
  data,
  initialState = {},
  agentConnector,
  agentsOpen = false,
}: BatchOverviewScreenProps) {
  useHydrateAtoms(batchOverviewHydration(initialState))
  useHydrateAtoms(agentsHydration(data.agents, agentConnector, agentsOpen))
  return (
    <div className="min-h-svh bg-paper font-sans text-sm text-ink">
      <AppHeader repo={data.repo} branch={data.branch} commit={data.revision} />
      <div className="mx-auto box-border flex max-w-[1180px] flex-col gap-14 px-6 pt-14 pb-24">
        <BatchHero data={data} />
        <LaneBar lanes={data.lanes} />
        <JudgmentTable units={data.judgment} />
        <VerificationGrid
          summary={data.verificationSummary}
          cards={data.verification}
        />
      </div>
    </div>
  )
}

/**
 * Batch overview — the current review batch at a glance: advisory briefing,
 * lane split, units that need human judgment, and verification evidence.
 */
export function BatchOverviewScreen(props: BatchOverviewScreenProps) {
  return (
    <Provider>
      <MotionConfig reducedMotion="user">
        <BatchOverview {...props} />
      </MotionConfig>
    </Provider>
  )
}
