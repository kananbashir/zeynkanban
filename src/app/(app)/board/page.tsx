import { getDictionary } from "@/i18n/server";
import { requireRole } from "@/lib/auth";
import { isIsoDateString, monthGrid, monthOf, todayIso } from "@/lib/dates";
import { activeContentTypes } from "@/lib/customers";
import { allSpecialDays, countsByDay, dayTasks, liveStatuses } from "@/lib/tasks";
import { BoardView } from "./board-view";

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ date?: string; m?: string }> }) {
  await requireRole("admin", "manager");
  const { t } = await getDictionary();
  const params = await searchParams;
  const today = todayIso();
  const date = isIsoDateString(params.date) ? params.date : today;
  const shown = params.m && /^\d{4}-\d{2}$/.test(params.m) ? { year: Number(params.m.slice(0, 4)), month: Number(params.m.slice(5)) } : monthOf(date);
  const grid = monthGrid(shown.year, shown.month);

  const [day, counts, statuses, specialDays, types] = await Promise.all([
    dayTasks(date, today),
    countsByDay(grid[0].iso, grid[grid.length - 1].iso, { excludeDrafts: true }),
    liveStatuses(),
    allSpecialDays(),
    activeContentTypes(),
  ]);

  return (
    <BoardView
      date={date}
      today={today}
      shownMonth={shown}
      day={day}
      counts={counts}
      statuses={statuses}
      specialDays={specialDays}
      contentTypes={types.map((x) => ({ code: x.code, name: x.name }))}
      t={t.tasks}
      months={t.customers.months}
      errors={t.errors}
    />
  );
}
