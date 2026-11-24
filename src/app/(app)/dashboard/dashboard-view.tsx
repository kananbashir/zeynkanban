"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { SegmentedControl, SlideByDate } from "@/components/motion";
import { avatarColor } from "@/components/task-card";
import { initials } from "@/components/top-bar";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { chartTop, percent, shiftPeriod, type Period } from "@/lib/dashboard-rules";
import type { DashboardData } from "@/lib/dashboard";
import { addDays, monthOf, specialDaysOn, weekdayIndex, type SpecialDay } from "@/lib/dates";
import { shortDate } from "@/lib/format-date";
import { daysBetween } from "@/lib/dates";
import { TaskTypeIcon } from "@/components/task-type-icon";

type T = Dictionary["dashboard"];
type TaskT = Dictionary["tasks"];

const FINISHED = "#0b7f7b";
const OPEN = "#a9d8d3";

const icon = (d: string, size = 20) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
    <path d={d} />
  </svg>
);

function href(view: Period["kind"], d?: string) {
  const q = new URLSearchParams();
  if (view === "week") q.set("view", "week");
  if (d) q.set("d", d);
  const s = q.toString();
  return s ? `/dashboard?${s}` : "/dashboard";
}

/** A number that fades in again whenever it changes. */
function Num({ value, className = "" }: { value: number | string; className?: string }) {
  return (
    <span key={value} className={`zk-fade-up inline-block tabular-nums ${className}`}>
      {value}
    </span>
  );
}

export function DashboardView({
  period,
  today,
  data,
  specialDays,
  t,
  taskT,
  months,
}: {
  period: Period;
  today: string;
  data: DashboardData;
  specialDays: SpecialDay[];
  t: T;
  taskT: TaskT;
  months: readonly string[];
}) {
  const week = period.kind === "week";
  const current = period.from <= today && today <= period.to;
  const prev = shiftPeriod(period, -1);
  const next = shiftPeriod(period, 1);
  const fmt = { monthsShort: taskT.monthsShort };

  const titleOf = (p: Period) => {
    if (p.kind === "month") {
      const { year, month } = monthOf(p.from);
      return `${months[month - 1]} ${year}`;
    }
    const a = monthOf(p.from);
    const b = monthOf(p.to);
    return a.month === b.month ? `${Number(p.from.slice(8))} – ${shortDate(p.to, fmt)} ${b.year}` : `${shortDate(p.from, fmt)} – ${shortDate(p.to, fmt)} ${b.year}`;
  };

  // An employee's own dashboard: only their tasks, with Coming up and By task type instead of the team.
  const mine = data.mine;
  const pmMonth = months[monthOf(prev.from).month - 1];
  const compare = week ? fill(t.vsWeek, { n: data.previousTotal }) : fill(t.vsMonth, { n: data.previousTotal, month: pmMonth });
  const maxOf = (list: { total: number }[]) => Math.max(1, ...list.map((x) => x.total));

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-x-[18px] gap-y-2.5 rounded-[28px] bg-surface p-4 md:px-[22px] md:py-5">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[13px] font-semibold text-teal-deep">{mine ? t.myTitle : t.title}</span>
          <div className="flex min-w-0 items-center gap-1">
            <Link href={href(period.kind, prev.from)} scroll={false} aria-label={t.prevPeriod} className="-ml-2.5 flex size-11 shrink-0 items-center justify-center rounded-full text-icon hover:bg-mint">
              {icon("m15 18-6-6 6-6")}
            </Link>
            <h1 className="min-w-0 overflow-hidden whitespace-nowrap text-[22px] font-semibold md:text-[28px]">
              <SlideByDate date={`${period.kind}${period.from}`}>{titleOf(period)}</SlideByDate>
            </h1>
            <Link href={href(period.kind, next.from)} scroll={false} aria-label={t.nextPeriod} className="flex size-11 shrink-0 items-center justify-center rounded-full text-icon hover:bg-mint">
              {icon("m9 18 6-6-6-6")}
            </Link>
            {!current && (
              <Link href={href(period.kind)} scroll={false} className="zk-pop min-h-11 shrink-0 content-center whitespace-nowrap rounded-full bg-sun px-4 text-sm font-semibold text-ink">
                {week ? t.thisWeek : t.thisMonth}
              </Link>
            )}
          </div>
        </div>
        <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2.5">
          <SegmentedControl
            label={t.period}
            value={period.kind}
            items={[
              { key: "week", label: t.week, href: href("week", current ? undefined : period.from) },
              { key: "month", label: t.month, href: href("month", current ? undefined : addDays(period.from, 3)) },
            ]}
          />
          <Link href={mine ? "/my-tasks" : "/board"} className="flex min-h-12 items-center gap-2 whitespace-nowrap rounded-full bg-sun px-5 text-[15px] font-semibold text-ink">
            {mine ? t.openMyTasks : t.openBoard}
            {icon("M5 12h14M13 6l6 6-6 6")}
          </Link>
        </div>
      </header>

      <section aria-label={t.totals} className={`grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 ${mine ? "xl:grid-cols-5" : "xl:grid-cols-6"}`}>
        <Tile label={mine ? t.myTasks : t.tasks} value={data.total} sub={compare} />
        <Tile
          label={t.finished}
          value={data.finished}
          sub={!data.total ? t.noTasks : mine ? fill(t.myFinishedSub, { p: percent(data.finished, data.total), n: mine.onTime }) : fill(t.finishedSub, { p: percent(data.finished, data.total) })}
        />
        <Tile
          label={
            <span className="flex items-center gap-1.5 text-danger">
              {icon("M12 8v5M12 16.5v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0", 16)}
              {t.overdue}
            </span>
          }
          value={data.overdue}
          sub={t.overdueSub}
        />
        <Tile label={<span className="text-sun-ink">{t.postponed}</span>} value={data.postponed} sub={t.postponedSub} />
        <Tile label={t.cancelled} value={data.cancelled} sub={t.cancelledSub} />
        {!mine && <Tile label={t.drafts} value={data.drafts} sub={t.draftsSub} />}
      </section>

      <DayChart period={period} today={today} perDay={data.perDay} specialDays={specialDays} t={t} taskT={taskT} mine={!!mine} />

      {mine ? (
        <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
          <ComingUp tasks={mine.comingUp} today={today} t={t} taskT={taskT} />
          <Card title={t.myCustomers} hint={t.myCustomersHint}>
            {data.customers
              .filter((c) => c.total > 0)
              .map((c, _i, list) => (
                <BarRow
                  key={c.id}
                  lead={<span className="size-3 shrink-0 rounded-full border-[1.5px] border-black/25" style={{ background: c.color }} />}
                  name={c.name}
                  total={c.total}
                  finished={c.finished}
                  max={maxOf(list)}
                  t={t}
                />
              ))}
            {!data.customers.some((c) => c.total > 0) && <Empty t={t} />}
            {mine.byType.length > 0 && (
              <>
                <h3 className="mt-1 text-base font-semibold">{t.byType}</h3>
                {mine.byType.map((k) => (
                  <BarRow
                    key={k.id}
                    lead={
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-mint text-teal-deep">
                        <TaskTypeIcon name={k.icon} size={15} />
                      </span>
                    }
                    name={k.name}
                    total={k.total}
                    finished={k.finished}
                    max={maxOf(mine.byType)}
                    t={t}
                  />
                ))}
              </>
            )}
          </Card>
          <StatusCard statuses={data.statuses} total={data.total} t={{ ...t, statuses: t.myStatuses, statusesHint: t.myStatusesHint }} taskT={taskT} />
        </div>
      ) : (
      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))]">
        <Card title={t.team} hint={t.teamHint}>
          {data.people.map((p) => (
            <BarRow
              key={p.id}
              lead={<span className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: avatarColor(p.id) }}>{initials(p.name)}</span>}
              name={p.name}
              total={p.total}
              finished={p.finished}
              max={maxOf(data.people)}
              t={t}
            />
          ))}
          {data.people.length === 0 && <Empty t={t} />}
        </Card>

        <Card title={t.customers} hint={t.customersHint}>
          {data.customers.map((c) => (
            <BarRow
              key={c.id}
              lead={<span className="size-3 shrink-0 rounded-full border-[1.5px] border-black/25" style={{ background: c.color }} />}
              name={c.name}
              total={c.total}
              finished={c.finished}
              max={maxOf(data.customers)}
              link={{ href: `/customers/${c.id}`, label: fill(t.openCustomer, { name: c.name }) }}
              t={t}
            />
          ))}
          {data.customers.length === 0 && <Empty t={t} />}
        </Card>

        <StatusCard statuses={data.statuses} total={data.total} t={t} taskT={taskT} />

        <Card title={t.contentTypes} hint={t.contentTypesHint}>
          {data.contentTypes.map((k) => (
            <BarRow
              key={k.id}
              lead={<span className="shrink-0 rounded-lg bg-mint px-2 py-1 font-mono text-xs font-medium">{k.code}</span>}
              name={k.name}
              total={k.total}
              finished={k.finished}
              max={maxOf(data.contentTypes)}
              t={t}
            />
          ))}
          {data.contentTypes.length === 0 && <Empty t={t} />}
        </Card>
      </div>
      )}
    </main>
  );
}

function Tile({ label, value, sub }: { label: ReactNode; value: number; sub: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-[24px] bg-surface p-4 md:p-5">
      <span className="text-[13px] font-medium text-icon">{label}</span>
      <span className="text-[28px] font-semibold leading-[1.1] md:text-[34px]">
        <Num value={value} />
      </span>
      <span className="text-xs text-muted">{sub}</span>
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-[18px] rounded-[28px] bg-surface p-4 md:p-[22px]">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="flex-1 text-lg font-semibold">{title}</h2>
        <span className="text-xs text-muted">{hint}</span>
      </div>
      {children}
    </section>
  );
}

function Empty({ t }: { t: T }) {
  return <p className="text-sm text-muted">{t.empty}</p>;
}

/** One row of a horizontal bar list: finished (dark) and open (light) next to each other, scaled to the longest row. */
function BarRow({ lead, name, total, finished, max, link, t }: { lead: ReactNode; name: string; total: number; finished: number; max: number; link?: { href: string; label: string }; t: T }) {
  const open = total - finished;
  const tip = fill(t.rowTip, { name, total, finished, open });
  return (
    <div title={tip} className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        {lead}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
        <span className="whitespace-nowrap text-[13px] text-ink-soft tabular-nums">
          <Num value={total} className="font-semibold text-ink" /> · {fill(t.finishedN, { n: finished })}
        </span>
        {link && (
          <Link href={link.href} aria-label={link.label} title={link.label} className="-my-0.5 -mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-mint">
            {icon("m9 18 6-6-6-6", 16)}
          </Link>
        )}
      </div>
      <div role="img" aria-label={tip} className="zk-grow-x flex h-2.5 gap-0.5 rounded-[4px] bg-mint-soft">
        {finished > 0 && <span className="transition-[width] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]" style={{ width: `${(finished / max) * 100}%`, background: FINISHED, borderRadius: open ? "4px 0 0 4px" : 4 }} />}
        {open > 0 && <span className="transition-[width] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]" style={{ width: `${(open / max) * 100}%`, background: OPEN, borderRadius: finished ? "0 4px 4px 0" : 4 }} />}
      </div>
    </div>
  );
}

function StatusCard({ statuses, total, t, taskT }: { statuses: DashboardData["statuses"]; total: number; t: T; taskT: TaskT }) {
  const label = (s: DashboardData["statuses"][number]) => (s.deleted ? fill(taskT.deletedStatus, { name: s.name }) : s.name);
  const aria = statuses.map((s) => `${label(s)} ${s.count}`).join(", ");
  return (
    <Card title={t.statuses} hint={t.statusesHint}>
      <div role="img" aria-label={aria} className="zk-grow-x flex h-2 gap-0.5 overflow-hidden rounded-full bg-mint-soft">
        {statuses
          .filter((s) => s.count > 0)
          .map((s) => (
            <span key={s.id} className="transition-[flex-grow] duration-500" style={{ flex: `${s.count} 1 0%`, background: s.color }} />
          ))}
      </div>
      <div className="flex flex-col gap-3">
        {statuses.map((s) => (
          <div key={s.id} className="flex items-center gap-2.5 text-sm">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
            <span className={`flex-1 font-medium ${s.deleted ? "text-ink-soft" : ""}`}>{label(s)}</span>
            <Num value={s.count} className="font-semibold" />
            <span className="w-11 text-right text-[13px] text-muted tabular-nums">{percent(s.count, total)}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DayChart({ period, today, perDay, specialDays, t, taskT, mine = false }: { period: Period; today: string; perDay: DashboardData["perDay"]; specialDays: SpecialDay[]; t: T; taskT: TaskT; mine?: boolean }) {
  const week = period.kind === "week";
  const days = period.days;
  const [picked, setPicked] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const selected = picked && days.includes(picked) ? picked : days.includes(today) ? today : days[0];
  const shown = hover && days.includes(hover) ? hover : selected;
  const top = chartTop(days.map((d) => perDay[d]?.total ?? 0));
  const fmt = { monthsShort: taskT.monthsShort };

  const describe = (iso: string) => {
    const x = perDay[iso] ?? { total: 0, finished: 0 };
    const count = x.total === 1 ? taskT.task1 : fill(taskT.tasksN, { n: x.total });
    return x.total ? fill(t.dayText, { tasks: count, finished: x.finished, open: x.total - x.finished }) : t.dayNone;
  };
  const dateText = (iso: string) => `${taskT.weekdays[weekdayIndex(iso)]}, ${shortDate(iso, fmt)}`;
  const events = specialDaysOn(shown, specialDays);

  return (
    <section aria-label={mine ? t.myPerDay : t.perDay} className="flex min-w-0 flex-col gap-3.5 rounded-[28px] bg-surface p-4 md:p-[22px]">
      <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2">
        <h2 className="flex-1 text-lg font-semibold">{mine ? t.myPerDay : t.perDay}</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-icon">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px]" style={{ background: FINISHED }} />{t.legendFinished}</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px]" style={{ background: OPEN }} />{t.legendOpen}</span>
          <span className="flex items-center gap-1.5"><span className="h-1 w-2.5 rounded-sm bg-event" />{t.legendEvent}</span>
        </div>
      </div>

      <div aria-live="polite" className="flex min-h-[52px] flex-wrap items-center gap-x-3.5 gap-y-1.5 rounded-2xl bg-mint py-2 pl-4 pr-2">
        <span key={shown} className="zk-fade-up flex flex-wrap items-baseline gap-x-3.5 gap-y-0.5">
          <span className="text-sm font-semibold">{dateText(shown)}</span>
          <span className="text-sm text-ink-soft">
            {describe(shown)}
            {events.length ? ` · ${events.map((e) => e.name).join(", ")}` : ""}
          </span>
        </span>
        <Link href={mine ? `/my-tasks?date=${shown}` : `/board?date=${shown}`} className="ml-auto flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-surface px-3 text-[13px] font-semibold">
          {t.openDay}
          {icon("M7 17 17 7M7 7h10v10", 16)}
        </Link>
      </div>

      <div className="flex flex-col gap-1.5 pl-7">
        <div className="relative h-[180px]">
          {[top, top / 2, 0].map((v) => (
            <div key={v} className="pointer-events-none absolute inset-x-0 border-t border-line" style={{ bottom: `${(v / top) * 100}%` }}>
              <span className="absolute -left-7 -top-2 w-[22px] text-right text-[11px] text-muted tabular-nums">{v}</span>
            </div>
          ))}
          <div className="absolute inset-0 flex items-stretch">
            {days.map((iso, i) => {
              const x = perDay[iso] ?? { total: 0, finished: 0 };
              const open = x.total - x.finished;
              const h = (n: number) => (n ? `max(3px, ${(n / top) * 100}%)` : "0px");
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`${dateText(iso)}: ${describe(iso)}`}
                  aria-pressed={iso === selected}
                  onClick={() => setPicked(iso)}
                  onMouseEnter={() => setHover(iso)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(iso)}
                  onBlur={() => setHover(null)}
                  className={`flex min-w-0 flex-1 flex-col items-center justify-end rounded-t-lg transition-colors duration-200 ${iso === selected ? "bg-mint" : iso === hover ? "bg-mint-soft" : ""}`}
                >
                  <span className="zk-grow-y flex h-full w-3/5 max-w-5 flex-col justify-end">
                    <span className="transition-[height] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]" style={{ height: h(open), background: OPEN, borderRadius: "4px 4px 0 0", marginBottom: open && x.finished ? 2 : 0 }} />
                    <span className="transition-[height] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]" style={{ height: h(x.finished), background: FINISHED, borderRadius: open ? 0 : "4px 4px 0 0" }} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div aria-hidden="true" className="flex items-start">
          {days.map((iso) => {
            const dom = Number(iso.slice(8));
            const major = week || dom === 1 || dom % 5 === 0 || iso === today;
            const isToday = iso === today;
            return (
              <span key={iso} className="flex min-w-0 flex-1 flex-col items-center gap-[3px]">
                <span className={`whitespace-nowrap rounded-full px-[5px] py-0.5 text-[11px] tabular-nums ${isToday ? "bg-teal font-semibold text-white" : "font-medium text-muted"} ${major ? "" : "hidden lg:inline"}`}>
                  {week ? `${taskT.weekdaysShort[weekdayIndex(iso)]} ${dom}` : dom}
                </span>
                {specialDaysOn(iso, specialDays).length > 0 && <span className="h-1 w-2.5 rounded-sm bg-event" />}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** An employee's next deadlines: date tile, task type, content ID, and how soon (late ones first). */
function ComingUp({ tasks, today, t, taskT }: { tasks: NonNullable<DashboardData["mine"]>["comingUp"]; today: string; t: T; taskT: TaskT }) {
  const when = (end: string) => {
    const n = daysBetween(today, end);
    if (n < 0) return { text: n === -1 ? t.late1 : fill(t.lateN, { n: -n }), tone: "bg-danger/10 text-danger" };
    if (n === 0) return { text: t.today, tone: "bg-sun-tint text-sun-ink" };
    return { text: n === 1 ? t.tomorrow : fill(t.inDays, { n }), tone: "bg-mint text-ink-soft" };
  };
  return (
    <Card title={t.comingUp} hint={t.comingUpHint}>
      <ul className="-my-1 flex flex-col">
        {tasks.map((x, i) => {
          const w = when(x.end);
          return (
            <li key={x.id} className={i ? "border-t border-line" : ""}>
              <Link
                href={`/my-tasks?date=${x.dueDate <= today ? today : x.dueDate}&focus=${x.id}`} // an unfinished task started (or late) shows on today
                aria-label={fill(t.openTask, { type: x.typeName, date: shortDate(x.end, taskT) })}
                className="flex items-center gap-3 rounded-xl py-2.5 hover:bg-mint-soft"
              >
                <span className="flex h-12 w-11 shrink-0 flex-col items-center justify-center gap-1 rounded-xl bg-mint leading-none">
                  <b className="text-base font-bold">{Number(x.end.slice(8))}</b>
                  <span className="text-[9.5px] font-extrabold uppercase tracking-wide text-teal-deep">{taskT.monthsShort[Number(x.end.slice(5, 7)) - 1]}</span>
                </span>
                <span className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-mint-soft text-teal-deep">
                  <TaskTypeIcon name={x.typeIcon} size={16} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">{x.typeName}</span>
                  <span className="truncate font-mono text-xs text-muted">{x.code}</span>
                </span>
                <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-extrabold ${w.tone}`}>{w.text}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {tasks.length === 0 && <p className="text-sm text-muted">{t.comingUpNone}</p>}
    </Card>
  );
}
