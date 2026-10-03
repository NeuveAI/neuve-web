import { createFileRoute, notFound } from "@tanstack/react-router"

import {
  agentRegistryFixture,
  commitLineageFixture,
  REVIEW_UNIT_ID,
} from "@workspace/ui/fixtures/review-batch.fixtures"
import { LineageScreen } from "@workspace/ui/neuve/cycle/lineage-screen"

/**
 * What a new commit asks of the reviewer: how the units of the commit under
 * review relate to the new one. Fixture-backed until the BFF serves lineage.
 */
export const Route = createFileRoute("/changes/$commit")({
  loader: ({ params }) => {
    if (params.commit !== commitLineageFixture.to) throw notFound()
    return { lineage: commitLineageFixture, agents: agentRegistryFixture }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `What ${loaderData?.lineage.to ?? "the new commit"} asks of you · Neuve`,
      },
    ],
  }),
  component: ChangesRoute,
})

function ChangesRoute() {
  const { lineage, agents } = Route.useLoaderData()
  return (
    <LineageScreen
      lineage={lineage}
      agents={agents}
      back={{ to: "unit", unitId: REVIEW_UNIT_ID }}
    />
  )
}
