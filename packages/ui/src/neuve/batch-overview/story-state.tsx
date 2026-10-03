import type { ReactNode } from "react"
import { Provider } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import { MotionConfig } from "motion/react"
import type { Decorator } from "@storybook/react-vite"

import { agentRegistryFixture } from "@workspace/ui/fixtures/review-batch.fixtures"
import { agentsHydration } from "@workspace/ui/neuve/agents/atoms"
import { batchOverviewHydration } from "@workspace/ui/neuve/batch-overview/atoms"
import type { BatchOverviewState } from "@workspace/ui/neuve/batch-overview/atoms"

function Hydrate({
  state,
  children,
}: {
  state: Partial<BatchOverviewState>
  children: ReactNode
}) {
  useHydrateAtoms(batchOverviewHydration(state))
  // Agent tags on judgment rows read the registry.
  useHydrateAtoms(agentsHydration(agentRegistryFixture))
  return children
}

/** Story decorator: isolated batch-overview store seeded with `state`. */
export function withBatchOverviewState(
  state: Partial<BatchOverviewState> = {}
): Decorator {
  return (Story) => (
    <Provider>
      <MotionConfig reducedMotion="user">
        <Hydrate state={state}>
          <Story />
        </Hydrate>
      </MotionConfig>
    </Provider>
  )
}
