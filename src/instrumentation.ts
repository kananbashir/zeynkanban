// Runs once when the server starts. Pending database changes are applied here, before the first
// page is served: on the hosting there is no command line, and on your own computer it means
// `npm run dev` after pulling an update works without any extra step.
// In production it also starts a timer for the once-a-day notifications (src/lib/daily.ts) and task reminders (src/lib/reminders.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const production = process.env.NODE_ENV === "production";
  if (process.env.SKIP_MIGRATIONS !== "1") {
    const { runMigrations } = await import("./db/migrate");
    try {
      await runMigrations();
    } catch (error) {
      if (production) throw error;
      // On your own computer, say what went wrong but let the site start (e.g. MySQL not running yet).
      console.error("Could not update the database. Is MySQL running? Then run: npm run local\n", error);
    }
  }
  if (production && process.env.SKIP_DAILY_JOBS !== "1") {
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
