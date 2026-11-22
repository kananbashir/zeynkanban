import { describe, expect, it } from "vitest";
import { dictionaries } from "@/i18n/dictionaries";
import { notificationText, notificationTime } from "./notification-text";

const en = dictionaries.en;
const ref = { taskId: "t1", type: "Video edit", code: "thrive-vid-nd26-3", customer: "Thrive", customerId: "c1", due: "2026-11-22" };
const text = (d: Parameters<typeof notificationText>[0], staff = false) => notificationText(d, staff, "2026-11-22", en.notifications, en.tasks);

describe("notificationText", () => {
  it("assigned, due today", () => {
    const x = text({ kind: "assigned", by: "Aysel", ...ref });
    expect([x.title, x.a, x.b, x.href, x.taskId, x.notes]).toEqual(["New task assigned to you", "Video edit · thrive-vid-nd26-3 · Thrive", "By Aysel · due today", "/my-tasks?task=t1", "t1", false]);
  });
  it("task notifications open the task window; notes open its notes", () => {
    expect(text({ kind: "review", by: "Murad", ...ref }, true).href).toBe("/board?task=t1");
    const note = text({ kind: "note", by: "Murad", body: "Done", ...ref }, true);
    expect([note.href, note.notes]).toEqual(["/board?task=t1&notes=1", true]);
    expect(text({ kind: "moved", to: "Tural", ...ref }).taskId).toBeUndefined(); // an employee no longer has it
  });
  it("lists what changed", () => {
    expect(text({ kind: "changed", dateFrom: "2026-11-19", dateTo: "2026-11-20", note: "Shoot before 10:00", ...ref }).b).toBe("Deadline moved from 19 Nov to 20 Nov · Note: “Shoot before 10:00”");
    expect(text({ kind: "changed", description: true, note: "", ...ref }).b).toBe("Description changed · Note removed");
  });
  it("moved to someone else or to the drafts", () => {
    expect(text({ kind: "moved", to: "Tural", ...ref }).b).toBe("Now with Tural");
    expect(text({ kind: "moved", to: null, ...ref }).b).toBe("Now without an assignee");
  });
  it("morning summaries", () => {
    const staff = text({ kind: "summary", scope: "staff", date: "2026-11-22", tasks: 9, customers: 4, overdue: 2, drafts: 7 }, true);
    expect([staff.a, staff.b]).toEqual(["9 tasks today across 4 customers, 2 overdue.", "7 drafts are waiting for an assignee"]);
    expect(text({ kind: "summary", scope: "own", date: "2026-11-22", tasks: 1, customers: 1, overdue: 0, drafts: 0 }).a).toBe("You have 1 task today and 0 overdue.");
  });
  it("status changes and reminders", () => {
    const x = text({ kind: "status", from: "In progress", to: "Done", by: "Murad", ...ref }, true);
    expect([x.title, x.b]).toEqual(["Status changed", "In progress → Done · Murad"]);
    expect(text({ kind: "reminder", ...ref }).b).toBe("Due today");
    expect(text({ kind: "reminder", ...ref, due: "2026-11-23" }).b).toBe("Due tomorrow");
    expect(text({ kind: "reminder", ...ref, due: "2026-11-25" }).b).toBe("Due in 3 days · 25 Nov");
  });
  it("Azerbaijani", () => {
    const x = notificationText({ kind: "overdueMany", count: 5 }, true, "2026-11-22", dictionaries.az.notifications, dictionaries.az.tasks);
    expect(x.title).toBe("5 tapşırığın vaxtı keçdi");
  });
});

describe("notificationTime", () => {
  const now = new Date("2026-11-22T10:00:00Z"); // 14:00 in Baku
  const at = (iso: string) => notificationTime(new Date(iso), now, en.notifications, en.tasks);
  it("relative, clock, weekday, date", () => {
    expect(at("2026-11-22T09:59:40Z")).toBe("now");
    expect(at("2026-11-22T09:50:00Z")).toBe("10 min");
    expect(at("2026-11-22T05:00:00Z")).toBe("09:00");
    expect(at("2026-11-19T13:20:00Z")).toBe("Th 17:20");
    expect(at("2026-11-01T08:00:00Z")).toBe("1 Nov");
  });
});
