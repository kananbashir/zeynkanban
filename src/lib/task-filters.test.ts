import { describe, expect, it } from "vitest";
import { filterDay, filterOptions, isFiltered, NO_FILTERS, type Filters } from "./task-filters";
import type { DayTasks, TaskView } from "./tasks";

const task = (id: string, over: Partial<TaskView>): TaskView =>
  ({ id, customerId: "c1", customerName: "Thrive", customerColor: "#fff", contentCode: `thrive-${id}`, contentTypeCode: "gpost", typeName: "Graphic design", assignees: [{ id: "p1", name: "Murad" }], description: "", note: "", ...over }) as TaskView;
const day: DayTasks = {
  overdue: [task("a", {}), task("b", { contentTypeCode: "vid", assignees: [{ id: "p2", name: "Leyla" }] })],
  due: [task("c", { customerId: "c2", customerName: "Aliday", contentTypeCode: "vid" })],
  postponed: [],
  finished: [task("d", { customerId: "c2", customerName: "Aliday", note: "Logo ready" })],
  cancelled: [],
};
const f = (over: Partial<Filters>): Filters => ({ ...NO_FILTERS, ...over });
const ids = (d: DayTasks) => Object.values(d).flat().map((t) => t.id).sort().join("");

describe("filterDay", () => {
  it("nothing picked shows everything", () => {
    expect(ids(filterDay(day, NO_FILTERS))).toBe("abcd");
    expect(isFiltered(NO_FILTERS)).toBe(false);
  });
  it("any of the picks within a filter, all filters together", () => {
    expect(ids(filterDay(day, f({ customers: ["c2"] })))).toBe("cd");
    expect(ids(filterDay(day, f({ customers: ["c1", "c2"], types: ["vid"] })))).toBe("bc");
    expect(ids(filterDay(day, f({ sections: ["overdue", "due"], types: ["vid"] })))).toBe("bc");
    expect(ids(filterDay(day, f({ people: ["p2"] })))).toBe("b");
  });
  it("search looks at the content ID, type, customer, people, description and note", () => {
    expect(ids(filterDay(day, f({ query: "logo" })))).toBe("d");
    expect(ids(filterDay(day, f({ query: "LEYLA" })))).toBe("b");
    expect(isFiltered(f({ query: " x " }))).toBe(true);
  });
});

describe("filterOptions", () => {
  it("counts follow the other filters, not their own", () => {
    const o = filterOptions(day, f({ customers: ["c2"] }));
    expect(o.sections).toEqual({ overdue: 0, due: 1, postponed: 0, finished: 1, cancelled: 0 });
    expect(o.total).toBe(2);
    // The customer list itself still counts every customer (its own filter is left out).
    expect(o.customers.map((c) => [c.label, c.count])).toEqual([["Aliday", 2], ["Thrive", 2]]);
    expect(o.types.map((t) => [t.id, t.count])).toEqual([["gpost", 1], ["vid", 1]]);
  });
  it("status picks narrow the other counts", () => {
    const o = filterOptions(day, f({ sections: ["overdue"] }));
    expect(o.customers.map((c) => [c.label, c.count])).toEqual([["Aliday", 0], ["Thrive", 2]]);
    expect(o.people.map((p) => [p.label, p.count])).toEqual([["Leyla", 1], ["Murad", 1]]);
  });
  it("only the content types of the day's tasks", () => {
    expect(filterOptions(day, NO_FILTERS).types.map((t) => t.id)).toEqual(["gpost", "vid"]);
  });
  it("a customer picked on another day stays listed with 0", () => {
    const o = filterOptions(day, f({ customers: ["c9"] }), { customers: [{ id: "c9", label: "Nar Café", count: 0, color: "#000" }] });
    expect(o.customers.find((c) => c.id === "c9")).toEqual({ id: "c9", label: "Nar Café", count: 0, color: "#000" });
  });
});
