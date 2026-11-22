"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { peekTask } from "@/app/actions/peek";
import type { Dictionary, ErrorKey } from "@/i18n/dictionaries";
import { CloseButton, Dialog } from "./dialog";
import { TaskCard } from "./task-card";
import { Toast, useToast } from "./toast";

type Peek = Extract<Awaited<ReturnType<typeof peekTask>>, { ok: true }>;

/**
 * A window showing one task over whatever page is open, when the address has ?task=<id>
 * (notifications link here; &notes=1 opens the task's notes). Closing it leaves the page as it was.
 */
export function TaskPeek({ t, errors }: { t: Dictionary["tasks"]; errors: Dictionary["errors"] }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const id = params.get("task");
  const withNotes = params.get("notes") === "1";
  const opened = params.get("n") ?? ""; // which notification opened it: a new click loads the task afresh
  const [data, setData] = useState<{ id: string; peek: Peek | null; error: string | null } | null>(null);
  const { message, show } = useToast();

  const toData = useCallback(
    (taskId: string, result: Awaited<ReturnType<typeof peekTask>>) => ({ id: taskId, peek: result.ok ? result : null, error: result.ok ? null : errors[result.error] }),
    [errors],
  );
  const load = async (taskId: string) => setData(toData(taskId, await peekTask(taskId)));

  useEffect(() => {
    if (!id) return;
    let alive = true;
    peekTask(id).then((result) => alive && setData(toData(id, result)));
    return () => {
      alive = false;
    };
  }, [id, opened, toData]);

  const close = () => {
    const next = new URLSearchParams(params.toString());
    next.delete("task");
    next.delete("notes");
    next.delete("n");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  if (!id) return null;
  const current = data && data.id === id ? data : null;
  return (
    <>
      <Dialog label={t.peek.title} onClose={close}>
        <div className="flex items-center gap-3">
          <h2 className="flex-1 text-xl font-semibold">{t.peek.title}</h2>
          <CloseButton label={t.form.close} onClick={close} />
        </div>
        {!current ? (
          <div className="h-[180px] animate-pulse rounded-[22px] bg-surface/70" />
        ) : current.peek ? (
          <div className="zk-fade-up flex flex-col gap-3">
            <TaskCard
              key={`${current.peek.task.id}-${opened}`}
              task={current.peek.task}
              statuses={current.peek.statuses}
              canChangeStatus={current.peek.canChangeStatus}
              today={current.peek.today}
              t={t}
              editHref={current.peek.editHref ?? undefined}
              notesInitiallyOpen={withNotes}
              onError={(key) => show(errors[key as ErrorKey] ?? errors.generic, "error")}
              onChanged={() => load(id)}
            />
            {!current.peek.editHref && (
              <Link href={`/my-tasks?date=${current.peek.task.dueDate}`} onClick={close} className="self-start rounded-full bg-surface px-4 py-2.5 text-sm font-semibold">
                {t.peek.showDay}
              </Link>
            )}
          </div>
        ) : (
          <p className="rounded-[22px] bg-surface px-4 py-8 text-center text-sm text-ink-soft">{current.error}</p>
        )}
      </Dialog>
      <Toast message={message} />
    </>
  );
}
