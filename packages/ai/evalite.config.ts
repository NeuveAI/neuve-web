import { defineConfig } from "evalite/config"
export default defineConfig({
  maxConcurrency: 2,
  testTimeout: 60_000,
  scoreThreshold: 100,
})
