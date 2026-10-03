import { createFileRoute } from "@tanstack/react-router"

import { batchOverviewFixture } from "@workspace/ui/fixtures/review-batch.fixtures"
import { BatchOverviewScreen } from "@workspace/ui/neuve/batch-overview/batch-overview-screen"

/**
 * Batch overview. No backend yet: the loader serves the UI package's fixture
 * so the route already has the shape a BFF loader will fill later.
 */
export const Route = createFileRoute("/")({
  loader: () => batchOverviewFixture,
  head: () => ({ meta: [{ title: "Review batch · Neuve" }] }),
  component: BatchOverviewRoute,
})

function BatchOverviewRoute() {
  const data = Route.useLoaderData()
  return <BatchOverviewScreen data={data} />
}
