import { spawn } from "node:child_process"
import { isAbsolute } from "node:path"
import { Writable } from "node:stream"
import * as acp from "@agentclientprotocol/sdk"
import { Data, Effect, Schema } from "effect"

export class HarnessDispatchError extends Data.TaggedError(
  "HarnessDispatchError"
)<{
  readonly phase:
    | "configuration"
    | "transport"
    | "initialize"
    | "session"
    | "prompt"
    | "updates"
  readonly detail: string
}> {}

const Target = Schema.Struct({
  command: Schema.NonEmptyString,
  args: Schema.Array(Schema.String),
  env: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  cwd: Schema.NonEmptyString,
})
export type HarnessTarget = typeof Target.Type
export type Correction = {
  readonly commandId: string
  readonly revisionId: string
  readonly unitId: string
  readonly body: string
  readonly intent: "informational" | "request-changes"
}
type Correlation = Pick<Correction, "commandId" | "revisionId" | "unitId"> & {
  readonly sessionId: string
}
export type HarnessUpdate = Correlation &
  (
    | { readonly kind: "session-started" }
    | {
        readonly kind: "agent-message"
        readonly text: string
        readonly truncated: boolean
      }
    | {
        readonly kind: "tool-status"
        readonly toolCallId: string
        readonly title: string | null
        readonly status: acp.ToolCallStatus | null
      }
    | { readonly kind: "prompt-finished"; readonly stopReason: acp.StopReason }
  )

// A completed ACP turn establishes delivery only. Review decisions and cycles
// require their own validated submissions through the review API.
export const dispatchComment = (
  target: HarnessTarget,
  comment: Correction,
  options: { readonly onUpdate?: (update: HarnessUpdate) => Promise<void> } = {}
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const config = yield* Schema.decodeUnknownEffect(Target)(target).pipe(
        Effect.mapError(
          () =>
            new HarnessDispatchError({
              phase: "configuration",
              detail: "Invalid ACP target",
            })
        )
      )
      if (!isAbsolute(config.cwd) || !isAbsolute(config.command))
        return yield* Effect.fail(
          new HarnessDispatchError({
            phase: "configuration",
            detail: "ACP command and working directory must be absolute",
          })
        )
      if (config.env && "NEUVE_REVIEW_TOKEN" in config.env) return yield* Effect.fail(new HarnessDispatchError({ phase: "configuration", detail: "Human review credentials cannot be passed to a harness" }));
  const environment: Record<string, string> = {};
  for (const key of ["PATH", "HOME", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "USER", "SHELL", "XDG_CONFIG_HOME"]) {
    const value = process.env[key];
    if (value !== undefined) environment[key] = value;
  }
  Object.assign(environment, config.env);
  const child = yield* Effect.acquireRelease(
        Effect.tryPromise({
          try: () =>
            new Promise<ReturnType<typeof spawn>>((resolve, reject) => {
              const value = spawn(config.command, [...config.args], {
                cwd: config.cwd,
          env: environment,
                stdio: ["pipe", "pipe", "ignore"],
                shell: false,
                detached: process.platform !== "win32",
              })
              value.once("error", reject)
              value.once("spawn", () => resolve(value))
            }),
          catch: () =>
            new HarnessDispatchError({
              phase: "transport",
              detail: "Could not launch configured ACP harness",
            }),
        }),
        (value) =>
          Effect.promise(
            () =>
              new Promise<void>((resolve) => {
                const kill = (signal: NodeJS.Signals) => {
                  if (process.platform !== "win32" && value.pid !== undefined) {
                    try {
                      process.kill(-value.pid, signal)
                    } catch {
                      value.kill(signal)
                    }
                  } else value.kill(signal)
                }
                // Also terminate descendants when the ACP parent exited before its tools.
                if (value.exitCode !== null || value.signalCode !== null) {
                  kill("SIGKILL")
                  resolve()
                  return
                }
                let completed = false
                const finish = () => {
                  if (completed) return
                  completed = true
                  clearTimeout(terminateTimer)
                  clearTimeout(deadline)
                  value.off("exit", finish)
                  resolve()
                }
                const terminateTimer = setTimeout(() => kill("SIGKILL"), 1000)
                const deadline = setTimeout(finish, 2000)
                value.once("exit", finish)
                value.stdin?.end()
                kill("SIGTERM")
              })
          )
      )
      if (!child.stdin || !child.stdout)
        return yield* Effect.fail(
          new HarnessDispatchError({
            phase: "transport",
            detail: "ACP pipes unavailable",
          })
        )
      const stdout = child.stdout
      let receivedBytes = 0
      let cancelOutput = () => {
        stdout.destroy()
      }
      const output = new ReadableStream<Uint8Array>({
        start(controller) {
          let closed = false
          const cleanup = () => {
            stdout.off("data", data)
            stdout.off("end", end)
            stdout.off("error", error)
            stdout.off("close", end)
          }
          const end = () => {
            if (closed) return
            closed = true
            cleanup()
            controller.close()
          }
          const error = (cause: unknown) => {
            if (closed) return
            closed = true
            cleanup()
            controller.error(cause)
          }
          const data = (chunk: unknown) => {
            if (closed) return
            if (!Buffer.isBuffer(chunk))
              return error(new Error("Non-byte ACP output"))
            receivedBytes += chunk.byteLength
            if (receivedBytes > 4 * 1024 * 1024) {
              error(new Error("ACP output limit exceeded"))
              stdout.destroy()
              return
            }
            controller.enqueue(new Uint8Array(chunk))
            if ((controller.desiredSize ?? 0) <= 0) stdout.pause()
          }
          stdout.on("data", data)
          stdout.once("end", end)
          stdout.once("close", end)
          stdout.once("error", error)
          cancelOutput = () => {
            if (closed) return
            closed = true
            cleanup()
            stdout.destroy()
          }
        },
        pull() {
          stdout.resume()
        },
        cancel() {
          cancelOutput()
        },
      })
      const stream = acp.ndJsonStream(Writable.toWeb(child.stdin), output)
      const correlation = {
        commandId: comment.commandId,
        unitId: comment.unitId,
        revisionId: comment.revisionId,
      }
      let sessionId: string | undefined
      let reply = ""
      let replyBytes = 0
      let replyTruncated = false
      let updates = Promise.resolve()
      let updateFailure: HarnessDispatchError | undefined
      const emit = (event: HarnessUpdate) => {
        updates = updates.then(async () => {
          if (updateFailure !== undefined) return
          try {
            await options.onUpdate?.(event)
          } catch {
            updateFailure = new HarnessDispatchError({
              phase: "updates",
              detail: "Could not record ACP update",
            })
          }
        })
        return updates
      }
      const connection = yield* Effect.acquireRelease(
        Effect.sync(() =>
          acp
            .client({ name: "neuve-review" })
            .onRequest(acp.methods.client.session.requestPermission, () => ({
              outcome: { outcome: "cancelled" },
            }))
            .onNotification(
              acp.methods.client.session.update,
              async ({ params }) => {
                if (sessionId === undefined || params.sessionId !== sessionId)
                  return
                const update = params.update
                const identity = { ...correlation, sessionId }
                if (
                  update.sessionUpdate === "agent_message_chunk" &&
                  update.content.type === "text"
                ) {
                  const wasTruncated = replyTruncated
                  const remaining = 64 * 1024 - replyBytes
                  let text = update.content.text
                  if (Buffer.byteLength(text) > remaining) {
                    replyTruncated = true
                    const bytes = Buffer.from(text)
                    let length = remaining
                    const decoder = new TextDecoder("utf-8", { fatal: true })
                    while (true) {
                      try {
                        text = decoder.decode(bytes.subarray(0, length))
                        break
                      } catch {
                        length -= 1
                      }
                    }
                  }
                  reply += text
                  replyBytes += Buffer.byteLength(text)
                  if (text || (!wasTruncated && replyTruncated))
                    await emit({
                      ...identity,
                      kind: "agent-message",
                      text,
                      truncated: replyTruncated,
                    })
                } else if (
                  update.sessionUpdate === "tool_call" ||
                  update.sessionUpdate === "tool_call_update"
                ) {
                  await emit({
                    ...identity,
                    kind: "tool-status",
                    toolCallId: update.toolCallId,
                    title: update.title?.slice(0, 4096) ?? null,
                    status: update.status ?? null,
                  })
                }
              }
            )
            .connect(stream)
        ),
        (value) => Effect.sync(() => value.close())
      )
      const request = <A>(
        phase: "initialize" | "session" | "prompt",
        run: (signal: AbortSignal) => Promise<A>
      ) =>
        Effect.tryPromise({
          try: run,
          catch: () =>
            new HarnessDispatchError({ phase, detail: `ACP ${phase} failed` }),
        })
      const initialized = yield* request("initialize", (signal) =>
        connection.agent.request(
          acp.methods.agent.initialize,
          {
            protocolVersion: acp.PROTOCOL_VERSION,
            clientCapabilities: {},
            clientInfo: { name: "neuve-review", version: "0.0.1" },
          },
          { cancellationSignal: signal }
        )
      )
      if (initialized.protocolVersion !== acp.PROTOCOL_VERSION)
        return yield* Effect.fail(
          new HarnessDispatchError({
            phase: "initialize",
            detail: "ACP protocol version mismatch",
          })
        )
      const session = yield* request("session", (signal) =>
        connection.agent.request(
          acp.methods.agent.session.new,
          { cwd: config.cwd, mcpServers: [] },
          { cancellationSignal: signal }
        )
      )
      sessionId = session.sessionId
      yield* Effect.promise(() =>
        emit({
          ...correlation,
          sessionId: session.sessionId,
          kind: "session-started",
        })
      )
      const result = yield* request("prompt", (signal) => {
        const cancel = () => {
          void connection.agent
            .notify(acp.methods.agent.session.cancel, {
              sessionId: session.sessionId,
            })
            .catch(() => {})
          connection.close()
        }
        signal.addEventListener("abort", cancel, { once: true })
        return connection.agent
          .request(
            acp.methods.agent.session.prompt,
            {
              sessionId: session.sessionId,
              prompt: [
                {
                  type: "text",
                  text: JSON.stringify({
                    kind: "neuve-review-comment",
                    ...comment,
                  }),
                },
              ],
            },
            { cancellationSignal: signal }
          )
          .finally(() => signal.removeEventListener("abort", cancel))
      })
      yield* Effect.promise(() =>
        emit({
          ...correlation,
          sessionId: session.sessionId,
          kind: "prompt-finished",
          stopReason: result.stopReason,
        })
      )
      if (updateFailure) return yield* Effect.fail(updateFailure)
      if (result.stopReason !== "end_turn")
        return yield* Effect.fail(
          new HarnessDispatchError({
            phase: "prompt",
            detail: `Harness stopped with ${result.stopReason}`,
          })
        )
      return {
        sessionId: session.sessionId,
        stopReason: result.stopReason,
        reply,
        replyTruncated,
      }
    })
  ).pipe(
    Effect.timeoutOrElse({
      duration: "60 seconds",
      orElse: () =>
        Effect.fail(
          new HarnessDispatchError({
            phase: "transport",
            detail: "ACP dispatch timed out",
          })
        ),
    })
  )

export * from "./references"
