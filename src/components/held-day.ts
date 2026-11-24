"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { DayTasks, TaskView } from "@/lib/tasks";
import type { Section } from "@/lib/task-rules";

// A task just moved to a finished status first asks for its finished work, right where it is.
// While it asks, the day views keep its card in its old place (and on its old day); once the
// question is answered (Save or Not now), the card goes on to its new group, gliding there.

type Place = { section: Section; index: number; task: TaskView };
/** `place`: where the card was when the question started, noted by the day view showing it. */
type Hold = { at: number; patch: Partial<TaskView>; place?: Place };
const holds = new Map<string, Hold>();
const listeners = new Set<() => void>();
let version = 0;
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};
const live = (h: Hold | undefined) => !!h && h.at > Date.now() - 10 * 60_000;

export const askForFinished = {
  /** `patch`: what the card shows meanwhile (its new status), in case its day no longer lists it. */
  start(taskId: string, patch: Partial<TaskView>) {
    holds.set(taskId, { at: Date.now(), patch });
    emit();
  },
  stop(taskId: string) {
    if (holds.delete(taskId)) emit();
  },
  has: (taskId: string) => live(holds.get(taskId)),
};

/** Where a card was when its question started (kept with the hold, not in any one view). */
function notePlace(taskId: string, place: Place) {
  const hold = holds.get(taskId);
  if (hold && !hold.place) holds.set(taskId, { ...hold, place });
}

const SECTIONS: Section[] = ["overdue", "due", "postponed", "finished", "cancelled"];
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/** The day as the server sent it, except that cards still asking for their finished work stay where they were. */
export function useHeldDay(day: DayTasks): DayTasks {
  const v = useSyncExternalStore(subscribe, () => version, () => 0);
  return useMemo(() => {
    const out = Object.fromEntries(SECTIONS.map((s) => [s, [...day[s]]])) as DayTasks;
    for (const [id, hold] of holds) {
      if (!live(hold)) continue;
      const section = SECTIONS.find((s) => out[s].some((x) => x.id === id));
      // Just started: the day still shows the card where it was. Note the place.
      if (!hold.place) {
        if (section) notePlace(id, { section, index: out[section].findIndex((x) => x.id === id), task: out[section].find((x) => x.id === id)! });
        continue;
      }
      const { place } = hold;
      if (section === place.section) continue;
      const current = section ? out[section].find((x) => x.id === id)! : { ...place.task, ...hold.patch };
      if (section) out[section] = out[section].filter((x) => x.id !== id);
      out[place.section].splice(Math.min(place.index, out[place.section].length), 0, current);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, v]);
}
