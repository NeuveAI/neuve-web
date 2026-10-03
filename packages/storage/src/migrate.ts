import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"
import { fileURLToPath } from "node:url"
export const migrateDatabase = (path: string) => {
  const sqlite = new Database(path, { create: true })
  try {
    sqlite.exec("PRAGMA foreign_keys = ON")
    migrate(drizzle(sqlite), {
      migrationsFolder: fileURLToPath(
        new URL("../migrations", import.meta.url)
      ),
    })
  } finally {
    sqlite.close()
  }
}
if (import.meta.main)
  migrateDatabase(process.env.NEUVE_DB_PATH ?? "./neuve.sqlite")
