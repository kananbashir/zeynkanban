// One colour per content type, in the order the types are listed in Settings (videos, posts, reels, …).
// Shared by the month planner and the task filters, so a type looks the same everywhere.
export const TYPE_COLORS = ["var(--color-status-purple)", "var(--color-status-blue)", "var(--color-status-amber)", "var(--color-status-teal)", "#c2410c", "#4e6b1f"];

export function typeColor(code: string, types: readonly { code: string }[]): string {
  const i = types.findIndex((x) => x.code === code);
  return i < 0 ? "var(--color-subtle)" : TYPE_COLORS[i % TYPE_COLORS.length];
}
