/**
 * One-time setup for running the app on your own computer.
 *
 *   npm run setup:local
 *
 * 1. Creates .env.local (if it doesn't exist) for a local MySQL with user "root" and no password,
 *    the default of DBngin and of a fresh MySQL installation, plus a random AUTH_SECRET.
 * 2. Creates the database if it doesn't exist.
 * 3. Creates or updates the tables.
 * Safe to run again at any time.
 */
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { config } from "dotenv";

const FILE = ".env.local";

async function main() {
  if (!existsSync(FILE)) {
    writeFileSync(
      FILE,
      [
        "# Settings for running the app on this computer. Created by `npm run setup:local`. Never upload this file.",
        "DB_HOST=127.0.0.1",
        "DB_PORT=3306",
        "DB_NAME=zeynkanban",
        "DB_USER=root",
        "DB_PASSWORD=",
        `AUTH_SECRET=${randomBytes(32).toString("hex")}`,
        "",
      ].join("\n"),
    );
    console.log(`Created ${FILE}. If your MySQL has a password for "root", put it after DB_PASSWORD= in that file and run this again.`);
  }
  config({ path: FILE });

  const mysql = (await import("mysql2/promise")).default;
  const name = process.env.DB_NAME || "zeynkanban";
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error("DB_NAME may only contain letters, numbers and underscores.");
  let server;
  try {
    server = await mysql.createConnection({
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
    });
  } catch (error) {
    console.error("\nCould not connect to MySQL. Is it running? (In DBngin, press Start next to MySQL.)");
    console.error("If root has a password, put it after DB_PASSWORD= in .env.local.\n");
    throw error;
  }
  await server.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await server.end();
  console.log(`Database "${name}" is ready.`);

  const { runMigrations } = await import("../src/db/migrate");
  await runMigrations();
  console.log("Tables are up to date.\n\nNext: npm run dev   then open http://localhost:3000\n");
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
