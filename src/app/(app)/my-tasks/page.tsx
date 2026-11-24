import { getDictionary } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { isIsoDateString, monthGrid, monthOf, todayIso } from "@/lib/dates";
import { personalCounts, personalForDay } from "@/lib/personal";
import { allSpecialDays, countsByDay, dayTasks, liveStatuses } from "@/lib/tasks";
import { MyTasksView } from "./my-tasks-view";

/** Everyone's own page: the tasks assigned to them, and their private personal tasks. */
export default async function MyTasksPage({ searchParams }: { searchParams: Promise<{ date?: string; m?: string; focus?: string }> }) {
  const me = await requireUser();
  const { t } = await getDictionary();
  const params = await searchParams;
  const today = todayIso();
  const date = isIsoDateString(params.date) ? params.date : today;
  const shown = params.m && /^\d{4}-\d{2}$/.test(params.m) ? { year: Number(params.m.slice(0, 4)), month: Number(params.m.slice(5)) } : monthOf(date);
  const grid = monthGrid(shown.year, shown.month);
  const from = grid[0].iso;
  const to = grid[grid.length - 1].iso;

  const [day, counts, own, statuses, specialDays, personal] = await Promise.all([
    dayTasks(date, today, { assigneeId: me.id }),
    countsByDay(from, to, { assigneeId: me.id }),
    personalCounts(me.id, from, to),
    liveStatuses(),
    allSpecialDays(),
    personalForDay(me.id, date, today),
  ]);
  // The calendar is private to its owner, so it counts personal tasks too.
  const allCounts = { ...counts };
  for (const [d, n] of Object.entries(own)) allCounts[d] = (allCounts[d] ?? 0) + n;

  return (
    <MyTasksView
      date={date}
      today={today}
      shownMonth={shown}
      day={day}
      counts={allCounts}
      statuses={statuses}
      specialDays={specialDays}
      personal={personal}
      canOpenTasks={me.role !== "employee"}
      focusTask={params.focus ?? null}
      t={t.myTasks}
      taskT={t.tasks}
      months={t.customers.months}
      errors={t.errors}
    />
  );
}
