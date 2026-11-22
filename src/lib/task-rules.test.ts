import { describe, expect, it } from "vitest";
import { addDays, daysBetween, monthGrid, specialDaysOn, weekdayIndex, dateInZone, isIsoDateString } from "./dates";
import { cardBackground, FINISHED_BACKGROUND, groupByPerson, personalShownOn, sectionFor } from "./task-rules";

const today = "2026-11-20";

describe("day sections", () => {
  it("shows unfinished tasks on their due day", () => {
    expect(sectionFor({ dueDate: today, finished: false, finishedOn: null }, today, today)).toBe("due");
    expect(sectionFor({ dueDate: "2026-11-23", finished: false, finishedOn: null }, "2026-11-23", today)).toBe("due");
  });
  it("keeps earlier unfinished tasks on today as overdue, and only on today", () => {
    expect(sectionFor({ dueDate: "2026-11-18", finished: false, finishedOn: null }, today, today)).toBe("overdue");
    expect(sectionFor({ dueDate: "2026-11-18", finished: false, finishedOn: null }, "2026-11-19", today)).toBeNull();
  });
  it("shows finished tasks on the day they were finished", () => {
    expect(sectionFor({ dueDate: "2026-11-18", finished: true, finishedOn: today }, today, today)).toBe("finished");
    expect(sectionFor({ dueDate: "2026-11-18", finished: true, finishedOn: today }, "2026-11-18", today)).toBeNull();
    expect(sectionFor({ dueDate: "2026-11-18", finished: true, finishedOn: null }, "2026-11-18", today)).toBe("finished");
  });
  it("uses the neutral background for finished tasks", () => {
    expect(cardBackground("#2a7de1", true)).toBe(FINISHED_BACKGROUND);
    expect(cardBackground("#2A7DE1", false)).toBe("#c6e9f7");
  });
});

describe("dates", () => {
  it("adds days across months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-11-18", "2026-11-20")).toBe(2);
  });
  it("builds Monday-first month grids of whole weeks", () => {
    const nov = monthGrid(2026, 11);
    expect(weekdayIndex("2026-11-01")).toBe(6); // a Sunday
    expect(nov[0].iso).toBe("2026-10-26");
    expect(nov.length).toBe(42);
    expect(nov.filter((c) => c.inMonth).length).toBe(30);
    expect(monthGrid(2027, 2).length).toBe(35); // February 2027 starts on a Monday
  });
  it("matches yearly holidays in any year", () => {
    const days = [
      { date: "2025-11-08", name: "Victory Day", kind: "holiday" as const, yearly: true },
      { date: "2026-11-27", name: "Black Friday", kind: "event" as const, yearly: false },
    ];
    expect(specialDaysOn("2026-11-08", days).map((d) => d.name)).toEqual(["Victory Day"]);
    expect(specialDaysOn("2027-11-27", days)).toEqual([]);
  });
  it("takes today in Baku time", () => {
    expect(dateInZone(new Date("2026-11-20T21:30:00Z"), "Asia/Baku")).toBe("2026-11-21"); // 01:30 in Baku
    expect(dateInZone(new Date("2026-11-20T19:30:00Z"), "Asia/Baku")).toBe("2026-11-20");
  });
  it("validates dates", () => {
    expect(isIsoDateString("2026-02-29")).toBe(false);
    expect(isIsoDateString("2028-02-29")).toBe(true);
  });
});

describe("personalShownOn", () => {
  const today = "2026-11-22";
  it("shows on its own day", () => {
    expect(personalShownOn({ dueDate: "2026-11-25", done: false }, "2026-11-25", today)).toBe(true);
    expect(personalShownOn({ dueDate: "2026-11-25", done: false }, "2026-11-24", today)).toBe(false);
  });
  it("carries unfinished earlier ones into today only", () => {
    expect(personalShownOn({ dueDate: "2026-11-18", done: false }, today, today)).toBe(true);
    expect(personalShownOn({ dueDate: "2026-11-18", done: true }, today, today)).toBe(false);
    expect(personalShownOn({ dueDate: "2026-11-18", done: false }, "2026-11-21", today)).toBe(false);
  });
});

describe("groupByPerson", () => {
  it("lists a shared task under each person, drafts last", () => {
    const a = { id: "a", name: "Aysel" }, m = { id: "m", name: "Murad" };
    const groups = groupByPerson([
      { n: 1, assignees: [a, m] },
      { n: 2, assignees: [m] },
      { n: 3, assignees: [] },
    ]);
    expect(groups.map((g) => [g.id, g.list.map((x) => x.n)])).toEqual([
      ["m", [1, 2]],
      ["a", [1]],
      ["", [3]],
    ]);
  });
});
