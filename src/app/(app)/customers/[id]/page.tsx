import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SegmentedControl } from "@/components/motion";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { getDictionary } from "@/i18n/server";
import { fill } from "@/i18n/format";
import { requireRole } from "@/lib/auth";
import { formatPeriod, parseMonth, periodCode } from "@/lib/content-rules";
import { activeContentTypes, contentsOf, contractsOf } from "@/lib/customers";
import { isIsoDateString, monthGrid, monthOf, todayIso } from "@/lib/dates";
import { activePeople, allSpecialDays, countsByDay, dayTasks, draftsOf, listedTaskTypes, liveStatuses, taskById, tasksOfCustomer } from "@/lib/tasks";
import { TasksTab } from "./tasks-tab";
import { ContentsTab } from "./contents-tab";
import { InfoTab } from "./info-tab";
import { RestoreCustomer } from "./restore-customer";

const TABS = ["tasks", "contents", "info"] as const;
type Tab = (typeof TABS)[number];

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; date?: string; m?: string; edit?: string; plan?: string }>;
}) {
  const user = await requireRole("admin", "manager");
  const { id } = await params;
  const query = await searchParams;
  const requested = query.tab;
  const tab: Tab = (TABS as readonly string[]).includes(requested ?? "") ? (requested as Tab) : "tasks";
  const { t } = await getDictionary();
  const c = t.customers;

  const [customer] = await db.select().from(customers).where(eq(customers.id, id));
  if (!customer) notFound();
  const [contractRows, contentRows, types, customerTasks] = await Promise.all([contractsOf(id), contentsOf(id), activeContentTypes(), tasksOfCustomer(id)]);

  // Publish date of each content ID: the date of its (unarchived) publishing task.
  const publishDate = new Map<string, string>();
  for (const task of customerTasks) if (task.isPublishing && !task.archived && !publishDate.has(task.contentId)) publishDate.set(task.contentId, task.dueDate);

  const periods = contractRows.map((row) => {
    const start = parseMonth(row.startMonth)!;
    const end = parseMonth(row.endMonth)!;
    return { id: row.id, start: row.startMonth.slice(0, 7), end: row.endMonth.slice(0, 7), label: formatPeriod(start, end, c.months), code: periodCode(start, end) };
  });
  const current = periods[0];
  const activeCount = contentRows.filter((x) => !x.archived).length;
  const admin = user.role === "admin";

  async function tasksTab() {
    const today = todayIso();
    const date = isIsoDateString(query.date) ? query.date : today;
    const shown = query.m && /^\d{4}-\d{2}$/.test(query.m) ? { year: Number(query.m.slice(0, 4)), month: Number(query.m.slice(5)) } : monthOf(date);
    const grid = monthGrid(shown.year, shown.month);
    const [day, drafts, counts, statuses, specialDays, taskTypes, people, editing] = await Promise.all([
      dayTasks(date, today, { customerId: id }),
      draftsOf(id),
      countsByDay(grid[0].iso, grid[grid.length - 1].iso, { customerId: id }),
      liveStatuses(),
      allSpecialDays(),
      listedTaskTypes(),
      activePeople(),
      query.edit ? taskById(query.edit) : Promise.resolve(null),
    ]);
    return (
      <TasksTab
        customerId={id}
        customerName={customer.name}
        date={date}
        today={today}
        shownMonth={shown}
        day={day}
        drafts={drafts}
        counts={counts}
        statuses={statuses}
        specialDays={specialDays}
        contents={contentRows.filter((x) => !x.archived).map((x) => ({ id: x.id, code: x.code, typeName: x.typeName, publishDate: publishDate.get(x.id) ?? null }))}
        types={taskTypes}
        people={people}
        editTask={editing && editing.customerId === id ? editing : null}
        canArchive={admin}
        openPlan={query.plan === "1" && !customer.archived}
        plan={{
          shortName: customer.shortName,
          contents: contentRows.filter((x) => !x.archived).map((x) => ({ id: x.id, code: x.code, typeCode: x.typeCode, publishDate: publishDate.get(x.id) ?? null })),
          allCodes: contentRows.map((x) => x.code),
          periods,
          contentTypes: types,
        }}
        t={t.tasks}
        months={c.months}
        errors={t.errors}
      />
    );
  }

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-x-[18px] gap-y-3.5 rounded-[28px] bg-surface p-4 md:px-[22px] md:py-5">
        <div className="flex min-w-0 flex-[1_1_260px] items-center gap-3.5">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-[18px] text-[22px] font-bold text-on-pastel" style={{ background: customer.color }}>
            {customer.name.charAt(0).toLocaleUpperCase("az")}
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="text-[22px] font-semibold leading-tight md:text-[28px]">{customer.name}</h1>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13px] text-ink-soft">
              <span className="rounded-lg bg-mint px-2 py-1 font-mono text-xs font-medium text-ink">{customer.shortName}</span>
              <span>{fill(c.summary, { contents: activeCount, period: current ? current.label : c.noContract })}</span>
            </div>
          </div>
        </div>
        <nav aria-label={customer.name}>
          <SegmentedControl
            label={customer.name}
            value={tab}
            itemClassName="min-h-11 px-3 text-[13px] md:px-[18px] md:text-sm"
            items={TABS.map((key) => ({ key, label: c.tabs[key], href: `/customers/${id}?tab=${key}` }))}
          />
        </nav>
      </header>

      {customer.archived && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-[22px] bg-sun-tint px-4 py-3 text-sm text-sun-ink">
          <span className="flex-[1_1_260px]">{c.archivedBanner}</span>
          {admin && <RestoreCustomer id={id} label={c.restore} errors={t.errors} />}
        </div>
      )}

      {tab === "tasks" && (await tasksTab())}

      {tab === "contents" && (
        <ContentsTab
          customerId={id}
          shortName={customer.shortName}
          periods={periods}
          contents={contentRows}
          types={types}
          tasks={customerTasks}
          publishDates={Object.fromEntries(publishDate)}
          canArchive={admin}
          taskT={t.tasks}
          t={c.contents}
          errors={t.errors}
        />
      )}

      {tab === "info" && (
        <InfoTab
          customerId={id}
          name={customer.name}
          archived={customer.archived}
          info={{
            name: customer.name,
            shortName: customer.shortName,
            contactPerson: customer.contactPerson,
            phone: customer.phone,
            email: customer.email,
            social: customer.social,
            notes: customer.notes ?? "",
          }}
          periods={periods}
          isAdmin={admin}
          t={c}
          errors={t.errors}
        />
      )}
    </main>
  );
}
