import { describe, expect, it } from "vitest";
import { chartTop, mondayOf, percent, periodOf, shiftPeriod, summarize, type CountRow } from "./dashboard-rules";

describe("periods", () => {
  it("weeks run Monday to Sunday", () => {
    expect(mondayOf("2026-11-22")).toBe("2026-11-16"); // a Sunday
    expect(mondayOf("2026-11-16")).toBe("2026-11-16");
    const w = periodOf("week", "2026-12-31");
    expect([w.from, w.to, w.days.length]).toEqual(["2026-12-28", "2027-01-03", 7]);
  });
  it("months cover every day", () => {
    expect(periodOf("month", "2026-11-22").days.length).toBe(30);
    expect(periodOf("month", "2028-02-10").to).toBe("2028-02-29");
  });
  it("shifts across years", () => {
    expect(shiftPeriod(periodOf("month", "2026-12-05"), 1).from).toBe("2027-01-01");
    expect(shiftPeriod(periodOf("week", "2027-01-01"), -1).from).toBe("2026-12-21");
  });
});

describe("summarize", () => {
  const row = (o: Partial<CountRow>): CountRow => ({ dueDate: "2026-11-20", assigneeId: "a", customerId: "c1", statusId: "todo", contentTypeId: "vid", finished: false, ...o });
  const s = summarize(
    [
      row({}),
      row({ finished: true, statusId: "done" }),
      row({ dueDate: "2026-11-25", assigneeId: "b", customerId: "c2", contentTypeId: "gpost" }),
      row({ assigneeId: null }),
    ],
    "2026-11-22",
  );
  it("counts assigned tasks and drafts apart", () => {
    expect([s.total, s.finished, s.drafts]).toEqual([3, 1, 1]);
  });
  it("overdue means unfinished before today", () => {
    expect(s.overdue).toBe(1);
  });
  it("groups by day, person, customer, status and content type", () => {
    expect(s.perDay["2026-11-20"]).toEqual({ total: 2, finished: 1 });
    expect(s.byPerson.b).toEqual({ total: 1, finished: 0 });
    expect(s.byCustomer.c1).toEqual({ total: 2, finished: 1 });
    expect(s.byStatus).toEqual({ todo: 2, done: 1 });
    expect(s.byContentType.gpost.total).toBe(1);
  });
});

describe("helpers", () => {
  it("rounds the chart top so its half is whole", () => {
    expect(chartTop([])).toBe(4);
    expect(chartTop([5])).toBe(6);
    expect(chartTop([3, 11])).toBe(20);
  });
  it("percent", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(1, 0)).toBe(0);
  });
});
