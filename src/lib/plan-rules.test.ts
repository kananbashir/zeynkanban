import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { rhythm, shortChip, spreadEvenly } from "./plan-rules";

const december = Array.from({ length: 31 }, (_, i) => addDays("2026-12-01", i));

describe("spread evenly", () => {
  it("spaces items equally over an empty month", () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ id: "p" + i, kind: "gpost" }));
    const placed = Object.values(spreadEvenly(december, [], items)).sort();
    expect(placed).toEqual(["2026-12-02", "2026-12-06", "2026-12-10", "2026-12-14", "2026-12-18", "2026-12-22", "2026-12-26", "2026-12-30"]);
  });
  it("fills the largest gaps around days already used, never on them", () => {
    const fixed = ["2026-12-05", "2026-12-06", "2026-12-07"];
    const placed = spreadEvenly(december, fixed, [{ id: "a", kind: "vid" }, { id: "b", kind: "vid" }]);
    const days = Object.values(placed);
    for (const d of days) expect(fixed).not.toContain(d);
    // Both go in the long stretch after the 7th, splitting it into roughly equal parts (8, 9 and 7 days).
    expect(days.sort()).toEqual(["2026-12-15", "2026-12-24"]);
  });
  it("mixes kinds instead of putting one kind at the end", () => {
    const items = [...["v1", "v2"].map((id) => ({ id, kind: "vid" })), ...["g1", "g2", "g3", "g4"].map((id) => ({ id, kind: "gpost" }))];
    const placed = spreadEvenly(december, [], items);
    const order = Object.entries(placed).sort((a, b) => (a[1] < b[1] ? -1 : 1)).map(([id]) => id[0]);
    expect(order.join("")).not.toMatch(/^g+v+$|^v+g+$/);
  });
  it("balances between several stretches", () => {
    const fixed = ["2026-12-10", "2026-12-20"];
    const placed = Object.values(spreadEvenly(december, fixed, [1, 2, 3].map((n) => ({ id: "g" + n, kind: "gpost" })))).sort();
    expect(placed).toEqual(["2026-12-05", "2026-12-15", "2026-12-26"]);
  });
  it("still places everything when there are more items than free days", () => {
    const short = december.slice(0, 3);
    const items = Array.from({ length: 5 }, (_, i) => ({ id: "x" + i, kind: "gpost" }));
    expect(Object.keys(spreadEvenly(short, ["2026-12-02"], items))).toHaveLength(5);
  });
  it("returns nothing without days or items", () => {
    expect(spreadEvenly([], [], [{ id: "a", kind: "vid" }])).toEqual({});
    expect(spreadEvenly(december, [], [])).toEqual({});
  });
});

describe("rhythm", () => {
  it("lists days with the gaps between them and marks the longest", () => {
    const r = rhythm(["2026-11-07", "2026-11-02", "2026-11-12", "2026-11-14"]);
    expect(r.steps.map((s) => [s.date.slice(8), s.gap, s.longest])).toEqual([
      ["02", null, false],
      ["07", 5, true],
      ["12", 5, true],
      ["14", 2, false],
    ]);
    expect([r.shortest, r.longest]).toEqual([2, 5]);
  });
  it("marks nothing when all gaps are equal", () => {
    expect(rhythm(["2026-12-02", "2026-12-06", "2026-12-10"]).steps.some((s) => s.longest)).toBe(false);
  });
  it("shortens content IDs for the calendar", () => {
    expect(shortChip("thrive-gpost-nd26-12")).toBe("gpost-12");
    expect(shortChip("custom")).toBe("custom");
  });
});
