import { describe, expect, it } from "vitest";
import { addDays, daysBetween, monthGrid, specialDaysOn, weekdayIndex, dateInZone, isIsoDateString } from "./dates";
import { cardBackground, countPerDay, deadlineState, FINISHED_BACKGROUND, groupByPerson, onDay, personalShownOn, sectionFor, spanOf, taskEnd } from "./task-rules";

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
  it("shows a task with a deadline on every day up to it, then as overdue", () => {
    // Created for 23 Nov, deadline 26 Nov (the example from the team).
    const task = { dueDate: "2026-11-23", deadline: "2026-11-26", finished: false, finishedOn: null };
    expect(sectionFor(task, "2026-11-22", "2026-11-22")).toBeNull();
    for (const day of ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26"]) expect(sectionFor(task, day, "2026-11-23")).toBe("due");
    expect(sectionFor(task, "2026-11-26", "2026-11-26")).toBe("due"); // the deadline itself is not late yet
    expect(sectionFor(task, "2026-11-27", "2026-11-26")).toBeNull();
    expect(sectionFor(task, "2026-11-27", "2026-11-27")).toBe("overdue");
    expect(sectionFor(task, "2026-11-25", "2026-11-27")).toBe("due"); // looking back at a day it spanned
  });
  it("shows a finished task with a deadline only on the day it was finished", () => {
    const task = { dueDate: "2026-11-23", deadline: "2026-11-26", finished: true, finishedOn: "2026-11-24" };
    expect(sectionFor(task, "2026-11-24", "2026-11-25")).toBe("finished");
    expect(sectionFor(task, "2026-11-25", "2026-11-25")).toBeNull();
    expect(sectionFor({ ...task, finishedOn: null }, "2026-11-26", "2026-11-27")).toBe("finished");
  });
  it("shows a cancelled task only on the day it was cancelled, never as overdue", () => {
    const task = { dueDate: "2026-11-18", finished: false, finishedOn: "2026-11-19", cancelled: true };
    expect(sectionFor(task, "2026-11-19", today)).toBe("cancelled");
    expect(sectionFor(task, "2026-11-18", today)).toBeNull();
    expect(sectionFor(task, today, today)).toBeNull();
  });
  it("shows a postponed task only on the day it was postponed, never as overdue", () => {
    const task = { dueDate: "2026-11-18", deadline: "2026-11-25", finished: false, finishedOn: null, postponed: true, postponedOn: "2026-11-19" };
    expect(sectionFor(task, "2026-11-19", today)).toBe("postponed");
    expect(sectionFor(task, "2026-11-18", today)).toBe(null);
    expect(sectionFor(task, "2026-11-20", today)).toBe(null);
    expect(sectionFor(task, today, today)).toBe(null);
    // Without the day it was postponed (older data): its last day.
    expect(sectionFor({ ...task, postponedOn: null }, "2026-11-25", today)).toBe("postponed");
  });
  it("ignores a deadline that isn't after the task's day", () => {
    expect(taskEnd({ dueDate: "2026-11-23", deadline: null })).toBe("2026-11-23");
    expect(taskEnd({ dueDate: "2026-11-23", deadline: "2026-11-20" })).toBe("2026-11-23");
    expect(taskEnd({ dueDate: "2026-11-23", deadline: "2026-11-26" })).toBe("2026-11-26");
  });
  it("works out the timeline strip: before, during, last day, late, finished", () => {
    const task = { dueDate: "2026-11-22", deadline: "2026-11-24", finished: false, finishedOn: null };
    const at = (today: string, t = task) => deadlineState(t, today, daysBetween);
    expect(at("2026-11-20")).toEqual({ kind: "upcoming", n: 2, progress: 0 });
    expect(at("2026-11-22")).toEqual({ kind: "running", n: 2, progress: 0 });
    expect(at("2026-11-23")).toEqual({ kind: "running", n: 1, progress: 0.5 });
    expect(at("2026-11-24")).toEqual({ kind: "lastDay", n: 0, progress: 1 });
    expect(at("2026-11-26")).toEqual({ kind: "late", n: 2, progress: 1 });
    expect(at("2026-11-30", { ...task, finished: true, finishedOn: "2026-11-23" })).toMatchObject({ kind: "done", how: "early", n: 1 });
    expect(at("2026-11-30", { ...task, finished: true, finishedOn: "2026-11-24" })).toMatchObject({ kind: "done", how: "onTime" });
    expect(at("2026-11-30", { ...task, finished: true, finishedOn: "2026-11-27" })).toMatchObject({ kind: "done", how: "late", n: 3 });
  });
  it("counts a task on every day it spans, within the range asked for", () => {
    const counts = countPerDay([{ dueDate: "2026-11-23", deadline: "2026-11-26" }, { dueDate: "2026-11-24" }, { dueDate: "2026-10-30", deadline: "2026-11-02" }], "2026-11-01", "2026-11-25", addDays);
    expect(counts).toEqual({ "2026-11-01": 1, "2026-11-02": 1, "2026-11-23": 1, "2026-11-24": 2, "2026-11-25": 1 });
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

describe("closed tasks on the calendar and day lists", () => {
  const add = (iso: string, n: number) => {
    const d = new Date(iso + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  it("a cancelled or finished task counts only on the day it was closed, not every day to its deadline", () => {
    const counts = countPerDay(
      [
        { dueDate: "2026-11-24", deadline: "2026-11-26", closed: true, closedOn: "2026-11-25" },
        { dueDate: "2026-11-24", deadline: "2026-11-26" },
        { dueDate: "2026-11-10", closed: true, closedOn: "2026-11-25" },
      ],
      "2026-11-20",
      "2026-11-30",
      add,
    );
    expect(counts).toEqual({ "2026-11-24": 1, "2026-11-25": 3, "2026-11-26": 1 });
  });
  it("onDay matches the day views", () => {
    const cancelled = { dueDate: "2026-11-24", deadline: "2026-11-26", closed: true, closedOn: "2026-11-25" };
    expect(["2026-11-24", "2026-11-25", "2026-11-26"].map((d) => onDay(cancelled, d))).toEqual([false, true, false]);
    expect(onDay({ dueDate: "2026-11-24", deadline: "2026-11-26" }, "2026-11-26")).toBe(true);
    expect(onDay({ dueDate: "2026-11-24", closed: true, closedOn: null }, "2026-11-24")).toBe(true);
  });
});

describe("postponed tasks on the calendar", () => {
  it("count only on the day they were postponed", () => {
    const add = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
    const span = spanOf({ dueDate: "2026-11-24", deadline: "2026-11-27", finished: false, finishedOn: null, postponed: true, postponedOn: "2026-11-25" });
    expect(countPerDay([span], "2026-11-20", "2026-11-30", add)).toEqual({ "2026-11-25": 1 });
  });
});
