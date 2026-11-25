// The filters above a day's task list (managing board and My tasks): status, customers, people,
// content types and the search box. Pure, tested in task-filters.test.ts.
import type { Section } from "./task-rules";
import type { DayTasks, TaskView } from "./tasks";

export const SECTIONS: Section[] = ["overdue", "due", "postponed", "finished", "cancelled"];

/** What is picked. An empty list means "all" for that filter. */
export type Filters = { sections: Section[]; customers: string[]; people: string[]; types: string[]; query: string };
export const NO_FILTERS: Filters = { sections: [], customers: [], people: [], types: [], query: "" };
type Facet = "sections" | "customers" | "people" | "types";

export const filterCount = (f: Filters) => f.sections.length + f.customers.length + f.people.length + f.types.length;
export const isFiltered = (f: Filters) => filterCount(f) > 0 || f.query.trim() !== "";

/** Whether a task passes every filter (but the one skipped, when counting that filter's options). */
function passes(task: TaskView, f: Filters, skip?: Facet): boolean {
  if (skip !== "customers" && f.customers.length && !f.customers.includes(task.customerId)) return false;
  if (skip !== "people" && f.people.length && !task.assignees.some((p) => f.people.includes(p.id))) return false;
  if (skip !== "types" && f.types.length && !f.types.includes(task.contentTypeCode)) return false;
  const q = f.query.trim().toLocaleLowerCase("az");
  if (!q) return true;
  return [task.contentCode, task.typeName, task.customerName, task.assignees.map((p) => p.name).join(" "), task.description, task.note].join(" ").toLocaleLowerCase("az").includes(q);
}

/** The day's tasks that pass the filters, still in their groups. */
export function filterDay(day: DayTasks, f: Filters): DayTasks {
  const out = {} as DayTasks;
  for (const s of SECTIONS) out[s] = f.sections.length && !f.sections.includes(s) ? [] : day[s].filter((task) => passes(task, f));
  return out;
}

export type Option = { id: string; label: string; count: number; color?: string };

/**
 * The choices of each filter, with how many tasks each would show given the other filters (so the
 * numbers follow what else is picked). Customers, people and types come from the day's own tasks;
 * ones picked earlier that have nothing this day stay listed (with 0) so they can be taken off.
 */
export function filterOptions(day: DayTasks, f: Filters, known: { customers?: Option[]; people?: Option[] } = {}) {
  const all = SECTIONS.flatMap((s) => day[s].map((task) => ({ s, task })));
  const inSections = (s: Section) => !f.sections.length || f.sections.includes(s);
  const sections = Object.fromEntries(SECTIONS.map((s) => [s, day[s].filter((task) => passes(task, f)).length])) as Record<Section, number>;
  const collect = (facet: Facet, keys: (task: TaskView) => { id: string; label: string; color?: string }[], picked: string[], extra: Option[] = []) => {
    const map = new Map<string, Option>();
    for (const { task } of all) for (const k of keys(task)) if (!map.has(k.id)) map.set(k.id, { ...k, count: 0 });
    for (const { s, task } of all) {
      if (!inSections(s) || !passes(task, f, facet)) continue;
      for (const k of keys(task)) map.get(k.id)!.count++;
    }
    for (const id of picked) if (!map.has(id)) map.set(id, { ...(extra.find((o) => o.id === id) ?? { id, label: id }), count: 0 });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "az"));
  };
  return {
    sections,
    total: SECTIONS.reduce((n, s) => n + sections[s], 0),
    customers: collect("customers", (t) => [{ id: t.customerId, label: t.customerName, color: t.customerColor }], f.customers, known.customers),
    people: collect("people", (t) => t.assignees.map((p) => ({ id: p.id, label: p.name })), f.people, known.people),
    types: collect("types", (t) => [{ id: t.contentTypeCode, label: t.contentTypeCode }], f.types),
  };
}
