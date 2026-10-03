import { z } from "zod"
import { Effect } from "effect"
import { createCircuit } from "./circuit"
import {
  HarnessConfigurationError,
  ReviewBackendUnavailable,
  ReviewBackendRejected,
} from "./errors"

const circuit = createCircuit()
function requestBackend(
  path: string,
  request: { method: "GET" } | { method: "POST"; input: unknown }
) {
  return Effect.gen(function* () {
    const token = process.env.NEUVE_HARNESS_TOKEN
    if (!token)
      return yield* new HarnessConfigurationError({
        setting: "NEUVE_HARNESS_TOKEN",
        message: "The private backend capability is required.",
      })
    const endpoint = process.env.NEUVE_BFF_URL ?? "http://127.0.0.1:3000"
    const lease = yield* circuit.acquire
    return yield* Effect.tryPromise({
      try: async (signal) => {
        const response = await fetch(`${endpoint}/api/harness/${path}`, {
          method: request.method,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body:
            request.method === "POST"
              ? JSON.stringify(request.input)
              : undefined,
          redirect: "error",
          signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
        })
        if (
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 429
        ) {
          const body: unknown = await response.json().catch(() => undefined)
          const parsed = z
            .object({ error: z.string().regex(/^[A-Za-z][A-Za-z0-9]{0,63}$/) })
            .safeParse(body)
          const code = parsed.success ? parsed.data.error : "Rejected"
          throw new ReviewBackendRejected({
            status: response.status,
            operation: path,
            code,
            message: `${path} rejected with ${code} (${response.status}). Stop this operation; do not retry unchanged input.`,
          })
        }
        if (!response.ok)
          throw new ReviewBackendUnavailable({
            operation: path,
            status: response.status,
          })
        return await response.json()
      },
      catch: (error) =>
        error instanceof ReviewBackendUnavailable ||
        error instanceof ReviewBackendRejected
          ? error
          : new ReviewBackendUnavailable({ operation: path }),
    }).pipe(
      Effect.tap(() => circuit.success(lease)),
      Effect.tapError((error) =>
        error._tag === "ReviewBackendRejected"
          ? circuit.success(lease)
          : circuit.failure(lease)
      ),
      Effect.ensuring(circuit.release(lease))
    )
  })
}

export function publishReview(
  path:
    | "units"
    | "dispositions"
    | "comments"
    | "captures"
    | "briefings"
    | "complete-unit-review"
    | "finish-review",
  input: unknown
) {
  return requestBackend(path, { method: "POST", input })
}
export function readBackend(path: string) {
  return requestBackend(path, { method: "GET" })
}
