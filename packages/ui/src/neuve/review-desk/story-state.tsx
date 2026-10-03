import type { ReactNode } from "react"
import { Provider } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import { MotionConfig } from "motion/react"
import type { Decorator } from "@storybook/react-vite"

import {
  commentRepositoryHydration,
  reviewDeskHydration,
} from "@workspace/ui/neuve/review-desk/atoms"
import type { ReviewDeskState } from "@workspace/ui/neuve/review-desk/atoms"
import type { ReviewCommentRepository } from "@workspace/ui/neuve/review-comments/repository"

function Hydrate({
  state,
  repository,
  children,
}: {
  state: Partial<ReviewDeskState>
  repository?: ReviewCommentRepository
  children: ReactNode
}) {
  useHydrateAtoms(reviewDeskHydration(state))
  useHydrateAtoms(commentRepositoryHydration(repository))
  return children
}

/**
 * Story decorator: isolated review-desk store seeded with `state`, and with
 * `repository` as the inline comment store when given.
 */
export function withReviewDeskState(
  state: Partial<ReviewDeskState> = {},
  repository?: ReviewCommentRepository
): Decorator {
  return (Story) => (
    <Provider>
      <MotionConfig reducedMotion="user">
        <Hydrate state={state} repository={repository}>
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
