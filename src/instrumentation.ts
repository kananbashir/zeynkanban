// Runs once when the server starts. On the hosting there is no command line,
// so database changes are applied here, before the first page is served.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production" || process.env.SKIP_MIGRATIONS === "1") return;
  const { runMigrations } = await import("./db/migrate");
  await runMigrations();
}
