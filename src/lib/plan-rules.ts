// The month planner's rules: spreading content evenly over a month, and the publishing rhythm.
// Pure functions, tested in plan-rules.test.ts.
import { daysBetween } from "./dates";

export type PlanItem = { id: string; kind: string };

/**
 * Places items on the given days as evenly as possible.
 * - days: the days that may be used, in order (e.g. the rest of the month from today)
 * - fixed: days that already have a publication of this customer; new ones go into the largest gaps around them
 * - Different kinds (videos, posts) are interleaved, so one kind doesn't bunch up at the end.
 * Returns item id -> day.
 */
export function spreadEvenly(days: string[], fixed: string[], items: PlanItem[]): Record<string, string> {
  if (!days.length || !items.length) return {};
  // Interleave kinds: each item gets a position between 0 and 1 within its own kind.
  const byKind = new Map<string, PlanItem[]>();
  for (const item of items) byKind.set(item.kind, [...(byKind.get(item.kind) ?? []), item]);
  const order = [...byKind.values()].flatMap((list) => list.map((item, i) => ({ item, at: (i + 0.5) / list.length }))).sort((a, b) => a.at - b.at);

  const fixedIndex = days.map((d, i) => (fixed.includes(d) ? i : -1)).filter((i) => i >= 0);
  const chosen: number[] = [];
  if (!fixedIndex.length) {
    for (let i = 0; i < order.length; i++) chosen.push(Math.min(days.length - 1, Math.floor(((i + 0.5) * days.length) / order.length)));
  } else {
    // Free stretches between days already used (the month's edges count as boundaries).
    // Each new item goes to the stretch where it keeps the spacing widest; then items are
    // spaced evenly inside their stretch.
    const bounds = [-1, ...fixedIndex, days.length];
    const stretches = bounds.slice(1).map((end, i) => ({ start: bounds[i], end, count: 0 }));
    let placed = 0;
    for (; placed < order.length; placed++) {
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
    const rest = order.length - placed;
    for (let i = 0; i < rest; i++) chosen.push(Math.min(days.length - 1, Math.floor(((i + 0.5) * days.length) / rest)));
  }
  chosen.sort((a, b) => a - b);
  return Object.fromEntries(order.map((o, i) => [o.item.id, days[chosen[i]]]));
}

export type RhythmStep = { date: string; gap: number | null; longest: boolean };

/** Publishing days in order, with the days between each and the next, and which gap is the longest. */
export function rhythm(dates: string[]): { steps: RhythmStep[]; shortest: number; longest: number } {
  const sorted = [...new Set(dates)].sort();
  const gaps = sorted.slice(1).map((d, i) => daysBetween(sorted[i], d));
  const longest = gaps.length ? Math.max(...gaps) : 0;
  const shortest = gaps.length ? Math.min(...gaps) : 0;
  return {
    steps: sorted.map((date, i) => ({ date, gap: i ? gaps[i - 1] : null, longest: i > 0 && gaps[i - 1] === longest && longest > shortest })),
    shortest,
    longest,
  };
}

/** "thrive-vid-nd26-5" -> "vid-5": short enough for a calendar cell. */
export function shortChip(code: string): string {
  const parts = code.split("-");
  return parts.length >= 4 ? `${parts[1]}-${parts[parts.length - 1]}` : code;
}
