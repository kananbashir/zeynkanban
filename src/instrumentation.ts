// Runs once when the server starts. On the hosting there is no command line,
// so database changes are applied here, before the first page is served.
// It also starts a timer for the once-a-day notifications (src/lib/daily.ts) and task reminders (src/lib/reminders.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.SKIP_MIGRATIONS !== "1") {
    const { runMigrations } = await import("./db/migrate");
    await runMigrations();
  }
  if (process.env.SKIP_DAILY_JOBS !== "1") {
    const { runDailyJobs } = await import("./lib/daily");
    const { runReminders } = await import("./lib/reminders");
    const tick = () => {
      runDailyJobs().catch((error) => console.error("daily jobs", error));
      runReminders().catch((error) => console.error("reminders", error));
    };
    setTimeout(tick, 30_000);
    setInterval(tick, 60_000).unref?.();
  }
}
