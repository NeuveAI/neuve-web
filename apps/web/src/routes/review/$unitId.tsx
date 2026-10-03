import { createFileRoute, notFound } from "@tanstack/react-router"

import {
  agenticUnitFixture,
  reviewDeskWithNewCommitFixture,
  staticUnitFixture,
  suggestedUnitFixture,
} from "@workspace/ui/fixtures/review-batch.fixtures"
import { ReviewDeskScreen } from "@workspace/ui/neuve/review-desk/review-desk-screen"

/** Units with sample data: the human-required unit and one per other lane. */
const UNITS = [
  reviewDeskWithNewCommitFixture,
  suggestedUnitFixture,
  agenticUnitFixture,
  staticUnitFixture,
]

/**
 * Review desk for one review unit. Only the fixture units have sample data;
 * other unit ids are not found until a backend serves them.
 */
export const Route = createFileRoute("/review/$unitId")({
  loader: ({ params }) => {
    const data = UNITS.find((unit) => unit.unit.id === params.unitId)
    if (!data) throw notFound()
    return data
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
