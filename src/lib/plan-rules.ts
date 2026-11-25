// The month planner's rules: spreading content evenly over a month, and the publishing rhythm.
// Pure functions, tested in plan-rules.test.ts.
import { daysBetween } from "./dates";

export type PlanItem = { id: string; kind: string };
/** A publication already on a day (planned earlier, or placed by hand in this plan), with its kind. */
export type Placed = { date: string; kind: string };

/**
 * The order to publish items in: a steady rhythm of kinds. The most common kind is the base and the
 * others are spaced evenly through it (8 posts and 4 videos: post, post, video, post, post, video, …;
 * a third kind goes right after the second). It starts with the kind listed first (posts before
 * videos). Within a kind the items keep their order (gpost-1 before gpost-2).
 */
export function interleave<T extends { kind: string }>(items: T[]): T[] {
  const groups = new Map<string, T[]>(); // kinds in the order they are first listed
  for (const item of items) groups.set(item.kind, [...(groups.get(item.kind) ?? []), item]);
  const kinds = [...groups.keys()];
  const n = items.length;
  const size = (kind: string) => groups.get(kind)!.length;
  const ranked = [...kinds].sort((a, b) => size(b) - size(a) || kinds.indexOf(a) - kinds.indexOf(b));
  const slots: (string | null)[] = Array(n).fill(null);
  for (const kind of ranked.slice(1)) {
    for (let j = 0; j < size(kind); j++) {
      let at = Math.min(n - 1, Math.round(((j + 0.5) * n) / size(kind)));
      while (slots[at] !== null) at = (at + 1) % n;
      slots[at] = kind;
    }
  }
  const pattern = slots.map((kind) => kind ?? ranked[0]);
  // Start with the kind listed first: the same rhythm read backwards, if it ends with that kind instead.
  if (pattern[0] !== kinds[0] && pattern[n - 1] === kinds[0]) pattern.reverse();
  const taken = new Map<string, number>();
  return pattern.map((kind) => {
    const i = taken.get(kind) ?? 0;
    taken.set(kind, i + 1);
    return groups.get(kind)![i];
  });
}

/** How far each kind's spacing is from even, in publications (lower is steadier). */
function unevenness(sequence: string[]): number {
  const at = new Map<string, number[]>();
  sequence.forEach((kind, i) => at.set(kind, [...(at.get(kind) ?? []), i]));
  let cost = 0;
  for (const list of at.values()) {
    const even = sequence.length / list.length;
    for (let i = 1; i < list.length; i++) cost += (list[i] - list[i - 1] - even) ** 2;
  }
  return cost;
}

/**
 * Kinds for the open places in a row of publications (null = open), so that the whole row, the
 * publications already there included, follows the rhythm of interleave() as closely as it can.
 * `open` lists the kinds to put in the open places (one per place), the preferred kind first.
 */
export function fillRhythm(sequence: (string | null)[], open: string[]): string[] {
  const counts = new Map<string, number>();
  for (const kind of [...open, ...sequence.filter((k): k is string => k !== null)]) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  const ideal = interleave([...counts].flatMap(([kind, n]) => Array.from({ length: n }, () => ({ kind })))).map((x) => x.kind);
  const left = new Map<string, number>();
  for (const kind of open) left.set(kind, (left.get(kind) ?? 0) + 1);
  const order = [...left.keys()];
  // First try: the ideal rhythm, place by place; where its kind has run out, the kind most behind.
  const row = sequence.slice();
  const seen = new Map<string, number>();
  const due = new Map<string, number>();
  row.forEach((kind, i) => {
    due.set(ideal[i], (due.get(ideal[i]) ?? 0) + 1);
    if (kind === null) {
      const pick =
        (left.get(ideal[i]) ?? 0) > 0
          ? ideal[i]
          : order.filter((k) => left.get(k)! > 0).sort((a, b) => (due.get(b) ?? 0) - (seen.get(b) ?? 0) - ((due.get(a) ?? 0) - (seen.get(a) ?? 0)) || order.indexOf(a) - order.indexOf(b))[0];
      left.set(pick, left.get(pick)! - 1);
      row[i] = pick;
    }
    seen.set(row[i]!, (seen.get(row[i]!) ?? 0) + 1);
  });
  // Then swap open places while that makes every kind more evenly spaced.
  const free = sequence.map((kind, i) => (kind === null ? i : -1)).filter((i) => i >= 0);
  const full = row as string[];
  let best = unevenness(full);
  for (let better = true; better; ) {
    better = false;
    for (let a = 0; a < free.length; a++) {
      for (let b = a + 1; b < free.length; b++) {
        const [i, j] = [free[a], free[b]];
        if (full[i] === full[j]) continue;
        [full[i], full[j]] = [full[j], full[i]];
        const cost = unevenness(full);
        if (cost < best - 1e-9) {
          best = cost;
          better = true;
        } else [full[i], full[j]] = [full[j], full[i]];
      }
    }
  }
  return free.map((i) => full[i]);
}

/**
 * Places items on the given days as evenly as possible.
 * - days: the days that may be used, in order (e.g. the rest of the month from today)
 * - fixed: publications already on a day (planned earlier, or placed by hand), with their kind; new
 *   ones go into the largest gaps around them, never on their days
 * - The items go in a steady rhythm of kinds (see interleave), continuing around the fixed ones, and
 *   each kind keeps its order.
 * Returns item id -> day.
 */
export function spreadEvenly(days: string[], fixed: Placed[], items: PlanItem[]): Record<string, string> {
  if (!days.length || !items.length) return {};
  const taken = new Set(fixed.map((f) => f.date));
  const fixedIndex = days.map((d, i) => (taken.has(d) ? i : -1)).filter((i) => i >= 0);
  const chosen: number[] = [];
  const count = items.length;
  if (!fixedIndex.length) {
    for (let i = 0; i < count; i++) chosen.push(Math.min(days.length - 1, Math.floor(((i + 0.5) * days.length) / count)));
  } else {
    // Free stretches between days already used (the range's edges count as boundaries).
    // Each new item goes to the stretch where it keeps the spacing widest; then items are
    // spaced evenly inside their stretch.
    const bounds = [-1, ...fixedIndex, days.length];
    const stretches = bounds.slice(1).map((end, i) => ({ start: bounds[i], end, count: 0 }));
    let placed = 0;
    for (; placed < count; placed++) {
      let best: (typeof stretches)[number] | null = null;
      for (const s of stretches) {
        const room = s.end - s.start - 1; // free days strictly inside
        if (s.count >= room) continue;
        if (!best || (s.end - s.start) / (s.count + 1) > (best.end - best.start) / (best.count + 1)) best = s;
      }
      if (!best) break; // every day is taken
      best.count++;
    }
    for (const s of stretches) {
      for (let j = 1; j <= s.count; j++) chosen.push(s.start + Math.round(((s.end - s.start) * j) / (s.count + 1)));
    }
    // More items than free days: the rest share days, spread over the whole range.
    const rest = count - placed;
    for (let i = 0; i < rest; i++) chosen.push(Math.min(days.length - 1, Math.floor(((i + 0.5) * days.length) / rest)));
  }
  chosen.sort((a, b) => a - b);

  // Which kind goes on each chosen day: the rhythm over everything in the range, in date order.
  const inRange = fixed.filter((f) => f.date >= days[0] && f.date <= days[days.length - 1]);
  const row = [...inRange.map((f) => ({ date: f.date, kind: f.kind as string | null })), ...chosen.map((i) => ({ date: days[i], kind: null as string | null }))].sort(
    (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.kind === null ? 1 : 0) - (b.kind === null ? 1 : 0)),
  );
  const kinds = fillRhythm(
    row.map((r) => r.kind),
    interleave(items).map((x) => x.kind),
  );
  const openDays = row.filter((r) => r.kind === null).map((r) => r.date);
  // Each kind's items, in their own order, go to that kind's days in date order.
  const queue = new Map<string, PlanItem[]>();
  for (const item of items) queue.set(item.kind, [...(queue.get(item.kind) ?? []), item]);
  const result: Record<string, string> = {};
  kinds.forEach((kind, i) => {
    const item = queue.get(kind)!.shift()!;
    result[item.id] = openDays[i];
  });
  return result;
}

export type RhythmStep = { date: string; gap: number | null; sameMonth: boolean; longest: boolean };

/**
 * Publishing days in order (each once), across months, with the days since the one before. A gap is
 * "longest" when it is the longest within its month (and that month's gaps differ); gaps that span
 * two months are shown but not counted. shortest/longest: over the gaps within months.
 */
export function rhythm(dates: string[]): { steps: RhythmStep[]; shortest: number; longest: number } {
  const sorted = [...new Set(dates)].sort();
  const steps: RhythmStep[] = sorted.map((date, i) => ({
    date,
    gap: i ? daysBetween(sorted[i - 1], date) : null,
    sameMonth: i > 0 && sorted[i - 1].slice(0, 7) === date.slice(0, 7),
    longest: false,
  }));
  const inMonth = steps.filter((s) => s.sameMonth);
  for (const month of new Set(inMonth.map((s) => s.date.slice(0, 7)))) {
    const gaps = inMonth.filter((s) => s.date.startsWith(month));
    const max = Math.max(...gaps.map((s) => s.gap!));
    const min = Math.min(...gaps.map((s) => s.gap!));
    if (max > min) for (const s of gaps) s.longest = s.gap === max;
  }
  const gaps = inMonth.map((s) => s.gap!);
  return { steps, shortest: gaps.length ? Math.min(...gaps) : 0, longest: gaps.length ? Math.max(...gaps) : 0 };
}

/** "thrive-vid-nd26-5" -> "vid-5": short enough for a calendar cell. */
export function shortChip(code: string): string {
  const parts = code.split("-");
  return parts.length >= 4 ? `${parts[1]}-${parts[parts.length - 1]}` : code;
}
