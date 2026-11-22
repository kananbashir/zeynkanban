import { describe, expect, it } from "vitest";
import { cleanReminder, reminderState } from "./reminder-rules";

describe("cleanReminder", () => {
  it("accepts 1, 3 or 5 days and a time", () => {
    expect(cleanReminder(3, "14:30")).toEqual({ days: 3, time: "14:30" });
    expect(cleanReminder("1", "")).toEqual({ days: 1, time: "09:00" });
  });
  it("anything else means no reminder", () => {
    expect(cleanReminder(null, "09:00")).toEqual({ days: null, time: null });
    expect(cleanReminder(2, "09:00")).toEqual({ days: null, time: null });
    expect(cleanReminder(3, "25:00")).toEqual({ days: 3, time: "09:00" });
  });
});

describe("reminderState", () => {
  const task = { dueDate: "2026-11-25", remindDays: 3, remindTime: "10:00" };
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
