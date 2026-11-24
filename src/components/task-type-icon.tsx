import { DEFAULT_TASK_ICON, isTaskIcon, TASK_ICONS } from "@/lib/task-icons";

/** A task type's icon (a line drawing in the current text colour). Unknown names show the default. */
export function TaskTypeIcon({ name, size = 18, className = "" }: { name: string | null | undefined; size?: number; className?: string }) {
  const d = TASK_ICONS[isTaskIcon(name) ? name : DEFAULT_TASK_ICON];
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d={d} />
    </svg>
  );
}
