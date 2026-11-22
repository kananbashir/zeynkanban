import { describe, expect, it } from "vitest";
import { cleanPersonalTiming, cleanReminders, personalMoment, personalState, reminderState } from "./reminder-rules";

describe("cleanReminders", () => {
  it("accepts any of 1, 3 and 5 days, with a time", () => {
    expect(cleanReminders([3, 1], "14:30")).toEqual({ days: [1, 3], time: "14:30" });
    expect(cleanReminders(["5", 5, 1], "")).toEqual({ days: [1, 5], time: "09:00" });
  });
  it("anything else means no reminder", () => {
    expect(cleanReminders([], "09:00")).toEqual({ days: [], time: null });
    expect(cleanReminders([2, 7], "09:00")).toEqual({ days: [], time: null });
    expect(cleanReminders(null, "09:00")).toEqual({ days: [], time: null });
    expect(cleanReminders([3], "25:00")).toEqual({ days: [3], time: "09:00" });
  });
});

describe("reminderState", () => {
  const task = { dueDate: "2026-11-25", daysBefore: 3, remindTime: "10:00" };
  it("waits until the day and time", () => {
    expect(reminderState(task, "2026-11-21", "23:00")).toBe("wait");
    expect(reminderState(task, "2026-11-22", "09:59")).toBe("wait");
  });
  it("sends from that moment on, even late", () => {
    expect(reminderState(task, "2026-11-22", "10:00")).toBe("send");
    expect(reminderState(task, "2026-11-24", "08:00")).toBe("send");
    expect(reminderState(task, "2026-11-25", "08:00")).toBe("send");
  });
  it("is dropped once the due date has passed", () => {
    expect(reminderState(task, "2026-11-26", "08:00")).toBe("missed");
  });
});

describe("personal reminders", () => {
  it("keeps a valid time and the allowed choices", () => {
    expect(cleanPersonalTiming("14:30", [60, 0, 7, 60])).toEqual({ time: "14:30", reminders: [0, 60] });
    expect(cleanPersonalTiming("", [1440])).toEqual({ time: null, reminders: [1440] });
  });
  it("counts back from the time, or from 09:00", () => {
    expect(personalMoment("2026-11-25", "14:30", 15)).toBe("2026-11-25 14:15");
    expect(personalMoment("2026-11-25", "00:30", 60)).toBe("2026-11-24 23:30");
    expect(personalMoment("2026-11-25", null, 1440)).toBe("2026-11-24 09:00");
  });
  it("sends from its moment, not after the day has long passed", () => {
    expect(personalState("2026-11-25", "14:30", 60, "2026-11-25 13:29")).toBe("wait");
    expect(personalState("2026-11-25", "14:30", 60, "2026-11-25 13:30")).toBe("send");
    expect(personalState("2026-11-25", "14:30", 0, "2026-11-26 10:00")).toBe("send");
    expect(personalState("2026-11-25", "14:30", 0, "2026-11-26 15:00")).toBe("missed");
  });
});
