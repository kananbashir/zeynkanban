"use server";

import type { StatusOption } from "@/components/task-card";
import type { ErrorKey } from "@/i18n/dictionaries";
import { requireUser } from "@/lib/auth";
import { todayIso } from "@/lib/dates";
import { liveStatuses, taskById, type TaskView } from "@/lib/tasks";

/**
 * One task for the "view task" window (opened from a notification). Admins and managers can see any
 * task; an employee only tasks assigned to them.
 */
export async function peekTask(
  id: string,
): Promise<{ ok: true; task: TaskView; statuses: StatusOption[]; today: string; editHref: string | null; canChangeStatus: boolean } | { ok: false; error: ErrorKey }> {
  const me = await requireUser();
  const task = await taskById(String(id));
  const staff = me.role !== "employee";
  if (!task || (!staff && task.assigneeId !== me.id)) return { ok: false, error: "taskGone" };
  return {
    ok: true,
    task,
    statuses: await liveStatuses(),
    today: todayIso(),
    editHref: staff ? `/customers/${task.customerId}?tab=tasks&date=${task.dueDate}&edit=${task.id}` : null,
    canChangeStatus: !task.archived && (staff || task.assigneeId === me.id),
  };
}
