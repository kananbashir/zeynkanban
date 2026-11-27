"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { addBankNote, approveBankBrief, deleteBankBrief, duplicateBankBrief, saveBankBrief } from "@/app/actions/bank";
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
import { BANK_NOTE_LIMIT, BANK_TITLE_LIMIT, copyTitle, findBriefs, type BankStatus } from "@/lib/bank-rules";
import type { BriefField } from "@/lib/brief-rules";
import { prefersReducedMotion, springOrFallback } from "@/lib/spring";

type T = Dictionary["bank"];
type TasksT = Dictionary["tasks"];
type Customer = { id: string; name: string; color: string };
type Person = { id: string; name: string };
export type BankApprover = Person & { approved: boolean; edited: boolean; on: string | null };
export type BankNote = { id: string; userId: string; name: string; body: string; edited: boolean; on: string };
/** One bank brief as the page shows it, with what the person looking may do with it. */
export type BankCard = {
  id: string;
  customerId: string;
  title: string;
  fields: BriefField[];
  byId: string;
  by: string;
  on: string;
  usedFor: string | null;
  approved: boolean;
  approvers: BankApprover[];
  notes: BankNote[];
  canApprove: boolean;
  canEdit: boolean;
  canRemove: boolean;
  isApprover: boolean;
};

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
  openBrief,
  staff,
  meId,
  approverChoices,
  template,
  t,
  tasksT,
  errors,
}: {
  customers: Customer[];
  briefs: BankCard[];
  start: string | null;
  /** Opened from a notification: show this brief straight away. */
  openBrief: string | null;
  staff: boolean;
  meId: string;
  /** Per customer, the employees an admin or manager can ask to approve. */
  approverChoices: Record<string, Person[]>;
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
  // The brief open to read (by id, so it shows the latest after a note or an approval).
  const [readingId, setReadingId] = useState<string | null>(openBrief);
  // A notification tapped while already on this page opens its brief (and its customer).
  const [seenOpen, setSeenOpen] = useState(openBrief);
  if (openBrief !== seenOpen) {
    setSeenOpen(openBrief);
    if (openBrief) {
      setReadingId(openBrief);
      setCustomerId(start);
    }
  }
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
  const reading = live.find((b) => b.id === readingId) ?? null;
  const setReading = (card: BankCard | null) => setReadingId(card?.id ?? null);
  const customer = customers.find((c) => c.id === customerId) ?? null;
  const mine = live.filter((b) => b.customerId === customerId);
  const shown = findBriefs(mine, query, status);
  const counts = { all: mine.length, unused: mine.filter((b) => !b.usedFor).length, used: mine.filter((b) => b.usedFor).length, mine: mine.filter((b) => b.canApprove).length };
  const message = (key: string) => (errors as Record<string, string>)[key] ?? errors.generic;
  const closeEditor = useCallback(() => setEditing(null), []);
  const closeReader = useCallback(() => setReadingId(null), []);
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

  const approve = (card: BankCard) =>
    startTransition(async () => {
      const result = await approveBankBrief(card.id);
      if (!result.ok) return toast.show(message(result.error), "error");
      toast.show(fill(result.approved ? t.approvedToast : t.approvedMineToast, { title: card.title }));
      router.refresh();
    });

  const statusItems = [
    { key: "all", label: t.all, count: counts.all },
    { key: "unused", label: t.unused, count: counts.unused },
    { key: "used", label: t.used, count: counts.used },
    { key: "mine", label: t.mine, count: counts.mine },
  ];

  if (!customers.length)
    return (
      <main className="flex flex-col gap-5">
        <Head t={t} onAdd={null} />
        <p className="zk-fade-up rounded-[28px] bg-surface px-5 py-8 text-center text-[15px] text-ink-soft">{t.noCustomers}</p>
      </main>
    );

  return (
    <div ref={page} className="flex flex-col gap-5">
      <Head t={t} onAdd={() => setEditing("new")} />

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
                  showBy={staff || card.byId !== meId}
                  t={t}
                  tasksT={tasksT}
                  onOpen={() => setReading(card)}
                  onApprove={() => approve(card)}
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
          staff={staff}
          meId={meId}
          choices={approverChoices[editing === "new" ? customer.id : editing.customerId] ?? []}
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
          meId={meId}
          pending={pending}
          t={t}
          tasksT={tasksT}
          message={message}
          onClose={closeReader}
          onApprove={() => approve(reading)}
          onNoted={() => router.refresh()}
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

/** The page's title and "New brief". */
function Head({ t, onAdd }: { t: T; onAdd: (() => void) | null }) {
  return (
    <header className="flex flex-wrap items-end gap-x-5 gap-y-3">
      <div className="flex min-w-[260px] flex-1 flex-col gap-1">
        <span className="text-[13px] font-semibold text-teal-deep">{t.eyebrow}</span>
        <h1 className="text-2xl font-semibold sm:text-[28px]">{t.title}</h1>
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

/** A person's round initials (for approvers and notes); with a small ✓ or clock for approvers. */
function Face({ person, state, size = 28 }: { person: Person; state?: "ok" | "wait"; size?: number }) {
  return (
    <span aria-hidden="true" className="relative flex shrink-0 items-center justify-center rounded-full border-2 border-surface font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.36, background: personColor(person.id) }}>
      {initials(person.name)}
      {state && (
        <span className={`absolute -bottom-1 -right-1 flex size-3.5 items-center justify-center rounded-full border-2 border-surface ${state === "ok" ? "bg-teal text-white" : "bg-sun text-on-pastel"}`}>
          <Icon name={state === "ok" ? "check" : "clock"} size={8} strokeWidth={3.2} />
        </span>
      )}
    </span>
  );
}

/** "Waiting for approval (· 1/2)", "Waiting for your approval" or "Approved". */
function ApprovalChip({ card, t }: { card: BankCard; t: T }) {
  if (card.approved)
    return (
      <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[color-mix(in_oklab,var(--color-teal)_22%,transparent)] px-2.5 py-1 text-xs font-bold text-teal-deep">
        <Icon name="seal" size={13} strokeWidth={2} />
        {t.approved}
      </span>
    );
  const mineToo = card.canApprove && card.isApprover;
  const done = card.approvers.filter((a) => a.approved).length;
  return (
    <span className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${mineToo ? "bg-sun text-on-pastel" : "bg-sun-tint text-sun-ink"}`}>
      <Icon name="clock" size={12} strokeWidth={2.2} />
      {mineToo ? t.waitingMine : card.approvers.length > 1 ? fill(t.waitingN, { n: done, of: card.approvers.length }) : t.waiting}
    </span>
  );
}

/** The approve button (teal, with a tick). */
function ApproveButton({ label, big = false, disabled, onClick }: { label: string; big?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-teal font-bold text-white transition-colors hover:bg-teal-deep disabled:opacity-60 ${big ? "min-h-12 px-6 text-[15px]" : "min-h-9 px-3.5 text-[13px]"}`}>
      <Icon name="check" size={big ? 18 : 15} strokeWidth={2.6} />
      {label}
    </button>
  );
}

/** One brief: title and status, approval, who wrote it and when, and the actions. Tapping it opens it to read. */
function BriefCard({ card, showBy, t, tasksT, onOpen, onApprove, onEdit, onCopy, onDelete }: { card: BankCard; showBy: boolean; t: T; tasksT: TasksT; onOpen: () => void; onApprove: () => void; onEdit: () => void; onCopy: () => void; onDelete: (el: HTMLElement | null) => void }) {
  const ref = useRef<HTMLElement>(null);
  const iconButton = "flex size-9 items-center justify-center rounded-full text-icon transition-colors hover:bg-mint hover:text-ink";
  // With Approve there, Edit becomes an icon so everything fits.
  const compact = card.canApprove;
  return (
    <article
      ref={ref}
      data-flip={card.id}
      // Anywhere on the card opens it, except its buttons (the title is also a button, for the keyboard).
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("button, a")) onOpen();
      }}
      className={`relative flex min-w-0 cursor-pointer flex-col gap-2.5 rounded-[20px] border-[1.5px] border-line px-4 py-3.5 transition-[border-color,box-shadow] duration-200 hover:border-teal ${card.usedFor ? "bg-[color-mix(in_oklab,var(--color-mint-soft)_70%,var(--color-teal-tint))]" : "bg-mint-soft"}`}
    >
      <div className="flex flex-wrap items-start gap-2.5">
        <h3 className="min-w-0 flex-[1_1_160px] break-words text-base font-semibold leading-snug">
          <button type="button" onClick={onOpen} className="text-left">
            {card.title}
          </button>
        </h3>
        <StatusChip card={card} t={t} tasksT={tasksT} />
      </div>
      <div key={`${card.approved}-${card.canApprove}`} className="zk-fade-up flex flex-wrap items-center gap-2">
        <ApprovalChip card={card} t={t} />
        {card.approvers.length > 0 && (
          <span className="flex gap-1.5" aria-label={card.approvers.map((a) => `${a.name}: ${a.approved ? t.approverDone.split(" ·")[0] : t.approverWaiting}`).join(", ")}>
            {card.approvers.map((a) => (
              <Face key={a.id} person={a} state={a.approved ? "ok" : "wait"} />
            ))}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-line pt-2.5 text-[12.5px] text-muted">
        {showBy && <Face person={{ id: card.byId, name: card.by }} size={24} />}
        <span className="min-w-0 truncate whitespace-nowrap">
          {showBy ? `${card.by.split(" ")[0]} · ` : ""}
          {card.on}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-0.5">
          {card.canEdit &&
            (compact ? (
              <button type="button" onClick={onEdit} aria-label={`${t.edit}: ${card.title}`} title={t.edit} className={iconButton}>
                <Icon name="edit" size={16} />
              </button>
            ) : (
              <button type="button" onClick={onEdit} className="flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold text-ink transition-colors hover:bg-mint">
                <Icon name="edit" size={15} />
                {t.edit}
              </button>
            ))}
          {card.canRemove && (
            <>
              <button type="button" onClick={onCopy} aria-label={fill(t.duplicateOf, { title: card.title })} title={t.duplicate} className={iconButton}>
                <DuplicateIcon size={17} />
              </button>
              <button type="button" onClick={() => onDelete(ref.current)} aria-label={fill(t.deleteOf, { title: card.title })} title={t.delete} className={`${iconButton} hover:text-danger`}>
                <Icon name="trash" size={16} />
              </button>
            </>
          )}
          {card.canApprove && (
            <span className="ml-1.5">
              <ApproveButton label={t.approve} onClick={onApprove} />
            </span>
          )}
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

/** Who approves and how far they are. */
function ApprovalBox({ card, meId, t }: { card: BankCard; meId: string; t: T }) {
  if (!card.approvers.length) return null;
  return (
    <section aria-label={t.approval} className="flex flex-col gap-2 rounded-[18px] bg-surface px-3.5 py-3">
      <h3 className="text-[11.5px] font-bold uppercase tracking-wider text-muted">{t.approval}</h3>
      {card.approvers.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
          <Face person={a} state={a.approved ? "ok" : "wait"} size={30} />
          <span className="font-semibold">
            {a.name}
            {a.id === meId ? ` ${t.you}` : ""}
          </span>
          <span className={`ml-auto text-[12.5px] font-bold ${a.approved ? "text-teal-deep" : "text-sun-ink"}`}>{a.approved ? fill(a.edited ? t.approverEdited : t.approverDone, { when: a.on ?? "" }) : t.approverWaiting}</span>
        </div>
      ))}
    </section>
  );
}

/** The notes on a brief, as a short conversation, and a box to write one (without approving). */
function NotesBox({ card, t, message, onNoted }: { card: BankCard; t: T; message: (key: string) => string; onNoted: () => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const list = useRef<HTMLDivElement>(null);
  useFlip(list);
  const send = () =>
    startTransition(async () => {
      if (!text.trim()) return;
      const result = await addBankNote(card.id, text);
      if (!result.ok) return setError(message(result.error));
      setText("");
      setError(null);
      onNoted();
    });
  return (
    <section aria-label={t.notes} className="flex flex-col gap-2.5 rounded-[18px] bg-surface px-3.5 py-3">
      <h3 className="text-[11.5px] font-bold uppercase tracking-wider text-muted">{card.notes.length ? fill(t.notesN, { n: card.notes.length }) : t.notes}</h3>
      <div ref={list} className="flex flex-col gap-2">
        {card.notes.map((n) => (
          <div key={n.id} data-flip={n.id} className="flex gap-2.5">
            <Face person={{ id: n.userId, name: n.name }} size={30} />
            <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-[4px_16px_16px_16px] bg-mint-soft px-3 py-2">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
                <span className="font-semibold">{n.name}</span>
                <span className="text-muted">{n.on}</span>
                {n.edited && <span className="rounded-full bg-[color-mix(in_oklab,var(--color-teal)_22%,transparent)] px-2 py-px text-[11px] font-bold text-teal-deep">{t.editedTag}</span>}
                {n.userId === card.byId && <span className="rounded-full bg-mint px-2 py-px text-[11px] font-bold text-ink-soft">{t.author}</span>}
              </span>
              <span className="whitespace-pre-line break-words text-[13.5px] leading-normal text-ink-body">{n.body}</span>
            </div>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-end gap-2"
      >
        <textarea
          value={text}
          rows={1}
          maxLength={BANK_NOTE_LIMIT}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={t.notePlaceholder}
          aria-label={t.notePlaceholder}
          className="min-h-[46px] min-w-0 flex-1 resize-none rounded-[14px] border-[1.5px] border-line-strong bg-surface px-3.5 py-2.5 text-sm leading-normal text-ink placeholder:text-muted focus:border-teal"
        />
        <button type="submit" disabled={pending || !text.trim()} className="flex min-h-[46px] shrink-0 items-center gap-1.5 rounded-full bg-sun px-4 text-sm font-bold text-on-pastel transition-opacity disabled:opacity-50">
          <Icon name="send" size={16} strokeWidth={2.2} />
          {t.send}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

/** A bank brief to read: customer, title, who wrote it, status, approval, notes and fields; and what this person may do. */
function BankReader({
  card,
  customer,
  staff,
  meId,
  pending,
  t,
  tasksT,
  message,
  onClose,
  onApprove,
  onNoted,
  onEdit,
  onCopy,
  onDelete,
}: {
  card: BankCard;
  customer: Customer | null;
  staff: boolean;
  meId: string;
  pending: boolean;
  t: T;
  tasksT: TasksT;
  message: (key: string) => string;
  onClose: () => void;
  onApprove: () => void;
  onNoted: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => pop(box.current), []);
  const sentToMe = card.isApprover && card.canApprove;
  const ghost = "flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface px-5 text-[15px] font-semibold";
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
              {staff || card.byId !== meId ? `${card.by} · ` : ""}
              {card.on}
            </span>
          </div>
          <CloseButton label={t.close} onClick={onClose} />
        </div>
        <div key={`${card.approved}-${card.canApprove}`} className="zk-fade-up flex flex-wrap gap-2">
          <StatusChip card={card} t={t} tasksT={tasksT} />
          <ApprovalChip card={card} t={t} />
        </div>
        {sentToMe && (
          <p className="flex items-center gap-2.5 rounded-[16px] bg-sun-tint px-3.5 py-2.5 text-[13.5px] font-semibold text-sun-ink">
            <Icon name="clock" size={17} />
            {fill(t.sentBy, { name: card.by })}
          </p>
        )}
        <ApprovalBox card={card} meId={meId} t={t} />
        {card.canEdit && <NotesBox card={card} t={t} message={message} onNoted={onNoted} />}
        <BriefReader fields={card.fields} t={tasksT} />
        {/* On a phone the buttons sit in two even rows. */}
        <div className="flex flex-wrap items-center gap-2.5 max-sm:grid max-sm:grid-cols-2">
          {card.canRemove && (
            <button type="button" onClick={onDelete} className="min-h-12 rounded-full bg-surface px-5 text-[15px] font-semibold text-danger">
              {t.delete}
            </button>
          )}
          <span className="flex-1 max-sm:hidden" />
          {card.canRemove && (
            <button type="button" onClick={onCopy} className={ghost}>
              <DuplicateIcon size={16} />
              {t.duplicate}
            </button>
          )}
          <button type="button" onClick={onClose} className={ghost}>
            {t.close}
          </button>
          {card.canEdit &&
            (card.canApprove ? (
              <button type="button" onClick={onEdit} className={ghost}>
                <Icon name="edit" size={16} />
                {t.edit}
              </button>
            ) : (
              <button type="button" onClick={onEdit} className="min-h-12 rounded-full bg-sun px-6 text-[15px] font-semibold text-ink">
                {t.edit}
              </button>
            ))}
          {card.canApprove && <ApproveButton big label={t.approve} disabled={pending} onClick={onApprove} />}
        </div>
      </div>
    </Dialog>
  );
  return typeof document === "undefined" ? null : createPortal(window, document.body);
}

/**
 * Writing a bank brief: its title, who approves it (admins and managers), then the same fields as the
 * brief window (starting fields for a new one). An approver editing it says what changed and approves with it.
 */
function BankEditor({
  card,
  customer,
  template,
  staff,
  meId,
  choices,
  t,
  tasksT,
  message,
  onClose,
  onSaved,
}: {
  card: BankCard | null;
  customer: Customer;
  template: BriefView["template"];
  staff: boolean;
  meId: string;
  choices: Person[];
  t: T;
  tasksT: TasksT;
  message: (key: string) => string;
  onClose: () => void;
  onSaved: (title: string, isNew: boolean) => void;
}) {
  const [title, setTitle] = useState(card?.title ?? "");
  const [titleProblem, setTitleProblem] = useState(false);
  const [approvers, setApprovers] = useState<string[]>(() => card?.approvers.map((a) => a.id) ?? []);
  const [note, setNote] = useState("");
  const [noteProblem, setNoteProblem] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const titleBox = useRef<HTMLInputElement>(null);
  const noteBox = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => pop(box.current), []);
  useEffect(() => {
    if (!card) titleBox.current?.focus();
  }, [card]);
  // An approver (not the author) edits and approves in one go.
  const approverEdit = !!card?.isApprover && card.byId !== meId;
  // Anyone already asked stays choosable even if their bank access changed since.
  const people = [...choices, ...(card?.approvers ?? []).filter((a) => !choices.some((c) => c.id === a.id))];
  const toggle = (id: string) => setApprovers((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
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
        {approverEdit && (
          <p className="flex items-center gap-2.5 rounded-[16px] bg-sun-tint px-3.5 py-2.5 text-[13.5px] font-semibold text-sun-ink">
            <Icon name="clock" size={17} />
            {fill(t.sentByEdit, { name: card.by })}
          </p>
        )}
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
        {staff && (
          <div role="group" aria-label={t.approvers} className="flex flex-col gap-2 rounded-[18px] bg-surface px-4 py-3.5">
            <span className="text-sm font-semibold">
              {t.approvers} <span className="text-[13px] font-medium text-muted">{t.optional}</span>
            </span>
            <span className="text-[12.5px] leading-snug text-ink-soft">{t.approversHelp}</span>
            <span className="flex flex-wrap gap-2">
              {people.length === 0 && <span className="text-[13px] text-muted">{t.noApproverChoices}</span>}
              {people.map((p) => {
                const on = approvers.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(p.id)}
                    className={`flex min-h-[42px] items-center gap-2 rounded-full border-[1.5px] pl-1.5 pr-3.5 text-sm font-semibold transition-[border-color,background-color] duration-200 ${on ? "border-teal bg-teal-tint" : "border-line-strong hover:bg-mint-soft"}`}
                  >
                    <span aria-hidden="true" className={`ml-1.5 flex size-[18px] items-center justify-center rounded-md transition-colors ${on ? "bg-teal text-white" : "border-[1.5px] border-subtle"}`}>
                      {on && <Icon name="check" size={12} strokeWidth={3} className="zk-pop" />}
                    </span>
                    <Face person={p} size={26} />
                    {p.name}
                  </button>
                );
              })}
            </span>
          </div>
        )}
        <BriefEditor
          brief={{ fields: card?.fields ?? [], template }}
          isNew={!card}
          t={tasksT}
          saveLabel={approverEdit ? t.saveApprove : card ? t.save : approvers.length ? t.saveSend : t.saveNew}
          saveClassName={approverEdit ? "bg-teal text-white" : undefined}
          hint={tasksT.brief.emptyHint}
          beforeFooter={
            approverEdit ? (
              <label className="flex flex-col gap-1.5 rounded-[18px] bg-surface px-4 py-3.5">
                <span className="text-sm font-semibold">{t.whatChanged}</span>
                <span className="text-[12.5px] text-ink-soft">{t.whatChangedHelp}</span>
                <textarea
                  ref={noteBox}
                  value={note}
                  maxLength={BANK_NOTE_LIMIT}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setNoteProblem(false);
                  }}
                  aria-invalid={noteProblem || undefined}
                  className={`min-h-[72px] rounded-[14px] border-[1.5px] bg-surface px-3.5 py-2.5 text-sm leading-normal text-ink focus:border-teal ${noteProblem ? "border-danger" : "border-line-strong"}`}
                />
              </label>
            ) : undefined
          }
          onCancel={onClose}
          onSave={async (fields) => {
            if (!title.trim()) {
              setTitleProblem(true);
              titleBox.current?.focus();
              return { error: message("bankTitleMissing") };
            }
            if (approverEdit && !note.trim()) {
              setNoteProblem(true);
              noteBox.current?.focus();
              return { error: message("bankNoteMissing") };
            }
            const result = await saveBankBrief({ id: card?.id, customerId: customer.id, title, fields, ...(staff ? { approvers } : {}), ...(approverEdit ? { note } : {}) });
            if (!result.ok) {
              if (result.error === "bankTitleMissing") setTitleProblem(true);
              if (result.error === "bankNoteMissing") setNoteProblem(true);
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

