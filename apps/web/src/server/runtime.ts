import { resolve } from "node:path";
import { Layer, ManagedRuntime } from "effect";
import { ReviewStoreLive } from "@workspace/backend";
import { StorageLive } from "@workspace/storage";
import { HarnessRelayLive } from "./relay";

const storageLayer = StorageLive({ path: process.env.NEUVE_DB_PATH ?? resolve(process.cwd(), ".data/neuve.sqlite") });
const storeLayer = ReviewStoreLive.pipe(Layer.provide(storageLayer));
const relayLayer = HarnessRelayLive.pipe(Layer.provide(storeLayer));
// Stable layer references share the store and SQLite connection across handlers.
export const reviewRuntime = ManagedRuntime.make(Layer.mergeAll(storageLayer, storeLayer, relayLayer));
if (import.meta.hot) import.meta.hot.dispose(() => { void reviewRuntime.dispose(); });
