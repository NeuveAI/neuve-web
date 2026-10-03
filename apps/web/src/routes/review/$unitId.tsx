import { createFileRoute, notFound } from "@tanstack/react-router"

import { reviewDeskFixture } from "@workspace/ui/fixtures/review-batch.fixtures"
import { ReviewDeskScreen } from "@workspace/ui/neuve/review-desk/review-desk-screen"

/**
 * Review desk for one review unit. Only the fixture unit has sample data;
 * other unit ids are not found until a backend serves them.
 */
export const Route = createFileRoute("/review/$unitId")({
  loader: ({ params }) => {
    if (params.unitId !== reviewDeskFixture.unit.id) throw notFound()
    return reviewDeskFixture
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.unit.title ?? "Review unit"} · Neuve` }],
  }),
  component: ReviewDeskRoute,
})

function ReviewDeskRoute() {
  const data = Route.useLoaderData()
  // Keyed by unit so moving between units starts from a fresh desk state.
  return <ReviewDeskScreen key={data.unit.id} data={data} />
}
