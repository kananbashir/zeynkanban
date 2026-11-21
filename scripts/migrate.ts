/** Applies the database changes in ./drizzle to the database in DATABASE_URL. Safe to run repeatedly. */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { runMigrations } = await import("../src/db/migrate");
  await runMigrations();
  console.log("Database is up to date.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
