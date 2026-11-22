import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

/**
 * Opens a database connection. Used by the app (through ./index) and by the command-line scripts.
 * Takes either DATABASE_URL, or the separate DB_HOST, DB_NAME, DB_USER and DB_PASSWORD settings
 * (easier on hosting panels, since passwords with symbols then need no special encoding).
 */
export function connect(url = process.env.DATABASE_URL) {
  const separate = process.env.DB_NAME && process.env.DB_USER;
  if (!url && !separate) throw new Error("No database settings. Set DATABASE_URL, or DB_HOST, DB_NAME, DB_USER and DB_PASSWORD.");
  const target = url
    ? { uri: url }
    : {
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT || 3306),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      };
  const pool = mysql.createPool({
    ...target,
    connectionLimit: 5,
    timezone: "Z", // store and read times as UTC
    charset: "utf8mb4", // Azerbaijani letters and every other character
    dateStrings: ["DATE"], // calendar dates stay as "2026-11-08", never shifted by time zones
  });
  // Times the database fills in itself (created_at) use the connection's clock. Make that UTC on every
  // connection, so they match how the app reads them, whatever time zone the MySQL server is set to.
  pool.pool.on("connection", (connection) => {
    connection.query("SET time_zone = '+00:00'");
  });
  return { pool, db: drizzle(pool, { schema, mode: "default" }) };
}

export type Database = ReturnType<typeof connect>["db"];
