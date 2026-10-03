import { strict as assert } from "node:assert"
import { Effect } from "effect"
import { createCircuit } from "./circuit"

let time = 0
const circuit = createCircuit({ threshold: 1, resetMs: 100, now: () => time })
const old = await Effect.runPromise(circuit.acquire)
const failing = await Effect.runPromise(circuit.acquire)
await Effect.runPromise(circuit.failure(failing))
time = 100
const probe = await Effect.runPromise(circuit.acquire)
await Effect.runPromise(circuit.success(old))
await Effect.runPromise(circuit.release(old))
assert.equal(
  (await Effect.runPromise(Effect.flip(circuit.acquire)))._tag,
  "CircuitOpenError"
)
await Effect.runPromise(circuit.release(probe))
const recovered = await Effect.runPromise(circuit.acquire)
await Effect.runPromise(circuit.success(probe))
assert.equal(
  (await Effect.runPromise(Effect.flip(circuit.acquire)))._tag,
  "CircuitOpenError"
)
await Effect.runPromise(circuit.success(recovered))
await Effect.runPromise(circuit.acquire)
process.stdout.write("Verified concurrent circuit recovery and cancellation.\n")
