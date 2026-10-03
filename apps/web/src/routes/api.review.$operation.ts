import { createFileRoute } from "@tanstack/react-router";
import { handleReviewRequest } from "../server/review";

export const Route = createFileRoute("/api/review/$operation")({
  server: { handlers: {
    GET: ({ request, params }) => handleReviewRequest(request, "review", params.operation),
    POST: ({ request, params }) => handleReviewRequest(request, "review", params.operation),
  } },
});
