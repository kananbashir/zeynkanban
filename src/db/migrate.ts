import path from "node:path";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { connect } from "./client";

/**
 * Brings the database up to date with the files in ./drizzle. Runs when the app starts on the
 * server (see src/instrumentation.ts), so no command line is ever needed on the hosting.
 */
export async function runMigrations(folder = path.join(process.cwd(), "drizzle")) {
  const { pool, db } = connect();
  try {
    await migrate(db, { migrationsFolder: folder });
  } finally {
    await pool.end();
  }
}
