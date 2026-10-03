import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { wrapLanguageModel } from "ai"
import { Effect } from "effect"
import { createCircuit } from "./circuit"
import { HarnessConfigurationError, ModelUnavailableError } from "./errors"

const circuit = createCircuit()

export const createGeminiModel = (
  settings: { apiKey?: string; modelId?: string } = {}
) =>
  Effect.gen(function* () {
    const apiKey = settings.apiKey ?? process.env.GEMINI_KEY
    if (!apiKey?.trim())
      return yield* new HarnessConfigurationError({
        setting: "GEMINI_KEY",
        message: "A server-side Gemini credential is required.",
      })
    const provider = createGoogleGenerativeAI({ apiKey })
    return wrapLanguageModel({
      model: provider(
        settings.modelId ?? process.env.NEUVE_GEMINI_MODEL ?? "gemini-3.8-flash"
      ),
      middleware: {
        specificationVersion: "v4",
        async wrapGenerate({ doGenerate, params }) {
          return Effect.runPromise(
            Effect.gen(function* () {
              const lease = yield* circuit.acquire
              return yield* Effect.tryPromise({
                try: () => doGenerate(),
                catch: () =>
                  new ModelUnavailableError({
                    message: "Gemini generation failed.",
                  }),
              }).pipe(
                Effect.tap(() => circuit.success(lease)),
                Effect.tapError(() =>
                  params.abortSignal?.aborted
                    ? circuit.release(lease)
                    : circuit.failure(lease)
                ),
                Effect.ensuring(circuit.release(lease))
              )
            }),
            { signal: params.abortSignal }
          )
        },
        async wrapStream({ doStream, params }) {
          const lease = await Effect.runPromise(circuit.acquire, {
            signal: params.abortSignal,
          })
          try {
            const result = await doStream()
            const reader = result.stream.getReader()
            let failed = false
            return {
              ...result,
              stream: new ReadableStream({
                async pull(controller) {
                  try {
                    const next = await reader.read()
                    if (next.done) {
                      await Effect.runPromise(
                        failed ? circuit.release(lease) : circuit.success(lease)
                      )
                      controller.close()
                    } else {
                      if (next.value.type === "error" && !failed) {
                        failed = true
                        await Effect.runPromise(circuit.failure(lease))
                      }
                      controller.enqueue(next.value)
                    }
                  } catch {
                    await Effect.runPromise(
                      params.abortSignal?.aborted
                        ? circuit.release(lease)
                        : circuit.failure(lease)
                    )
                    controller.error(
                      new ModelUnavailableError({
                        message: "Gemini stream interrupted.",
                      })
                    )
                  }
                },
                async cancel(reason) {
                  await Effect.runPromise(circuit.release(lease))
                  await reader.cancel(reason)
                },
              }),
            }
          } catch {
            await Effect.runPromise(
              params.abortSignal?.aborted
                ? circuit.release(lease)
                : circuit.failure(lease)
            )
            throw new ModelUnavailableError({
              message: "Gemini streaming failed.",
            })
          }
        },
      },
    })
  })
