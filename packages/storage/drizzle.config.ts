import { defineConfig } from "drizzle-kit"
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/tables.ts",
  out: "./migrations",
  dbCredentials: { url: process.env.NEUVE_DB_PATH ?? "./neuve.sqlite" },
})
