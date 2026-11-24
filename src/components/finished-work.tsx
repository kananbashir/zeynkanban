"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { deleteFinished, loadFinished, saveFinished, type FinishedView } from "@/app/actions/finished-work";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { linkSite } from "@/lib/brief-rules";
import { FINISHED_LIMITS } from "@/lib/finished-rules";
import { prefersReducedMotion, springOrFallback } from "@/lib/spring";
import { SiteBadge } from "./content-brief";
import { CloseButton, ConfirmDialog, Dialog } from "./dialog";
import { shrinkOut, useGrowIn } from "./list-motion";

type T = Dictionary["tasks"];
type F = T["finished"];

const CHECK = "M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3";

function Check({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d={CHECK} />
    </svg>
  );
}

/** The green "Finished work" tag after a card's content ID (next to the Brief tag); opens the links. */
export function FinishedTag({ f, onOpen }: { f: F; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} aria-label={f.tag} className="flex items-center gap-1.5 rounded-lg bg-leaf px-2 py-1 text-xs font-bold text-white">
      <Check />
      <span className="sm:hidden" aria-hidden="true">
        {f.tagShort}
      </span>
      <span className="hidden sm:inline" aria-hidden="true">
        {f.tag}
      </span>
    </button>
  );
}

/** The dashed "+ Add finished work" button on finished cards whose content ID has none yet. */
export function AddFinishedButton({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] border-dashed border-ink/35 bg-surface/50 px-3 text-[13px] font-semibold text-ink hover:bg-surface">
      <span aria-hidden="true" className="text-base leading-none">
        +
      </span>
      {label}
    </button>
  );
}

// ── Asking after "Done" ─────────────────────────────────────────────────────

/**
 * Tasks whose card should ask for the finished work. Kept outside the card because choosing a
 * finished status moves the card to another group (a new card), which must still ask. Expires.
 */
const asking = new Map<string, number>();
export const askForFinished = {
  start: (taskId: string) => asking.set(taskId, Date.now()),
  stop: (taskId: string) => asking.delete(taskId),
  has: (taskId: string) => (asking.get(taskId) ?? 0) > Date.now() - 120_000,
};

/**
 * The panel in a card just moved to a finished status: "Done! Add the finished work?" with named
 * links, Save and Not now. Saving puts it on the content ID, so every task of it shows the tag.
 */
export function FinishedAsk({ contentId, code, taskId, t, onClose, onError }: { contentId: string; code: string; taskId: string; t: T; onClose: () => void; onError?: (message: string) => void }) {
  const f = t.finished;
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => [blank()]);
  const [problem, setProblem] = useState<Problem>(null);
  const [pending, startTransition] = useTransition();
  const save = () =>
    startTransition(async () => {
      setProblem(null);
      const result = await saveFinished(contentId, rows.map(({ name, url }) => ({ name, url })), taskId);
      if (!result.ok) {
        if (result.error === "finishedEmpty" || result.error === "briefLinkInvalid") return setProblem({ error: errorText(f, result.error), key: rows[result.index ?? 0]?.key });
        return onError?.(result.error);
      }
      router.refresh();
      onClose();
    });
  return (
    <section aria-label={f.askTitle} className="flex flex-col gap-3 rounded-[18px] bg-surface p-3 sm:p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[11px] bg-leaf-tint text-leaf-ink">
          <Check size={18} />
        </span>
        <div className="flex min-w-0 flex-col">
          <b className="text-[14.5px] font-semibold">{f.askTitle}</b>
          <span className="text-[12.5px] text-muted">{fill(f.askText, { code })}</span>
        </div>
      </div>
      <LinksEditor rows={rows} setRows={setRows} problem={problem} clearProblem={() => setProblem(null)} f={f} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={onClose} className="min-h-11 rounded-full bg-mint px-4 text-[13px] font-semibold">
          {f.notNow}
        </button>
        <button type="button" disabled={pending} onClick={save} className="min-h-11 rounded-full bg-sun px-5 text-[13px] font-semibold text-ink disabled:opacity-60">
          {f.save}
        </button>
      </div>
    </section>
  );
}

// ── Link rows ───────────────────────────────────────────────────────────────

type Row = { key: string; name: string; url: string; fresh?: boolean };
type Problem = { error: string; key?: string } | null;
const newKey = () => `${Date.now()}${Math.random()}`;
const blank = (fresh = false): Row => ({ key: newKey(), name: "", url: "", fresh });
const errorText = (f: F, key: string) => (f.errors as Record<string, string>)[key] ?? f.errors.generic;

/** Named links being typed: each row is a name and a link; rows grow in and shrink away smoothly. */
function LinksEditor({ rows, setRows, problem, clearProblem, f }: { rows: Row[]; setRows: (update: (rows: Row[]) => Row[]) => void; problem: Problem; clearProblem: () => void; f: F }) {
  const focusNext = useRef<string | null>(null);
  useEffect(() => {
    if (!focusNext.current) return;
    // Only with a mouse: on a phone the keyboard would jump up on its own.
    if (window.matchMedia("(pointer: fine)").matches) document.querySelector<HTMLInputElement>(`[data-link-row="${focusNext.current}"] input`)?.focus();
    focusNext.current = null;
  }, [rows.length]);
  const update = (key: string, patch: Partial<Row>) => {
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    if (problem && (!problem.key || problem.key === key)) clearProblem();
  };
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <LinkRow
          key={row.key}
          row={row}
          n={i + 1}
          f={f}
          problem={problem?.key === row.key ? problem.error : null}
          canRemove={rows.length > 1}
          update={(patch) => update(row.key, patch)}
          onRemove={(el) => shrinkOut(el, () => setRows((list) => list.filter((r) => r.key !== row.key)))}
        />
      ))}
      {problem && !problem.key && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {problem.error}
        </p>
      )}
      {rows.length < FINISHED_LIMITS.links && (
        <button
          type="button"
          onClick={() => {
            const row = blank(true);
            focusNext.current = row.key;
            setRows((list) => [...list, row]);
          }}
          className="flex min-h-10 items-center gap-1.5 self-start rounded-full px-2 text-[13px] font-semibold text-teal-deep hover:bg-mint"
        >
          <span aria-hidden="true" className="text-base leading-none">
            +
          </span>
          {f.anotherLink}
        </button>
      )}
    </div>
  );
}

function LinkRow({ row, n, f, problem, canRemove, update, onRemove }: { row: Row; n: number; f: F; problem: string | null; canRemove: boolean; update: (patch: Partial<Row>) => void; onRemove: (el: HTMLElement | null) => void }) {
  const ref = useGrowIn<HTMLDivElement>(!!row.fresh);
  const field = `min-h-11 min-w-0 rounded-[14px] border-[1.5px] bg-surface px-3 text-sm ${problem ? "border-danger" : "border-line-strong"}`;
  return (
    <div ref={ref} data-link-row={row.key} className="flex flex-col gap-1.5 rounded-[14px]">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
          <input aria-label={fill(f.linkNameOf, { n })} placeholder={f.linkName} value={row.name} maxLength={FINISHED_LIMITS.name} onChange={(e) => update({ name: e.target.value })} className={`${field} sm:flex-1`} />
          <input
            aria-label={fill(f.linkUrlOf, { n })}
            placeholder={f.linkUrl}
            value={row.url}
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={FINISHED_LIMITS.url}
            aria-invalid={!!problem}
            onChange={(e) => update({ url: e.target.value })}
            className={`${field} sm:flex-[2]`}
          />
        </div>
        {canRemove && (
          <button
            type="button"
            aria-label={fill(f.removeLink, { n })}
            title={fill(f.removeLink, { n })}
            onClick={() => onRemove(ref.current)}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-mint text-icon hover:bg-teal-tint"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        )}
      </div>
      {problem && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {problem}
        </p>
      )}
    </div>
  );
}

// ── The window ──────────────────────────────────────────────────────────────

/** A small fade-up when the window's content arrives or switches between reading and editing. */
function popIn(el: HTMLElement | null) {
  if (el && !prefersReducedMotion()) el.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 380, easing: springOrFallback(420, 30, 0.38) });
}

/**
 * The finished work of a content ID in a window, above everything (also above a task window):
 * the links for everyone; Edit and Delete for admins, managers and whoever added it.
 */
export function FinishedWindow({ contentId, taskId, onClose, t }: { contentId: string; taskId?: string; onClose: () => void; t: T }) {
  const f = t.finished;
  const router = useRouter();
  const [data, setData] = useState<FinishedView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [problem, setProblem] = useState<Problem>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const body = useRef<HTMLDivElement>(null);
  const stopConfirming = useCallback(() => setConfirming(false), []);

  const edit = (view: FinishedView) => {
    setRows(view.links.length ? view.links.map((l) => ({ key: newKey(), ...l })) : [blank()]);
    setProblem(null);
    setEditing(true);
  };
  useEffect(() => {
    let alive = true;
    loadFinished(contentId).then((result) => {
      if (!alive) return;
      if (!result.ok) return setError(errorText(f, result.error));
      setData(result.finished);
      if (!result.finished.links.length && result.finished.canAdd) edit(result.finished);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId]);
  useLayoutEffect(() => popIn(body.current), [editing, !!data]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () =>
    startTransition(async () => {
      setProblem(null);
      const result = await saveFinished(contentId, rows.map(({ name, url }) => ({ name, url })), taskId);
      if (!result.ok) {
        if (result.error === "finishedEmpty" || result.error === "briefLinkInvalid") return setProblem({ error: errorText(f, result.error), key: rows[result.index ?? 0]?.key });
        return setProblem({ error: errorText(f, result.error) });
      }
      router.refresh();
      const fresh = await loadFinished(contentId);
      if (fresh.ok) setData(fresh.finished);
      setEditing(false);
    });
  const remove = () =>
    startTransition(async () => {
      const result = await deleteFinished(contentId);
      if (!result.ok) {
        setConfirming(false);
        return setError(errorText(f, result.error));
      }
      router.refresh();
      onClose();
    });

  const isNew = !!data && !data.links.length;
  const shared = data && data.taskCount > 0 ? (data.taskCount === 1 ? f.shared1 : fill(f.sharedN, { n: data.taskCount })) : "";
  const window = (
    <Dialog label={data ? `${f.title} · ${data.code}` : f.title} onClose={onClose}>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-leaf-ink">{f.title}</span>
          <h2 className="break-all font-mono text-xl font-semibold sm:text-2xl">{data?.code ?? "…"}</h2>
          {data && (
            <span className="text-[13px] text-ink-soft">
              {data.customer} · {data.typeName}
              {shared ? ` · ${shared}` : ""}
            </span>
          )}
        </div>
        <CloseButton label={f.close} onClick={onClose} />
      </div>
      <div ref={body} className="flex flex-col gap-3">
        {!data && !error && <p className="py-6 text-center text-sm text-muted">{f.loading}</p>}
        {!data && error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
        {data && editing && (
          <>
            <div className="rounded-[20px] bg-surface p-3 sm:p-3.5">
              <LinksEditor rows={rows} setRows={setRows} problem={problem} clearProblem={() => setProblem(null)} f={f} />
            </div>
            <p className="text-[12.5px] text-muted">{f.notifyHint}</p>
            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <button type="button" onClick={() => (isNew ? onClose() : setEditing(false))} className="min-h-12 rounded-full bg-surface px-5 text-[15px] font-semibold">
                {f.cancel}
              </button>
              <button type="button" disabled={pending} onClick={save} className="min-h-12 rounded-full bg-sun px-6 text-[15px] font-semibold text-ink disabled:opacity-60">
                {f.save}
              </button>
            </div>
          </>
        )}
        {data && !editing && (
          <>
            {data.links.length > 0 && (
              <div className="flex flex-col gap-2 rounded-[20px] bg-surface p-3">
                {data.links.map((l, i) => {
                  const site = linkSite(l.url);
                  return (
                    <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-[14px] border border-line bg-mint-soft px-3 py-2.5 hover:bg-mint">
                      <SiteBadge kind={site.kind} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold text-ink">{l.name}</span>
                        <span className="truncate text-xs text-muted">{site.host}</span>
                      </span>
                      <span className="shrink-0 text-[13px] font-semibold text-teal-deep">
                        {f.open} <span aria-hidden="true">↗</span>
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
            {(data.createdBy || data.updatedBy) && (
              <p className="text-[12.5px] text-muted">
                {[data.createdBy && fill(f.added, { name: data.createdBy, when: data.createdOn ?? "" }), data.updatedBy && fill(f.edited, { name: data.updatedBy, when: data.updatedOn ?? "" })].filter(Boolean).join(" · ")}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2.5">
              {data.canEdit && (
                <button type="button" onClick={() => setConfirming(true)} className="min-h-12 rounded-full bg-surface px-5 text-[15px] font-semibold text-danger">
                  {f.delete}
                </button>
              )}
              <span className="flex-1" />
              <button type="button" onClick={onClose} className="min-h-12 rounded-full bg-surface px-5 text-[15px] font-semibold">
                {f.close}
              </button>
              {(data.canEdit || data.canAdd) && (
                <button type="button" onClick={() => edit(data)} className="min-h-12 rounded-full bg-sun px-6 text-[15px] font-semibold text-ink">
                  {data.links.length ? f.edit : f.add}
                </button>
              )}
            </div>
          </>
        )}
      </div>
      {confirming && data && (
        <ConfirmDialog title={f.deleteTitle} text={fill(f.deleteText, { code: data.code })} confirmLabel={f.delete} cancelLabel={f.cancel} pending={pending} onCancel={stopConfirming} onConfirm={remove} />
      )}
    </Dialog>
  );
  return typeof document === "undefined" ? null : createPortal(window, document.body);
}
