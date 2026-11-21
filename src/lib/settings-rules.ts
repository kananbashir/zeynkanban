// Pure rules for Settings, kept apart from the database so they can be tested on their own.

/** Status colours. Checked to stay distinguishable for colour-blind readers when shown with their names. */
export const STATUS_COLORS = ["#b04fb8", "#2a7de1", "#c47a00", "#0c9b8d", "#d6456b", "#7a8f1e"] as const;
export type StatusColor = (typeof STATUS_COLORS)[number];
export const COLOR_NAMES = ["purple", "blue", "amber", "teal", "rose", "olive"] as const;

export const NAME_MAX = 60;

export type NameResult = { ok: true; value: string } | { ok: false; error: "nameRequired" | "nameTooLong" };

/** Trims a name and squeezes repeated spaces. */
export function cleanName(input: unknown, max = NAME_MAX): NameResult {
  const value = String(input ?? "").replace(/\s+/g, " ").trim();
  if (!value) return { ok: false, error: "nameRequired" };
  if (value.length > max) return { ok: false, error: "nameTooLong" };
  return { ok: true, value };
}

/** Content type codes go inside content IDs, between hyphens, so they are lowercase letters and digits only. */
export function cleanContentCode(input: unknown): string | null {
  const value = String(input ?? "").trim().toLowerCase();
  return /^[a-z][a-z0-9]{0,9}$/.test(value) ? value : null;
}

export function isIsoDate(input: unknown): input is string {
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;
  const [y, m, d] = input.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isStatusColor(input: unknown): input is StatusColor {
  return (STATUS_COLORS as readonly string[]).includes(String(input));
}

/** The colour a new status gets: the first one not yet used, or the next in turn. */
export function nextStatusColor(used: string[]): StatusColor {
  return STATUS_COLORS.find((c) => !used.includes(c)) ?? STATUS_COLORS[used.length % STATUS_COLORS.length];
}

type StatusLike = { id: string; isFinished: boolean };

/** At least one status must remain, and at least one must count as finished. */
export function statusDeleteProblem(live: StatusLike[], id: string): "lastStatus" | "lastFinished" | null {
  const target = live.find((s) => s.id === id);
  if (!target) return null;
  if (live.length <= 1) return "lastStatus";
  if (target.isFinished && live.filter((s) => s.isFinished).length <= 1) return "lastFinished";
  return null;
}

export function unfinishProblem(live: StatusLike[], id: string): "lastFinished" | null {
  const finished = live.filter((s) => s.isFinished);
  return finished.length === 1 && finished[0].id === id ? "lastFinished" : null;
}

/** A reorder request must name every current item exactly once. */
export function isSameSet(current: string[], proposed: unknown): proposed is string[] {
  if (!Array.isArray(proposed) || proposed.length !== current.length) return false;
  const set = new Set(proposed.map(String));
  return set.size === current.length && current.every((id) => set.has(id));
}
