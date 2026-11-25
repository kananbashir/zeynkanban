import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { fillRhythm, interleave, rhythm, shortChip, spreadEvenly } from "./plan-rules";

const december = Array.from({ length: 31 }, (_, i) => addDays("2026-12-01", i));

describe("spread evenly", () => {
  it("spaces items equally over an empty month", () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ id: "p" + i, kind: "gpost" }));
    const placed = Object.values(spreadEvenly(december, [], items)).sort();
    expect(placed).toEqual(["2026-12-02", "2026-12-06", "2026-12-10", "2026-12-14", "2026-12-18", "2026-12-22", "2026-12-26", "2026-12-30"]);
  });
  it("fills the largest gaps around days already used, never on them", () => {
    const fixed = ["2026-12-05", "2026-12-06", "2026-12-07"];
    const placed = spreadEvenly(december, fixed.map((date) => ({ date, kind: "gpost" })), [{ id: "a", kind: "vid" }, { id: "b", kind: "vid" }]);
    const days = Object.values(placed);
    for (const d of days) expect(fixed).not.toContain(d);
    // Both go in the long stretch after the 7th, splitting it into roughly equal parts (8, 9 and 7 days).
    expect(days.sort()).toEqual(["2026-12-15", "2026-12-24"]);
  });
  it("publishes in a rhythm: two posts, a video, … with each kind in its own order", () => {
    const items = [...["g1", "g2", "g3", "g4"].map((id) => ({ id, kind: "gpost" })), ...["v1", "v2"].map((id) => ({ id, kind: "vid" }))];
    const placed = spreadEvenly(december, [], items);
    const order = Object.entries(placed).sort((a, b) => (a[1] < b[1] ? -1 : 1)).map(([id]) => id);
    expect(order).toEqual(["g1", "g2", "v1", "g3", "g4", "v2"]);
  });
  it("continues the rhythm around publications already there (no two videos side by side)", () => {
    // A video already on the 4th; 5 posts and 2 videos to place around it.
    const items = [...[1, 2, 3, 4, 5].map((n) => ({ id: "g" + n, kind: "gpost" })), ...[1, 2].map((n) => ({ id: "v" + n, kind: "vid" }))];
    const placed = spreadEvenly(december, [{ date: "2026-12-04", kind: "vid" }], items);
    const row = [...Object.entries(placed).map(([id, date]) => ({ date, k: id[0] })), { date: "2026-12-04", k: "V" }].sort((a, b) => (a.date < b.date ? -1 : 1)).map((x) => x.k.toLowerCase()).join("");
    expect(row).not.toMatch(/vv/);
    expect(row).toBe("gvggvggv");
    expect(Object.values(placed)).not.toContain("2026-12-04");
  });
  it("keeps each kind in order around fixed ones", () => {
    const items = [1, 2, 3].map((n) => ({ id: "g" + n, kind: "gpost" }));
    const placed = spreadEvenly(december, [{ date: "2026-12-15", kind: "vid" }], items);
    expect(placed.g1 < placed.g2 && placed.g2 < placed.g3).toBe(true);
  });
  it("balances between several stretches", () => {
    const fixed = ["2026-12-10", "2026-12-20"].map((date) => ({ date, kind: "gpost" }));
    const placed = Object.values(spreadEvenly(december, fixed, [1, 2, 3].map((n) => ({ id: "g" + n, kind: "gpost" })))).sort();
    expect(placed).toEqual(["2026-12-05", "2026-12-15", "2026-12-26"]);
  });
  it("still places everything when there are more items than free days", () => {
    const short = december.slice(0, 3);
    const items = Array.from({ length: 5 }, (_, i) => ({ id: "x" + i, kind: "gpost" }));
    expect(Object.keys(spreadEvenly(short, [{ date: "2026-12-02", kind: "gpost" }], items))).toHaveLength(5);
  });
  it("returns nothing without days or items", () => {
    expect(spreadEvenly([], [], [{ id: "a", kind: "vid" }])).toEqual({});
    expect(spreadEvenly(december, [], [])).toEqual({});
  });
});

describe("interleave", () => {
  const make = (counts: Record<string, number>) => Object.entries(counts).flatMap(([kind, n]) => Array.from({ length: n }, (_, i) => ({ id: `${kind}-${i + 1}`, kind })));
  const kinds = (counts: Record<string, number>) => interleave(make(counts)).map((x) => x.kind[0]).join("");
  it("two posts, a video, two posts, a video, …", () => {
    expect(kinds({ gpost: 8, vid: 4 })).toBe("ggvggvggvggv");
    expect(kinds({ gpost: 6, vid: 3 })).toBe("ggvggvggv");
    expect(kinds({ gpost: 7, vid: 3 })).toBe("ggvggvggvg");
  });
  it("equal amounts alternate, posts first", () => {
    expect(kinds({ gpost: 5, vid: 5 })).toBe("gvgvgvgvgv");
    expect(kinds({ gpost: 1, vid: 1 })).toBe("gv");
  });
  it("starts with posts even when there are more videos", () => {
    expect(kinds({ gpost: 3, vid: 6 })).toBe("gvvgvvgvv");
  });
  it("a third kind follows the second", () => {
    expect(kinds({ gpost: 6, story: 3, vid: 3 })).toBe("ggsvggsvggsv");
  });
  it("keeps the order within each kind", () => {
    expect(interleave(make({ gpost: 4, vid: 2 })).map((x) => x.id)).toEqual(["gpost-1", "gpost-2", "vid-1", "gpost-3", "gpost-4", "vid-2"]);
  });
  it("one kind only, or nothing", () => {
    expect(kinds({ gpost: 3 })).toBe("ggg");
    expect(interleave([])).toEqual([]);
  });
});

describe("fillRhythm", () => {
  it("with nothing fixed it is the plain rhythm", () => {
    expect(fillRhythm(Array(6).fill(null), ["gpost", "gpost", "vid", "gpost", "gpost", "vid"]).join(",")).toBe("gpost,gpost,vid,gpost,gpost,vid");
  });
  it("fills around fixed ones", () => {
    const filled = fillRhythm([null, "vid", null, null, null, null], ["gpost", "gpost", "gpost", "gpost", "vid"]);
    expect(filled.join(",")).toBe("gpost,gpost,gpost,vid,gpost");
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
  it("runs across months: a gap between months is shown but not counted", () => {
    const r = rhythm(["2026-11-28", "2026-11-30", "2027-01-02", "2027-01-04", "2027-01-07"]);
    expect(r.steps.map((s) => [s.gap, s.sameMonth, s.longest])).toEqual([
      [null, false, false],
      [2, true, false],
      [33, false, false],
      [2, true, false],
      [3, true, true],
    ]);
    expect([r.shortest, r.longest]).toEqual([2, 3]);
  });
  it("marks nothing when all gaps are equal", () => {
    expect(rhythm(["2026-12-02", "2026-12-06", "2026-12-10"]).steps.some((s) => s.longest)).toBe(false);
  });
  it("shortens content IDs for the calendar", () => {
    expect(shortChip("thrive-gpost-nd26-12")).toBe("gpost-12");
    expect(shortChip("custom")).toBe("custom");
  });
});
