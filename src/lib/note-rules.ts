// Notes on tasks. Pure rules, shared by the server actions and the task card.
export const MAX_NOTES = 10;
export const NOTE_LENGTH = 500;

export function cleanNote(body: unknown): string {
  return String(body ?? "").replace(/\r\n/g, "\n").trim().slice(0, NOTE_LENGTH);
}

/** Who can read and add notes: admins and managers on any task, an employee on tasks assigned to them. */
export function canUseNotes(user: { id: string; role: string }, task: { assigneeId: string | null }): boolean {
  return user.role !== "employee" || task.assigneeId === user.id;
}
