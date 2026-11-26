"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { generateContentIds, savePublishingPlan } from "@/app/actions/plan";
import { loadMonthCounts } from "@/app/actions/tasks";
import { PinIcon } from "@/components/content-note";
import { CloseButton, Dialog } from "@/components/dialog";
import { Collapse, SlideByDate } from "@/components/motion";
import type { Dictionary, ErrorKey } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { CONTENT_NOTE_MAX, compareCodes, suggestContentIds } from "@/lib/content-rules";
import { addDays, firstOfMonth, monthGrid, shiftMonth, specialDaysOn, weekdayIndex, type SpecialDay } from "@/lib/dates";
import { shortDate } from "@/lib/format-date";
import { prefersReducedMotion } from "@/lib/spring";
import { typeColor } from "@/lib/type-colors";
import { rhythm, shortChip, spreadEvenly } from "@/lib/plan-rules";

export type PlanContent = { id: string; code: string; typeCode: string; publishDate: string | null };
export type PlanPeriod = { id: string; start: string; end: string; label: string; code: string };
export type PlanType = { id: string; code: string; name: string };

const icon = (d: string, size = 20) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

/** The month planner: places content IDs on days as "Post publishing" drafts, and creates new content IDs. */
export function PlanMonth({
  customerId,
  customerName,
  shortName,
  contents,
  allCodes,
  periods,
  contentTypes,
  specialDays,
  today,
  t,
  months,
  errors,
  onClose,
  onSaved,
  onMessage,
}: {
  customerId: string;
  customerName: string;
  shortName: string;
  contents: PlanContent[];
  allCodes: string[];
  periods: PlanPeriod[];
  contentTypes: PlanType[];
  specialDays: SpecialDay[];
  today: string;
  t: Dictionary["tasks"];
  months: readonly string[];
  errors: Dictionary["errors"];
  onClose: () => void;
  onSaved: (message: string) => void;
  onMessage: (message: string, tone?: "error") => void;
}) {
  const p = t.plan;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Start on this month, or on the first month of the next contract if none covers today.
  const [month, setMonth] = useState(() => {
    const now = today.slice(0, 7);
    const upcoming = periods.filter((x) => x.end >= now).sort((a, b) => a.start.localeCompare(b.start))[0];
    const ym = upcoming && upcoming.start > now ? upcoming.start : now;
    return { year: Number(ym.slice(0, 4)), month: Number(ym.slice(5, 7)) };
  });
  const ym = `${month.year}-${String(month.month).padStart(2, "0")}`;
  const cells = useMemo(() => {
    const grid = monthGrid(month.year, month.month);
    return grid.length > 35 && !grid[35].inMonth ? grid.slice(0, 35) : grid;
  }, [month]);

  // Task counts of every customer, per day, for the month shown.
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    let live = true;
    loadMonthCounts(cells[0].iso, cells[cells.length - 1].iso).then((c) => live && setCounts(c));
    return () => {
      live = false;
    };
  }, [cells]);

  // IDs created in this window are added here until the page reloads with them.
  const [created, setCreated] = useState<PlanContent[]>([]);
  const known = new Set(contents.map((c) => c.id));
  const all = [...contents, ...created.filter((c) => !known.has(c.id))];
  const items = all.filter((c) => !c.publishDate).sort((a, b) => compareCodes(a.code, b.code));
  const fixed = all.filter((c) => c.publishDate) as (PlanContent & { publishDate: string })[];

  const [staged, setStaged] = useState<Record<string, string>>({});
  // IDs placed by hand (not by "Spread evenly"): spreading leaves them where they are.
  const [pinned, setPinned] = useState<Set<string>>(() => new Set());
  // Counts presses of "Spread evenly", so the rhythm list can go to the month afterwards.
  const [spreads, setSpreads] = useState(0);
  const pin = (id: string, on: boolean) =>
    setPinned((old) => {
      const next = new Set(old);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const [selected, setSelected] = useState<string | null>(items[0]?.id ?? null);
  const codeOf = (id: string) => all.find((c) => c.id === id)?.code ?? "";
  const kindOf = (id: string) => all.find((c) => c.id === id)?.typeCode ?? "";
  const colorOf = (kind: string) => typeColor(kind, contentTypes);
  const typeName = (kind: string) => contentTypes.find((x) => x.code === kind)?.name ?? kind;
  const colorRank = (kind: string) => {
    const i = contentTypes.findIndex((x) => x.code === kind);
    return i < 0 ? contentTypes.length : i;
  };
  const dot = (kind: string, size = 7) => <span aria-hidden="true" className="shrink-0 rounded-full" style={{ background: colorOf(kind), width: size, height: size }} />;
  const nextUnplaced = (st: Record<string, string>, after?: string) => {
    const open = items.filter((c) => !st[c.id]);
    const index = after ? items.findIndex((c) => c.id === after) : -1;
    return (open.find((c) => items.indexOf(c) > index) ?? open[0])?.id ?? null;
  };

  const place = (iso: string) => {
    if (!selected) return;
    const st = { ...staged, [selected]: iso };
    setStaged(st);
    pin(selected, true);
    setSelected(nextUnplaced(st, selected));
  };
  const unplace = (id: string) => {
    const st = { ...staged };
    delete st[id];
    setStaged(st);
    pin(id, false);
    setSelected(id);
  };
  // Spread evenly works between a first and a last day; they follow the month shown until changed.
  const monthRange = (m: { year: number; month: number }) => {
    const first = firstOfMonth(m.year, m.month);
    const next = shiftMonth(m.year, m.month, 1);
    const last = addDays(firstOfMonth(next.year, next.month), -1);
    return { from: first < today ? (today <= last ? today : first) : first, to: last };
  };
  const [range, setRange] = useState(() => monthRange(month));
  const changeMonth = (by: number) => {
    const m = shiftMonth(month.year, month.month, by);
    setMonth(m);
    setRange(monthRange(m));
  };
  const rangeProblem = range.from > range.to ? p.rangeInvalid : range.to < today ? p.monthOver : null;
  const spread = () => {
    if (!items.length) return onMessage(p.noItems, "error");
    if (rangeProblem) return onMessage(rangeProblem, "error");
    const days: string[] = [];
    for (let d = range.from < today ? today : range.from; d <= range.to; d = addDays(d, 1)) days.push(d);
    // Those placed by hand stay; they and the publications planned earlier shape the rhythm around them.
    const kept = Object.fromEntries(Object.entries(staged).filter(([id]) => pinned.has(id)));
    const open = items.filter((c) => !pinned.has(c.id));
    if (!open.length) return onMessage(p.noItems, "error");
    const around = [...fixed.map((c) => ({ date: c.publishDate, kind: c.typeCode })), ...Object.entries(kept).map(([id, date]) => ({ date, kind: kindOf(id) }))];
    setStaged({ ...kept, ...spreadEvenly(days, around, open.map((c) => ({ id: c.id, kind: c.typeCode }))) });
    setSelected(null);
    setSpreads((n) => n + 1);
  };

  // Generating IDs: for the contract that covers the month shown, or the newest one.
  const period = periods.find((x) => x.start <= ym && x.end >= ym) ?? periods[0];
  const [want, setWant] = useState<Record<string, number>>({});
  const [idNote, setIdNote] = useState(""); // one note for all the content IDs created
  const total = Object.values(want).reduce((a, b) => a + b, 0);
  const codes = [...allCodes, ...created.map((c) => c.code)];
  const preview = period
    ? contentTypes
        .filter((type) => want[type.id])
        .map((type) => {
          const list = suggestContentIds(shortName, type.code, period.code, codes, want[type.id]);
          return list.length === 1 ? list[0] : `${list[0]} … -${list[list.length - 1].split("-").pop()}`;
        })
    : [];
  const generate = () =>
    period &&
    total > 0 &&
    startTransition(async () => {
      const result = await generateContentIds(
        customerId,
        period.id,
        Object.entries(want).map(([contentTypeId, count]) => ({ contentTypeId, count })),
        idNote,
      );
      if (!result.ok) return onMessage(errors[result.error as ErrorKey] ?? errors.generic, "error");
      const fresh = result.created.map((c) => ({ id: c.id, code: c.code, typeCode: contentTypes.find((x) => x.id === c.contentTypeId)?.code ?? "", publishDate: null }));
      setCreated((old) => [...old, ...fresh]);
      setWant({});
      setIdNote("");
      if (!selected && fresh.length) setSelected(fresh[0].id);
      onMessage(fresh.length === 1 ? p.created1 : fill(p.created, { n: fresh.length }));
      router.refresh();
    });

  const stagedIds = Object.keys(staged);
  const save = () =>
    stagedIds.length > 0 &&
    startTransition(async () => {
      const result = await savePublishingPlan(customerId, Object.entries(staged).map(([contentId, date]) => ({ contentId, date })));
      if (!result.ok) return onMessage(errors[result.error as ErrorKey] ?? errors.generic, "error");
      onSaved(result.created === 1 ? p.saved1 : fill(p.saved, { n: result.created }));
    });

  // The publishing rhythm: every publication of the customer, from the first to the last, across
  // months: those planned earlier (or already out) and the new ones of this plan.
  type Entry = { id: string; code: string; kind: string; date: string; state: "published" | "planned" | "new" | "byHand" };
  const entries: Entry[] = [
    ...fixed.map((c): Entry => ({ id: c.id, code: c.code, kind: c.typeCode, date: c.publishDate, state: c.publishDate < today ? "published" : "planned" })),
    ...stagedIds.map((id): Entry => ({ id, code: codeOf(id), kind: kindOf(id), date: staged[id], state: pinned.has(id) ? "byHand" : "new" })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : compareCodes(a.code, b.code)));
  const flow = rhythm(entries.map((e) => e.date));
  const gapText = (n: number) => (n === 1 ? p.day1 : fill(p.daysN, { n }));
  const dayMonth = (iso: string) => `${Number(iso.slice(8))} ${months[Number(iso.slice(5, 7)) - 1]}`;
  const summary =
    flow.steps.length === 0
      ? p.rhythmNone
      : flow.steps.length === 1
        ? p.rhythmOne
        : [
            fill(p.rhythmAll, { n: flow.steps.length, from: dayMonth(flow.steps[0].date), to: dayMonth(flow.steps[flow.steps.length - 1].date) }),
            flow.longest === 0 ? "" : flow.shortest === flow.longest ? fill(p.rhythmEven, { gap: gapText(flow.longest) }) : fill(p.rhythmRange, { min: flow.shortest, max: flow.longest }),
          ].join(" ");
  // The rhythm of the month shown, in short: its kinds in order, and "2 Graphic post → 1 Video".
  const monthKinds = entries.filter((e) => e.date.startsWith(ym)).map((e) => e.kind);
  const monthCounts = [...monthKinds.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const fewest = Math.min(...monthCounts.map(([, n]) => n));
  const pattern = monthCounts.length > 1 ? monthCounts.map(([k, n]) => `${Math.max(1, Math.round(n / fewest))} ${typeName(k)}`).join(" → ") : null;
  const totals = [...entries.reduce((m, e) => m.set(e.kind, (m.get(e.kind) ?? 0) + 1), new Map<string, number>())].sort((a, b) => colorRank(a[0]) - colorRank(b[0]));
  // The list opens at the month shown in the calendar, and follows it when the month changes.
  const list = useRef<HTMLDivElement>(null);
  const listed = flow.steps.length > 0;
  // Months in the list: when one is added, or after "Spread evenly", the list goes to the month shown.
  const listMonths = [...new Set(flow.steps.map((x) => x.date.slice(0, 7)))].join(",");
  // It glides when the month changes; when the list itself changes (opening, spreading) it jumps there.
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    const box = list.current;
    if (!box) return;
    const heads = [...box.querySelectorAll<HTMLElement>("[data-month]")];
    const target = heads.find((h) => h.dataset.month! >= ym) ?? heads[heads.length - 1];
    if (!target) return;
    // A sticky heading reports where it is stuck; its place in the list is where its first row starts.
    const top = (target.nextElementSibling as HTMLElement | null)?.offsetTop ?? target.offsetTop;
    const glide = scrolledFor.current !== null && scrolledFor.current !== ym && !prefersReducedMotion();
    box.scrollTo({ top: Math.max(0, top - target.offsetHeight), behavior: glide ? "smooth" : "auto" });
    scrolledFor.current = ym;
  }, [ym, listMonths, spreads]);

  const placedCount = items.filter((c) => staged[c.id]).length;
  const monthDays = cells.filter((c) => c.inMonth).map((c) => c.iso);
  const phoneDays = monthDays.filter((iso) => iso >= today);

  const dayBox = (iso: string, wide: boolean) => {
    const here = stagedIds.filter((id) => staged[id] === iso);
    const n = (counts[iso] ?? 0) + here.length;
    const events = specialDaysOn(iso, specialDays);
    const past = iso < today;
    const inRange = !past && iso >= range.from && iso <= range.to;
    const look = past
      ? "bg-mint-soft border-transparent"
      : `${events.length ? "bg-sun-tint" : inRange ? "bg-range" : "bg-surface"} ${iso === today ? "border-teal" : events.length ? "border-sun-tint" : inRange ? "border-range-line" : "border-line"}`;
    const dateText = shortDate(iso, fmt);
    const load = n > 0 && <span className="whitespace-nowrap text-[10px] font-semibold text-muted">{n === 1 ? t.task1 : fill(t.tasksN, { n })}</span>;
    const chips = (
      <>
        {fixed.filter((c) => c.publishDate === iso).map((c) => (
          <span key={c.id} title={c.code} className="pointer-events-none flex min-w-0 items-center gap-1 rounded-md bg-neutral-card px-[5px] py-[3px] font-mono text-[10px] font-medium">
            {dot(c.typeCode, 6)}
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{wide ? c.code : shortChip(c.code)}</span>
          </span>
        ))}
        {here.map((id) => (
          <button
            key={id}
            type="button"
            aria-label={fill(p.remove, { code: codeOf(id), date: dateText })}
            title={pinned.has(id) ? `${codeOf(id)} · ${p.pinned}` : codeOf(id)}
            data-pinned={pinned.has(id) || undefined}
            onClick={() => unplace(id)}
            className="zk-pop relative flex min-h-6 items-center gap-1 rounded-md border-[1.5px] border-teal bg-teal-tint px-1 py-0.5 text-left font-mono text-[10px] font-medium"
          >
            {pinned.has(id) && <PinIcon size={10} className="text-teal-deep" />}
            {dot(kindOf(id), 6)}
            <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{wide ? codeOf(id) : shortChip(codeOf(id))}</span>
            {icon("M6 6l12 12M18 6 6 18", 10)}
          </button>
        ))}
      </>
    );
    const target = !past && selected && (
      <button type="button" aria-label={fill(p.placeOn, { code: codeOf(selected), date: dateText })} onClick={() => place(iso)} className="absolute inset-0 rounded-[14px] transition-colors hover:bg-teal/10" />
    );
    if (wide) {
      return (
        <div key={iso} className={`relative flex min-h-14 items-center gap-3 rounded-[14px] border-[1.5px] px-3 py-2 ${look}`}>
          {target}
          <div className="pointer-events-none flex w-9 shrink-0 flex-col items-center leading-none">
            <span className="text-[11px] font-semibold text-muted">{t.weekdaysShort[weekdayIndex(iso)]}</span>
            <span className="text-lg font-semibold">{Number(iso.slice(8))}</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {events.map((e) => <span key={e.name} className="pointer-events-none text-[11px] font-semibold text-sun-ink">{e.name}</span>)}
            {chips}
          </div>
          <span className="pointer-events-none">{load}</span>
        </div>
      );
    }
    return (
      <div key={iso} className={`relative flex min-h-[98px] min-w-0 flex-col gap-1 rounded-[14px] border-[1.5px] p-1.5 ${look}`}>
        {target}
        <div className="pointer-events-none flex items-baseline justify-between gap-1">
          <span className={`text-[13px] font-semibold ${past ? "text-muted" : "text-ink"}`}>{Number(iso.slice(8))}</span>
          {load}
        </div>
        {events.map((e) => <span key={e.name} className="pointer-events-none text-[10px] font-semibold leading-tight text-sun-ink">{e.name}</span>)}
        {chips}
      </div>
    );
  };
  const fmt = { monthsShort: t.monthsShort };

  return (
    <Dialog label={p.title} onClose={onClose} wide>
      <div className="flex items-start gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-[13px] font-semibold text-teal-deep">{customerName}</span>
          <h2 className="text-2xl font-semibold">{p.title}</h2>
          <p className="max-w-[70ch] text-sm leading-normal text-ink-soft">{p.intro}</p>
        </div>
        <CloseButton label={t.form.close} onClick={onClose} />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <div className="contents lg:flex lg:w-[300px] lg:shrink-0 lg:flex-col lg:gap-4">
          <section className="order-1 flex flex-col gap-3 rounded-[20px] bg-surface p-4 lg:order-none">
            <div className="flex items-baseline gap-2">
              <h3 id="plan-ids" className="flex-1 text-[15px] font-semibold">{p.toPlace}</h3>
              {items.length > 0 && <span className="text-[13px] text-ink-soft">{fill(p.placed, { placed: placedCount, total: items.length })}</span>}
            </div>
            {items.length > 0 ? (
              <div role="group" aria-labelledby="plan-ids" className="flex max-h-[300px] flex-col gap-1.5 overflow-y-auto p-0.5 [&>*]:shrink-0">
                {items.map((c) => {
                  const on = selected === c.id;
                  const when = staged[c.id];
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSelected(on ? null : c.id)}
                      className={`flex min-h-11 flex-wrap items-center gap-x-2.5 gap-y-0.5 rounded-[14px] border-[1.5px] px-3 py-1.5 text-left transition-colors duration-200 ${on ? "border-teal bg-teal-tint" : "border-line bg-surface hover:bg-mint"}`}
                    >
                      {dot(c.typeCode)}
                      <span className="font-mono text-[13px] font-medium">{c.code}</span>
                      <span className={`ml-auto flex items-center gap-1 whitespace-nowrap text-xs font-semibold ${when ? "text-teal-deep" : "text-muted"}`}>
                        {when && pinned.has(c.id) && <PinIcon size={11} />}
                        {when ? shortDate(when, fmt) : p.notPlaced}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13px] leading-normal text-muted">{p.allPlaced}</p>
            )}
          </section>

          <section aria-label={p.rhythmTitle} className="order-3 flex min-h-0 flex-col gap-3 rounded-[20px] bg-surface p-4 lg:order-none lg:flex-1 lg:basis-0">
            <div className="flex flex-col gap-1">
              <h3 className="text-[15px] font-semibold">{p.rhythmTitle}</h3>
              <p className="text-[13px] leading-snug text-ink-soft">{summary}</p>
            </div>
            {listed && (
              <div className="flex flex-col gap-1.5 text-xs text-ink-soft">
                {pattern && (
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span aria-hidden="true" className="flex gap-[3px]">
                      {monthKinds.slice(0, 9).map((k, i) => <span key={i} className="h-[7px] w-[13px] rounded-full" style={{ background: colorOf(k) }} />)}
                    </span>
                    <b className="font-semibold text-ink">{pattern}</b>
                  </span>
                )}
                <span className="flex flex-wrap gap-x-3 gap-y-1">
                  {totals.map(([k, n]) => (
                    <span key={k} className="flex items-center gap-1.5">
                      {dot(k)}
                      {typeName(k)} · {n}
                    </span>
                  ))}
                </span>
              </div>
            )}
            {listed && (
              <div ref={list} role="list" aria-label={p.rhythmList} tabIndex={0} className="relative -mr-1.5 flex max-h-[65vh] flex-col overflow-y-auto overscroll-contain pr-1.5 [scrollbar-width:thin] lg:max-h-none lg:min-h-[260px] lg:flex-1 lg:basis-0">
                {flow.steps.map((step, i) => {
                  const month = step.date.slice(0, 7);
                  const opensMonth = i === 0 || flow.steps[i - 1].date.slice(0, 7) !== month;
                  const here = entries.filter((e) => e.date === step.date);
                  const state = (["byHand", "new", "planned", "published"] as const).find((x) => here.some((e) => e.state === x))!;
                  const fresh = state === "new" || state === "byHand";
                  const inMonth = entries.filter((e) => e.date.startsWith(month)).length;
                  return (
                    <Fragment key={step.date}>
                      {step.gap !== null && (
                        <div aria-hidden="true" className="flex shrink-0 items-center gap-2 py-[3px] pl-[26px] text-[11px] font-semibold text-ink-soft">
                          <span className="h-[18px] w-0.5 rounded-full bg-line-strong" />
                          <span title={step.longest ? p.longest : undefined} className={`rounded-full px-2 py-0.5 ${step.longest ? "bg-sun-tint text-sun-ink" : "bg-mint"}`}>{gapText(step.gap)}</span>
                        </div>
                      )}
                      {opensMonth && (
                        <div data-month={month} className={`sticky top-0 z-[2] flex shrink-0 justify-between gap-2 bg-surface py-1.5 text-xs font-bold uppercase tracking-[0.04em] ${month === ym ? "text-teal-deep" : "text-muted"}`}>
                          <span>{months[Number(month.slice(5)) - 1]} {month.slice(0, 4)}</span>
                          <span>{inMonth === 1 ? p.monthCount1 : fill(p.monthCountN, { n: inMonth })}</span>
                        </div>
                      )}
                      <div
                        role="listitem"
                        data-state={state}
                        className={`zk-fade-up relative flex shrink-0 items-center gap-2.5 overflow-hidden rounded-[14px] border-[1.5px] py-[7px] pl-3.5 pr-2.5 transition-colors duration-300 ${fresh ? "border-teal bg-teal-tint" : "border-line-strong bg-mint-soft"} ${state === "published" ? "opacity-55" : ""}`}
                      >
                        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={{ background: colorOf(here[0].kind) }} />
                        <span className="flex w-[34px] shrink-0 flex-col items-center leading-none">
                          <span className="text-[10.5px] font-semibold text-ink-soft">{t.weekdaysShort[weekdayIndex(step.date)]}</span>
                          <span className="text-[19px] font-semibold">{Number(step.date.slice(8))}</span>
                        </span>
                        <span className="flex min-w-0 flex-wrap gap-1">
                          {here.map((e) => (
                            <span key={e.id} title={e.code} className="flex min-w-0 items-center gap-[5px] rounded-[7px] bg-surface px-[7px] py-[3px] font-mono text-[11.5px] font-medium">
                              {e.state === "byHand" && <PinIcon size={11} className="text-teal-deep" />}
                              {dot(e.kind)}
                              <span className="overflow-hidden text-ellipsis whitespace-nowrap">{shortChip(e.code)}</span>
                            </span>
                          ))}
                        </span>
                        <span className={`ml-auto shrink-0 whitespace-nowrap text-[11px] font-semibold ${fresh ? "text-teal-deep" : "text-muted"}`}>
                          {state === "byHand" ? p.statusByHand : state === "new" ? p.statusNew : state === "planned" ? p.statusPlanned : p.statusPublished}
                        </span>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
              <span className="flex items-center gap-1.5"><span className="size-3 rounded border-[1.5px] border-line-strong bg-mint-soft" />{p.legendFixed}</span>
              <span className="flex items-center gap-1.5"><span className="size-3 rounded border-[1.5px] border-teal bg-teal-tint" />{p.legendNewShort}</span>
              <span className="flex items-center gap-1.5"><PinIcon size={12} className="text-teal-deep" />{p.legendByHand}</span>
              <span className="flex items-center gap-1.5"><span className="size-3 rounded-full border border-event bg-sun-tint" />{p.longest}</span>
            </div>
          </section>
        </div>

        <div className="contents lg:flex lg:min-w-0 lg:flex-1 lg:flex-col lg:gap-4">
          <section className="order-2 flex min-w-0 flex-col gap-3 rounded-[20px] bg-surface p-4 lg:order-none">
            <div className="flex items-center gap-1">
              <button type="button" aria-label={t.prevMonth} onClick={() => changeMonth(-1)} className="-ml-2 flex size-11 items-center justify-center rounded-full text-icon hover:bg-mint">{icon("m15 18-6-6 6-6")}</button>
              <h3 className="min-w-[150px] overflow-hidden whitespace-nowrap text-center text-lg font-semibold">
                <SlideByDate date={ym}>{months[month.month - 1]} {month.year}</SlideByDate>
              </h3>
              <button type="button" aria-label={t.nextMonth} onClick={() => changeMonth(1)} className="flex size-11 items-center justify-center rounded-full text-icon hover:bg-mint">{icon("m9 18 6-6-6-6")}</button>
            </div>
            <div className="flex flex-wrap items-end gap-2.5 rounded-2xl bg-mint p-2.5">
              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-soft">
                {p.rangeFrom}
                <input type="date" value={range.from} min={today} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} className="h-11 rounded-xl border-[1.5px] border-line-strong bg-surface px-2.5 text-sm font-medium text-ink" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-soft">
                {p.rangeTo}
                <input type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} className="h-11 rounded-xl border-[1.5px] border-line-strong bg-surface px-2.5 text-sm font-medium text-ink" />
              </label>
              <button type="button" onClick={spread} disabled={!!rangeProblem} className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full bg-teal px-4 text-sm font-semibold text-white disabled:opacity-50">
                {icon("M4 5v14M20 5v14M9 12h6M12 9l3 3-3 3M12 9l-3 3 3 3", 18)}
                {p.spread}
              </button>
              <span className={`basis-full text-xs ${rangeProblem ? "font-semibold text-danger" : "text-ink-soft"}`}>{rangeProblem ?? fill(p.rangeHint, { n: items.length })}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
              {stagedIds.length > 0 && (
                <button type="button" onClick={() => { setStaged({}); setPinned(new Set()); setSelected(items[0]?.id ?? null); }} className="zk-pop min-h-11 whitespace-nowrap rounded-full bg-mint px-4 text-sm font-semibold">{p.clear}</button>
              )}
              <span aria-live="polite" className="ml-auto text-right text-[13px] font-semibold text-teal-deep">
                {selected ? fill(p.placing, { code: codeOf(selected) }) : items.length ? p.pickOne : ""}
              </span>
            </div>

            <SlideByDate date={ym} block>
              <div className="hidden grid-cols-7 gap-1 md:grid">
                {t.weekdaysShort.map((w) => <span key={w} className="pb-1 pt-0.5 text-center text-[11px] font-semibold text-muted">{w}</span>)}
                {cells.map(({ iso, inMonth }) => (inMonth ? dayBox(iso, false) : <div key={iso} aria-hidden="true" />))}
              </div>
              <div className="flex flex-col gap-1.5 md:hidden">
                {phoneDays.map((iso) => dayBox(iso, true))}
                {phoneDays.length === 0 && <p className="py-4 text-center text-[13px] text-muted">{p.monthOver}</p>}
              </div>
            </SlideByDate>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-soft">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-3.5 rounded-[3px] border border-subtle bg-neutral-card" />{p.legendFixed}</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-3.5 rounded-[3px] border-[1.5px] border-teal bg-teal-tint" />{p.legendNew}</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-3.5 rounded-[3px] border border-event bg-sun-tint" />{p.legendEvent}</span>
              <span className="flex items-center gap-1.5"><PinIcon size={12} className="text-teal-deep" />{p.legendPinned}</span>
              <span>{p.legendAll}</span>
            </div>
          </section>

          {period && contentTypes.length > 0 && (
            <section className="order-4 flex flex-col gap-3 rounded-[20px] bg-surface p-4 lg:order-none">
              <div className="flex flex-col gap-1">
                <h3 className="text-[15px] font-semibold">{p.generate}</h3>
                <span className="text-[13px] text-ink-soft">{p.forContract} {period.label}</span>
              </div>
              <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {contentTypes.map((type) => {
                const n = want[type.id] ?? 0;
                const step = (d: number) => setWant((w) => ({ ...w, [type.id]: Math.max(0, Math.min(20, n + d)) }));
                return (
                  <div key={type.id} className="flex items-center gap-2.5">
                    <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
                      {dot(type.code)}
                      {type.name}
                    </span>
                    <button type="button" aria-label={fill(p.fewer, { type: type.name })} disabled={n === 0} onClick={() => step(-1)} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mint disabled:opacity-40">{icon("M5 12h14", 18)}</button>
                    <span aria-live="polite" className="w-7 text-center text-base font-semibold tabular-nums">
                      <SlideByDate date={String(n).padStart(3, "0")}>{n}</SlideByDate>
                    </span>
                    <button type="button" aria-label={fill(p.more, { type: type.name })} disabled={n === 20} onClick={() => step(1)} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mint disabled:opacity-40">{icon("M12 5v14M5 12h14", 18)}</button>
                  </div>
                );
              })}
              </div>
              <p className="text-xs leading-normal text-ink-soft [overflow-wrap:anywhere]">{preview.length ? fill(p.creates, { list: preview.join(", ") }) : p.continues}</p>
              <Collapse open={total > 0}>
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                  {p.noteLabel}
                  <textarea
                    aria-label={p.noteLabel}
                    value={idNote}
                    maxLength={CONTENT_NOTE_MAX}
                    rows={2}
                    onChange={(e) => setIdNote(e.target.value)}
                    className="min-h-[64px] w-full resize-none rounded-[14px] border-[1.5px] border-line-strong bg-surface px-3 py-2 text-sm font-normal leading-normal [field-sizing:content]"
                  />
                  <span className="text-xs font-normal text-muted">{p.noteHelp}</span>
                </label>
              </Collapse>
              <button
                type="button"
                disabled={!total || pending}
                onClick={generate}
                className={`min-h-11 self-end rounded-full px-5 text-sm font-semibold transition-colors duration-200 ${total ? "bg-teal text-white" : "bg-line text-icon"}`}
              >
                {total === 0 ? p.createIds : total === 1 ? p.create1 : fill(p.createN, { n: total })}
              </button>
            </section>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <p className="flex-[1_1_260px] text-sm leading-snug text-ink-soft">{p.footer}</p>
        <button type="button" onClick={onClose} className="min-h-12 rounded-full bg-surface px-[22px] text-[15px] font-semibold">{p.cancel}</button>
        <button
          type="button"
          disabled={!stagedIds.length || pending}
          onClick={save}
          className={`min-h-12 rounded-full px-[26px] text-[15px] font-semibold transition-colors duration-200 ${stagedIds.length ? "bg-sun text-ink" : "bg-line text-icon"}`}
        >
          {stagedIds.length === 0 ? p.saveNone : stagedIds.length === 1 ? p.save1 : fill(p.saveN, { n: stagedIds.length })}
        </button>
      </div>
    </Dialog>
  );
}
