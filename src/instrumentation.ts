// Runs once when the server starts. On the hosting there is no command line,
// so database changes are applied here, before the first page is served.
// It also starts a timer for the once-a-day notifications (see src/lib/daily.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.SKIP_MIGRATIONS !== "1") {
    const { runMigrations } = await import("./db/migrate");
    await runMigrations();
  }
  if (process.env.SKIP_DAILY_JOBS !== "1") {
    const { runDailyJobs } = await import("./lib/daily");
    const tick = () => runDailyJobs().catch((error) => console.error("daily jobs", error));
    setTimeout(tick, 30_000);
    setInterval(tick, 5 * 60_000).unref?.();
  }
}
