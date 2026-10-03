import type { ReactNode } from "react"
import { Provider } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import { MotionConfig } from "motion/react"
import type { Decorator } from "@storybook/react-vite"

import { agentRegistryFixture } from "@workspace/ui/fixtures/review-batch.fixtures"
import { agentsHydration } from "@workspace/ui/neuve/agents/atoms"
import type { AgentConnector } from "@workspace/ui/neuve/agents/atoms"
import {
  commentRepositoryHydration,
  railHydration,
  reviewDeskHydration,
} from "@workspace/ui/neuve/review-desk/atoms"
import type { ReviewDeskState } from "@workspace/ui/neuve/review-desk/atoms"
import type { ReviewCommentRepository } from "@workspace/ui/neuve/review-comments/repository"
import type {
  ReviewThread,
  ThreadEventSource,
} from "@workspace/ui/neuve/review-comments/thread"
import { threadsHydration } from "@workspace/ui/neuve/review-comments/threads"
import type { AgentRegistry } from "@workspace/ui/neuve/types"

export interface StoryExtras {
  threads?: ReadonlyArray<ReviewThread>
  threadEvents?: ThreadEventSource
  agents?: AgentRegistry
  agentConnector?: AgentConnector
  agentsOpen?: boolean
}

function Hydrate({
  state,
  repository,
  extras,
  children,
}: {
  state: Partial<ReviewDeskState>
  repository?: ReviewCommentRepository
  extras: StoryExtras
  children: ReactNode
}) {
  useHydrateAtoms(reviewDeskHydration(state))
  useHydrateAtoms(railHydration(state))
  useHydrateAtoms(commentRepositoryHydration(repository))
  useHydrateAtoms(threadsHydration(extras.threads, extras.threadEvents))
  useHydrateAtoms(
    agentsHydration(
      extras.agents ?? agentRegistryFixture,
      extras.agentConnector,
      extras.agentsOpen
    )
  )
  return children
}

/**
 * Story decorator: isolated review-desk store seeded with `state`, with
 * `repository` as the inline comment store when given, and the agent
 * registry, threads and relay from `extras`.
 */
export function withReviewDeskState(
  state: Partial<ReviewDeskState> = {},
  repository?: ReviewCommentRepository,
  extras: StoryExtras = {}
): Decorator {
  return (Story) => (
    <Provider>
      <MotionConfig reducedMotion="user">
        <Hydrate state={state} repository={repository} extras={extras}>
          <Story />
        </Hydrate>
      </MotionConfig>
    </Provider>
  )
}

/** Padded paper canvas for component stories. */
export const onPaper: Decorator = (Story) => (
  <div className="min-h-svh bg-paper p-8 font-sans text-sm text-ink">
    <Story />
  </div>
)
