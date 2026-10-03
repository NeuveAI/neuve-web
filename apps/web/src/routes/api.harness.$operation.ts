import { createFileRoute } from "@tanstack/react-router";
import { handleReviewRequest } from "../server/review";

export const Route = createFileRoute("/api/harness/$operation")({
  server: { handlers: {
    GET: ({ request, params }) => handleReviewRequest(request, "harness", params.operation),
    POST: ({ request, params }) => handleReviewRequest(request, "harness", params.operation),
  } },
});
