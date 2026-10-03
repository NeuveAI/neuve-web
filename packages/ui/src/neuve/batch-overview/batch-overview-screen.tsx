import { Provider } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import { MotionConfig } from "motion/react"

import { BatchHero } from "@workspace/ui/neuve/batch-overview/batch-hero"
import { JudgmentTable } from "@workspace/ui/neuve/batch-overview/judgment-table"
import { LaneBar } from "@workspace/ui/neuve/batch-overview/lane-bar"
import { VerificationGrid } from "@workspace/ui/neuve/batch-overview/verification-grid"
import { batchOverviewHydration } from "@workspace/ui/neuve/batch-overview/atoms"
import type { BatchOverviewState } from "@workspace/ui/neuve/batch-overview/atoms"
import { BrandMark } from "@workspace/ui/neuve/shared/brand-mark"
import { ThemeToggle } from "@workspace/ui/neuve/shared/theme-toggle"
import type { BatchOverviewData } from "@workspace/ui/neuve/types"

export interface BatchOverviewScreenProps {
  data: BatchOverviewData
  initialState?: Partial<BatchOverviewState>
}

function BatchOverview({ data, initialState = {} }: BatchOverviewScreenProps) {
  useHydrateAtoms(batchOverviewHydration(initialState))
  return (
    <div className="min-h-svh bg-paper font-sans text-sm text-ink">
      <header className="box-border flex min-h-14 flex-wrap items-center gap-4 border-b border-line px-5 py-2">
        <BrandMark />
        <span className="text-[13px] text-ink-muted">{data.repo}</span>
        <div className="flex-auto" />
        <ThemeToggle />
      </header>
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
