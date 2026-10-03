import { Effect } from "effect"
import { CircuitOpenError } from "./errors"
type Lease = {
  readonly generation: number
  readonly probe: boolean
  readonly id: number
}

export function createCircuit({
  threshold = 5,
  resetMs = 60_000,
  now = Date.now,
} = {}) {
  let failures = 0
  let openedAt: number | undefined
  let activeProbeId: number | undefined
  let generation = 0
  let requestId = 0
  const acquire = Effect.suspend(() => {
    if (openedAt !== undefined) {
      const remaining = resetMs - (now() - openedAt)
      if (remaining > 0 || activeProbeId !== undefined)
        return Effect.fail(
          new CircuitOpenError({ retryAfterMs: Math.max(1, remaining) })
        )
      activeProbeId = ++requestId
      return Effect.succeed({ generation, probe: true, id: activeProbeId })
    }
    return Effect.succeed({ generation, probe: false, id: ++requestId })
  })
  const success = (lease: Lease) =>
    Effect.sync(() => {
      if (
        lease.generation !== generation ||
        (lease.probe && activeProbeId !== lease.id)
      )
        return
      failures = 0
      if (lease.probe) {
        openedAt = undefined
        activeProbeId = undefined
        generation += 1
      }
    })
  const failure = (lease: Lease) =>
    Effect.sync(() => {
      if (
        lease.generation !== generation ||
        (lease.probe && activeProbeId !== lease.id)
      )
        return
      failures += 1
      if (lease.probe || failures >= threshold) {
        openedAt = now()
        generation += 1
        activeProbeId = undefined
      }
    })
  const release = (lease: Lease) =>
    Effect.sync(() => {
      if (
        lease.generation === generation &&
        lease.probe &&
        activeProbeId === lease.id
      )
        activeProbeId = undefined
    })
  return { acquire, success, failure, release }
}
