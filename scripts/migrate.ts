/** Applies the database changes in ./drizzle to the database in DATABASE_URL. Safe to run repeatedly. */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const { connect } = await import("../src/db/client");
  const { sql, db } = connect();
  await migrate(db, { migrationsFolder: "./drizzle" });
  await sql.end();
  console.log("Database is up to date.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
