import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** Opens a database connection. Used by the app (through ./index) and by the command-line scripts. */
export function connect(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  // prepare:false keeps this compatible with pooled connections (Supabase, Neon).
  const sql = postgres(url, { max: 5, prepare: false });
  return { sql, db: drizzle(sql, { schema }) };
}

export type Database = ReturnType<typeof connect>["db"];
