"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { deleteBankBrief, duplicateBankBrief, saveBankBrief } from "@/app/actions/bank";
import type { BriefView } from "@/app/actions/briefs";
import { personColor } from "@/components/avatar-group";
import { BriefEditor, BriefReader, WithCode } from "@/components/content-brief";
import { TaskSearch, useFitHeight, useScrolledEdge } from "@/components/day-filters";
import { CloseButton, ConfirmDialog, Dialog } from "@/components/dialog";
import { FILTER_ICONS } from "@/components/filter-bar";
import { DuplicateIcon, Icon } from "@/components/icons";
import { shrinkOut } from "@/components/list-motion";
import { Collapse, SegmentedControl, useFlip, useIsWide } from "@/components/motion";
import { Sheet, useSheetClose } from "@/components/sheet";
import { Toast, useToast } from "@/components/toast";
import { initials } from "@/components/top-bar";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { BANK_TITLE_LIMIT, copyTitle, findBriefs, type BankStatus } from "@/lib/bank-rules";
import type { BriefField } from "@/lib/brief-rules";
import { prefersReducedMotion, springOrFallback } from "@/lib/spring";

type T = Dictionary["bank"];
type TasksT = Dictionary["tasks"];
type Customer = { id: string; name: string; color: string };
export type BankCard = { id: string; customerId: string; title: string; fields: BriefField[]; byId: string; by: string; on: string; usedFor: string | null };

const pop = (el: HTMLElement | null, from = "translateY(10px) scale(0.98)") => {
  if (el && !prefersReducedMotion()) el.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }], { duration: 420, easing: springOrFallback(420, 30, 0.42) });
};

/**
 * The Content bank: customers on the left (a dropdown on phones), the briefs of the chosen one on
 * the right with search and a status filter. On a computer the page fits the screen and only the
 * cards scroll. Each card can be edited, duplicated (under a new title, unused) or deleted.
 */
export function BankView({
  customers,
  briefs,
  start,
  staff,
  template,
  t,
  tasksT,
  errors,
}: {
  customers: Customer[];
  briefs: BankCard[];
  start: string | null;
  staff: boolean;
  template: BriefView["template"];
  t: T;
  tasksT: TasksT;
  errors: Dictionary["errors"];
}) {
  const router = useRouter();
  const wide = useIsWide();
  const [customerId, setCustomerId] = useState(start);
  const [status, setStatus] = useState<BankStatus>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<"customer" | "status" | null>(null);
  // The list shown under the phone dropdowns: the open one, or the one folding away (kept until it has closed, so nothing jumps).
  const [lastOpen, setLastOpen] = useState<"customer" | "status" | null>(null);
  if (open && open !== lastOpen) setLastOpen(open);
  const [reading, setReading] = useState<BankCard | null>(null);
  const [editing, setEditing] = useState<BankCard | "new" | null>(null);
  const [copying, setCopying] = useState<BankCard | null>(null);
  const [deleting, setDeleting] = useState<{ card: BankCard; el: HTMLElement | null } | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const page = useRef<HTMLDivElement>(null);
  useFitHeight(page);
  const grid = useRef<HTMLDivElement>(null);
  useFlip(grid);
  const { onScroll, edge } = useScrolledEdge();

  const live = briefs.filter((b) => !gone.has(b.id));
  const customer = customers.find((c) => c.id === customerId) ?? null;
  const mine = live.filter((b) => b.customerId === customerId);
  const shown = findBriefs(mine, query, status);
  const counts = { all: mine.length, unused: mine.filter((b) => !b.usedFor).length, used: mine.filter((b) => b.usedFor).length };
  const message = (key: string) => (errors as Record<string, string>)[key] ?? errors.generic;
  const closeEditor = useCallback(() => setEditing(null), []);
  const closeReader = useCallback(() => setReading(null), []);
  const closeCopy = useCallback(() => setCopying(null), []);
  const stopDeleting = useCallback(() => setDeleting(null), []);

  const pickCustomer = (id: string) => {
    setCustomerId(id);
    setOpen(null);
    const url = new URL(window.location.href);
    url.searchParams.set("customer", id);
    window.history.replaceState(null, "", url);
  };

  const remove = () => {
    if (!deleting) return;
    const { card, el } = deleting;
    startTransition(async () => {
      const result = await deleteBankBrief(card.id);
      setDeleting(null);
      if (!result.ok) return toast.show(message(result.error), "error");
      shrinkOut(el, () => setGone((g) => new Set(g).add(card.id)));
      toast.show(fill(t.deletedToast, { title: card.title }));
      router.refresh();
    });
  };

  const statusItems = [
    { key: "all", label: t.all, count: counts.all },
    { key: "unused", label: t.unused, count: counts.unused },
    { key: "used", label: t.used, count: counts.used },
  ];

  if (!customers.length)
    return (
      <main className="flex flex-col gap-5">
        <Head t={t} staff={staff} onAdd={null} />
        <p className="zk-fade-up rounded-[28px] bg-surface px-5 py-8 text-center text-[15px] text-ink-soft">{t.noCustomers}</p>
      </main>
    );

  return (
    <div ref={page} className="flex flex-col gap-5">
      <Head t={t} staff={staff} onAdd={() => setEditing("new")} />

      <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1 lg:flex-row lg:items-stretch lg:gap-5">
        {/* Customers: a list on a computer, a dropdown (with the status one) on a phone. */}
        {wide ? (
          <aside aria-label={t.customers} className="flex w-[300px] shrink-0 flex-col gap-1 self-start rounded-[28px] bg-surface p-3.5 lg:max-h-full lg:overflow-y-auto lg:[scrollbar-width:thin]">
            <h2 className="mx-2 mb-2 mt-1 text-[13px] font-bold uppercase tracking-wider text-muted">{t.customer}</h2>
            {customers.map((c) => {
              const all = live.filter((b) => b.customerId === c.id);
              const free = all.filter((b) => !b.usedFor).length;
              const on = c.id === customerId;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => pickCustomer(c.id)}
                  className={`flex min-h-[52px] shrink-0 items-center gap-2.5 rounded-2xl px-3 text-left text-[14.5px] font-semibold transition-[background-color,box-shadow] duration-200 ${on ? "bg-teal-tint shadow-[inset_0_0_0_1.5px_var(--color-teal)]" : "hover:bg-mint"}`}
                >
                  <span aria-hidden="true" className="size-3 shrink-0 rounded-full border-[1.5px] border-black/25" style={{ background: c.color }} />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="flex flex-col items-end leading-tight">
                    <span className="text-[13px] font-bold tabular-nums">{all.length}</span>
                    <span className="text-[11px] font-semibold text-muted">{all.length ? fill(t.freeN, { n: free }) : "—"}</span>
                  </span>
                </button>
              );
            })}
          </aside>
        ) : (
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2">
              <Dropdown
                icon={<span aria-hidden="true" className="size-3 shrink-0 rounded-full border-[1.5px] border-black/25" style={{ background: customer?.color }} />}
                label={t.customer}
                value={`${customer?.name ?? "—"} · ${counts.all}`}
                open={open === "customer"}
                active
                onToggle={() => setOpen(open === "customer" ? null : "customer")}
              />
              <Dropdown
                icon={
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-teal-deep">
                    <path d={FILTER_ICONS.status} />
                  </svg>
                }
                label={t.status}
                value={`${statusItems.find((s) => s.key === status)?.label} · ${shown.length}`}
                open={open === "status"}
                active={status !== "all"}
                onToggle={() => setOpen(open === "status" ? null : "status")}
              />
            </div>
            <Collapse open={open !== null}>
              <div className="flex flex-col gap-0.5 rounded-[18px] border border-line bg-surface p-2">
                {lastOpen === "customer" &&
                  customers.map((c) => (
                    <Choice key={c.id} on={c.id === customerId} onClick={() => pickCustomer(c.id)} count={live.filter((b) => b.customerId === c.id).length}>
                      <span aria-hidden="true" className="size-3 shrink-0 rounded-full border-[1.5px] border-black/25" style={{ background: c.color }} />
                      {c.name}
                    </Choice>
                  ))}
                {lastOpen === "status" &&
                  statusItems.map((s) => (
                    <Choice
                      key={s.key}
                      on={s.key === status}
                      count={s.count}
                      onClick={() => {
                        setStatus(s.key as BankStatus);
                        setOpen(null);
                      }}
                    >
                      {s.label}
                    </Choice>
                  ))}
              </div>
            </Collapse>
          </div>
        )}

        <section aria-label={customer?.name} className="flex min-w-0 flex-1 flex-col gap-3.5 rounded-[28px] bg-surface p-3 sm:p-[18px] lg:min-h-0">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
            <TaskSearch value={query} onChange={setQuery} label={t.search} className="lg:flex-1" />
            {wide && <SegmentedControl items={statusItems} value={status} onChange={(k) => setStatus(k as BankStatus)} label={t.status} itemClassName="min-h-10 px-3.5 text-[13.5px]" />}
          </div>
          {/* On a computer only the cards scroll; the customers, header and filters stay put. */}
          <div onScroll={onScroll} className={`lg:-mx-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:px-1 lg:py-1.5 lg:[scrollbar-width:thin] ${edge}`}>
            <div ref={grid} className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {shown.map((card) => (
                <BriefCard
                  key={card.id}
                  card={card}
                  staff={staff}
                  t={t}
                  tasksT={tasksT}
                  onOpen={() => setReading(card)}
                  onEdit={() => setEditing(card)}
                  onCopy={() => setCopying(card)}
                  onDelete={(el) => setDeleting({ card, el })}
                />
              ))}
            </div>
            {shown.length === 0 && (
              <p key={`${customerId}-${status}-${!!query}`} className="zk-fade-up px-2 py-10 text-center text-[14px] text-ink-soft">
                {mine.length ? t.noMatch : fill(t.empty, { customer: customer?.name ?? "" })}
              </p>
            )}
          </div>
        </section>
      </div>

      {editing && customer && (
        <BankEditor
          card={editing === "new" ? null : editing}
          customer={editing === "new" ? customer : (customers.find((c) => c.id === editing.customerId) ?? customer)}
          template={template}
          t={t}
          tasksT={tasksT}
          message={message}
          onClose={closeEditor}
          onSaved={(title, isNew) => {
            setEditing(null);
            if (isNew) setStatus((s) => (s === "used" ? "all" : s));
            toast.show(fill(isNew ? t.addedToast : t.savedToast, { title }));
            router.refresh();
          }}
        />
      )}
      {reading && (
        <BankReader
          card={reading}
          customer={customers.find((c) => c.id === reading.customerId) ?? customer}
          staff={staff}
          t={t}
          tasksT={tasksT}
          onClose={closeReader}
          onEdit={() => {
            setReading(null);
            setEditing(reading);
          }}
          onCopy={() => {
            setReading(null);
            setCopying(reading);
          }}
          onDelete={() => {
            const card = reading;
            setReading(null);
            setDeleting({ card, el: document.querySelector<HTMLElement>(`article[data-flip="${CSS.escape(card.id)}"]`) });
          }}
        />
      )}
      {copying && (
        <CopySheet
          card={copying}
          taken={mine.map((b) => b.title)}
          t={t}
          message={message}
          onClose={closeCopy}
          onDone={(title) => {
            setCopying(null);
            setStatus((s) => (s === "used" ? "all" : s));
            toast.show(fill(t.duplicatedToast, { title }));
            router.refresh();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={t.deleteTitle}
          text={deleting.card.usedFor ? fill(t.deleteUsed, { title: deleting.card.title, code: deleting.card.usedFor }) : fill(t.deleteText, { title: deleting.card.title })}
          confirmLabel={t.delete}
          cancelLabel={t.cancel}
          pending={pending}
          onCancel={stopDeleting}
          onConfirm={remove}
        />
      )}
      <Toast message={toast.message} />
    </div>
  );
}

/** The page's title, its line of explanation, and "New brief". */
function Head({ t, staff, onAdd }: { t: T; staff: boolean; onAdd: (() => void) | null }) {
  return (
    <header className="flex flex-wrap items-end gap-x-5 gap-y-3">
      <div className="flex min-w-[260px] flex-1 flex-col gap-1">
        <span className="text-[13px] font-semibold text-teal-deep">{t.eyebrow}</span>
        <h1 className="text-2xl font-semibold sm:text-[28px]">{t.title}</h1>
        <p className="max-w-[62ch] text-sm leading-normal text-ink-soft">
          {t.intro}
          {staff ? "" : ` ${t.introOwn}`}
        </p>
      </div>
      {onAdd && (
        <button type="button" onClick={onAdd} className="flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-sun px-[22px] text-[15px] font-bold text-on-pastel max-sm:w-full">
          <Icon name="plus" size={18} strokeWidth={2.2} />
          {t.add}
        </button>
      )}
    </header>
  );
}

/** A phone dropdown button (customer or status), styled like the board's filters. */
function Dropdown({ icon, label, value, open, active, onToggle }: { icon: React.ReactNode; label: string; value: string; open: boolean; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-haspopup="true"
      aria-expanded={open}
      aria-label={`${label}: ${value}`}
      onClick={onToggle}
      className={`flex min-h-12 w-full min-w-0 items-center gap-2.5 rounded-2xl border-[1.5px] pl-3.5 pr-3 text-left transition-[border-color,background-color,box-shadow] duration-200 ${active ? "border-teal bg-teal-tint" : "border-line-strong bg-mint-soft"} ${open ? "border-teal shadow-[0_0_0_2px_color-mix(in_oklab,var(--color-teal)_30%,transparent)]" : ""}`}
    >
      {icon}
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-[11px] font-semibold text-muted">{label}</span>
        <span key={value} className="zk-fade-up truncate text-sm font-semibold">
          {value}
        </span>
      </span>
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 text-icon transition-transform duration-300 ${open ? "rotate-180" : ""}`}>
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}

/** One choice in a phone dropdown's list. */
function Choice({ on, count, onClick, children }: { on: boolean; count: number; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick} className={`flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 text-left text-sm font-medium transition-colors ${on ? "bg-teal-tint" : "hover:bg-mint-soft"}`}>
      {children}
      <span className="ml-auto text-xs font-semibold tabular-nums text-muted">{count}</span>
      {on && <Icon name="myTasks" size={16} className="zk-pop text-teal-deep" />}
    </button>
  );
}

/** One brief: its title and status, who wrote it and when, and the actions. Tapping it opens it to read. */
function BriefCard({ card, staff, t, tasksT, onOpen, onEdit, onCopy, onDelete }: { card: BankCard; staff: boolean; t: T; tasksT: TasksT; onOpen: () => void; onEdit: () => void; onCopy: () => void; onDelete: (el: HTMLElement | null) => void }) {
  const ref = useRef<HTMLElement>(null);
  const iconButton = "flex size-9 items-center justify-center rounded-full text-icon transition-colors hover:bg-mint hover:text-ink";
  return (
    <article
      ref={ref}
      data-flip={card.id}
      className={`relative flex min-w-0 flex-col gap-2.5 rounded-[20px] border-[1.5px] border-line px-4 py-3.5 transition-[border-color,box-shadow] duration-200 hover:border-teal ${card.usedFor ? "bg-[color-mix(in_oklab,var(--color-mint-soft)_70%,var(--color-teal-tint))]" : "bg-mint-soft"}`}
    >
      <div className="flex flex-wrap items-start gap-2.5">
        <h3 className="min-w-0 flex-[1_1_160px] break-words text-base font-semibold leading-snug">
          {/* The whole card opens it (the buttons below sit above this). */}
          <button type="button" onClick={onOpen} className="text-left after:absolute after:inset-0 after:rounded-[20px] after:content-['']">
            {card.title}
          </button>
        </h3>
        <StatusChip card={card} t={t} tasksT={tasksT} />
      </div>
      <div className="flex items-center gap-2 border-t border-line pt-2.5 text-[12.5px] text-muted">
        {staff && (
          <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full text-[9.5px] font-bold text-white" style={{ background: personColor(card.byId) }}>
            {initials(card.by)}
          </span>
        )}
        <span className="min-w-0 truncate whitespace-nowrap">
          {staff ? `${card.by.split(" ")[0]} · ` : ""}
          {card.on}
        </span>
        <span className="relative z-[1] ml-auto flex shrink-0 items-center gap-0.5">
          <button type="button" onClick={onEdit} className="flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold text-ink transition-colors hover:bg-mint">
            <Icon name="edit" size={15} />
            {t.edit}
          </button>
          <button type="button" onClick={onCopy} aria-label={fill(t.duplicateOf, { title: card.title })} title={t.duplicate} className={iconButton}>
            <DuplicateIcon size={17} />
          </button>
          <button type="button" onClick={() => onDelete(ref.current)} aria-label={fill(t.deleteOf, { title: card.title })} title={t.delete} className={`${iconButton} hover:text-danger`}>
            <Icon name="trash" size={16} />
          </button>
        </span>
      </div>
    </article>
  );
}

/** "Not used", or "used for <content ID>". */
function StatusChip({ card, t, tasksT }: { card: BankCard; t: T; tasksT: TasksT }) {
  return card.usedFor ? (
    <span className="flex max-w-full items-center gap-1.5 rounded-full bg-teal-tint px-2.5 py-1 text-xs font-bold text-teal-deep">
      <Icon name="link" size={12} strokeWidth={2.2} />
      <span className="min-w-0 [overflow-wrap:anywhere]">
        <WithCode text={tasksT.brief.usedFor} code={card.usedFor} />
      </span>
    </span>
  ) : (
    <span className="whitespace-nowrap rounded-full bg-mint px-2.5 py-1 text-xs font-bold text-ink-soft">{t.unused}</span>
  );
}

/** A bank brief to read: its customer, title, who wrote it, status and fields; Delete, Duplicate, Close and Edit. */
function BankReader({ card, customer, staff, t, tasksT, onClose, onEdit, onCopy, onDelete }: { card: BankCard; customer: Customer | null; staff: boolean; t: T; tasksT: TasksT; onClose: () => void; onEdit: () => void; onCopy: () => void; onDelete: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => pop(box.current), []);
  const window = (
    <Dialog label={card.title} onClose={onClose}>
      <div ref={box} className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {customer && (
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-teal-deep">
                <span aria-hidden="true" className="size-2.5 rounded-full border-[1.5px] border-black/25" style={{ background: customer.color }} />
                {fill(t.editorEyebrow, { customer: customer.name })}
              </span>
            )}
            <h2 className="break-words text-xl font-semibold sm:text-2xl">{card.title}</h2>
            <span className="text-[13px] text-ink-soft">
              {staff ? `${card.by} · ` : ""}
              {card.on}
            </span>
          </div>
          <CloseButton label={t.close} onClick={onClose} />
        </div>
        <div className="flex">
          <StatusChip card={card} t={t} tasksT={tasksT} />
        </div>
        <BriefReader fields={card.fields} t={tasksT} />
        {/* Two even rows on a phone: Delete | Duplicate, Close | Edit. */}
        <div className="flex flex-wrap items-center gap-2.5 max-sm:grid max-sm:grid-cols-2">
          <button type="button" onClick={onDelete} className="min-h-12 rounded-full bg-surface px-5 text-[15px] font-semibold text-danger">
            {t.delete}
          </button>
          <span className="flex-1 max-sm:hidden" />
          <button type="button" onClick={onCopy} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface px-5 text-[15px] font-semibold">
            <DuplicateIcon size={16} />
            {t.duplicate}
          </button>
          <button type="button" onClick={onClose} className="min-h-12 rounded-full bg-surface px-5 text-[15px] font-semibold">
            {t.close}
          </button>
          <button type="button" onClick={onEdit} className="min-h-12 rounded-full bg-sun px-6 text-[15px] font-semibold text-ink">
            {t.edit}
          </button>
        </div>
      </div>
    </Dialog>
  );
  return typeof document === "undefined" ? null : createPortal(window, document.body);
}

/** Writing a bank brief: its title, then the same fields as the brief window (starting fields for a new one). */
function BankEditor({
  card,
  customer,
  template,
  t,
  tasksT,
  message,
  onClose,
  onSaved,
}: {
  card: BankCard | null;
  customer: Customer;
  template: BriefView["template"];
  t: T;
  tasksT: TasksT;
  message: (key: string) => string;
  onClose: () => void;
  onSaved: (title: string, isNew: boolean) => void;
}) {
  const [title, setTitle] = useState(card?.title ?? "");
  const [titleProblem, setTitleProblem] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const titleBox = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => pop(box.current), []);
  useEffect(() => {
    if (!card) titleBox.current?.focus();
  }, [card]);
  const window = (
    <Dialog label={card ? t.editorEdit : t.editorNew} onClose={onClose}>
      <div ref={box} className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-teal-deep">
              <span aria-hidden="true" className="size-2.5 rounded-full border-[1.5px] border-black/25" style={{ background: customer.color }} />
              {fill(t.editorEyebrow, { customer: customer.name })}
            </span>
            <h2 className="text-xl font-semibold sm:text-2xl">{card ? t.editorEdit : t.editorNew}</h2>
          </div>
          <CloseButton label={t.close} onClick={onClose} />
        </div>
        {card?.usedFor && (
          <p className="flex items-center gap-2.5 rounded-[16px] bg-teal-tint px-3.5 py-2.5 text-[13.5px] font-semibold text-teal-deep">
            <Icon name="link" size={16} />
            <span>
              <WithCode text={t.linked} code={card.usedFor} />
            </span>
          </p>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="px-1 text-sm font-semibold">{t.titleLabel}</span>
          <input
            ref={titleBox}
            value={title}
            maxLength={BANK_TITLE_LIMIT}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleProblem(false);
            }}
            placeholder={t.titlePlaceholder}
            aria-invalid={titleProblem || undefined}
            className={`h-[52px] w-full rounded-[16px] border-[1.5px] bg-surface px-4 text-[17px] font-semibold text-ink placeholder:font-normal placeholder:text-muted focus:border-teal ${titleProblem ? "border-danger" : "border-line-strong"}`}
          />
        </label>
        <BriefEditor
          brief={{ fields: card?.fields ?? [], template }}
          isNew={!card}
          t={tasksT}
          saveLabel={card ? t.save : t.saveNew}
          hint={tasksT.brief.emptyHint}
          onCancel={onClose}
          onSave={async (fields) => {
            if (!title.trim()) {
              setTitleProblem(true);
              titleBox.current?.focus();
              return { error: message("bankTitleMissing") };
            }
            const result = await saveBankBrief({ id: card?.id, customerId: customer.id, title, fields });
            if (!result.ok) {
              if (result.error === "bankTitleMissing") setTitleProblem(true);
              return { error: message(result.error), fieldId: result.fieldId };
            }
            onSaved(title.trim(), !card);
            return null;
          }}
        />
      </div>
    </Dialog>
  );
  return typeof document === "undefined" ? null : createPortal(window, document.body);
}

/** Duplicate: asks for the copy's title (suggested from the original's). */
function CopySheet({ card, taken, t, message, onClose, onDone }: { card: BankCard; taken: string[]; t: T; message: (key: string) => string; onClose: () => void; onDone: (title: string) => void }) {
  const [title, setTitle] = useState(() => copyTitle(card.title, taken, t.copyWord));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  const submit = () =>
    startTransition(async () => {
      const result = await duplicateBankBrief(card.id, title);
      if (!result.ok) return setError(message(result.error));
      onDone(title.trim());
    });
  return (
    <Sheet
      label={t.dupTitle}
      onClose={onClose}
      width="sm:max-w-[460px]"
      header={
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[13px] font-semibold text-teal-deep">{t.dupEyebrow}</span>
            <h2 className="text-xl font-semibold">{t.dupTitle}</h2>
            <p className="text-[13px] leading-snug text-ink-soft">{t.dupText}</p>
          </div>
          <SheetClose label={t.close} />
        </div>
      }
      footer={<CopyFooter t={t} pending={pending} onSubmit={submit} />}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-2 pt-1"
      >
        <input
          ref={input}
          value={title}
          maxLength={BANK_TITLE_LIMIT}
          aria-label={t.dupTitle}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
          className={`h-[52px] w-full rounded-[16px] border-[1.5px] bg-surface px-4 text-[16px] font-semibold text-ink focus:border-teal ${error ? "border-danger" : "border-line-strong"}`}
        />
        {error && (
          <p role="alert" className="px-1 text-[13px] font-medium text-danger">
            {error}
          </p>
        )}
      </form>
    </Sheet>
  );
}

function CopyFooter({ t, pending, onSubmit }: { t: T; pending: boolean; onSubmit: () => void }) {
  const close = useSheetClose();
  return (
    <>
      <span className="flex-1" />
      <button type="button" onClick={close} className="min-h-12 rounded-full bg-surface px-5 text-[15px] font-semibold">
        {t.cancel}
      </button>
      <button type="button" onClick={onSubmit} disabled={pending} className="flex min-h-12 items-center gap-2 rounded-full bg-teal px-5 text-[15px] font-semibold text-white disabled:opacity-60">
        <DuplicateIcon size={16} />
        {t.duplicate}
      </button>
    </>
  );
}

function SheetClose({ label }: { label: string }) {
  const close = useSheetClose();
  return <CloseButton label={label} onClick={close} />;
}

