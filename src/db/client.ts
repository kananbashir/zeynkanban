import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

/** Opens a database connection. Used by the app (through ./index) and by the command-line scripts. */
export function connect(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  const pool = mysql.createPool({
    uri: url,
    connectionLimit: 5,
    timezone: "Z", // store and read times as UTC
    charset: "utf8mb4", // Azerbaijani letters and every other character
    dateStrings: ["DATE"], // calendar dates stay as "2026-11-08", never shifted by time zones
  });
  return { pool, db: drizzle(pool, { schema, mode: "default" }) };
}

export type Database = ReturnType<typeof connect>["db"];
