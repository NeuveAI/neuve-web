import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import type { Briefing, QueryReceipt } from "./domain"
export const captures = sqliteTable(
  "query_captures",
  {
    captureId: text("capture_id").primaryKey(),
    sessionId: text("session_id").notNull(),
    toolCallId: text("tool_call_id").notNull(),
    repository: text("repository").notNull(),
    revision: text("revision").notNull(),
    result: text("result", { mode: "json" }).$type<QueryReceipt>().notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("capture_revision_idx").on(table.repository, table.revision),
    index("capture_session_idx").on(table.sessionId),
  ]
)
export const briefings = sqliteTable(
  "briefings",
  {
    briefingId: text("briefing_id").primaryKey(),
    captureId: text("capture_id")
      .notNull()
      .references(() => captures.captureId, { onDelete: "cascade" }),
    unitId: text("unit_id").notNull(),
    revision: text("revision").notNull(),
    briefing: text("briefing", { mode: "json" }).$type<Briefing>().notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("briefing_unit_revision_idx").on(table.unitId, table.revision),
  ]
)
export const checkpoints = sqliteTable("review_checkpoints", {
  key: text("key").primaryKey(),
  payload: text("payload").notNull(),
})
