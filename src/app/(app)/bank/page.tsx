import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { bankAccess, bankApprovers, bankBriefs, bankNotes, briefFields, contentBriefs, contents, customers, users } from "@/db/schema";
import { getDictionary } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { mayApprove, mayEditBank, mayRemoveBank } from "@/lib/bank-rules";
import { parseBrief } from "@/lib/brief-rules";
import { approverBriefIds, bankCustomerIds } from "@/lib/briefs";
import { dateInZone } from "@/lib/dates";
import { shortDate } from "@/lib/format-date";
import { homeFor, isStaff, writesBriefs } from "@/lib/roles";
import { BankView, type BankCard } from "./bank-view";

const clock = (at: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: process.env.APP_TIME_ZONE || "Asia/Baku", hour: "2-digit", minute: "2-digit", hour12: false }).format(at);

/**
 * Content bank: briefs written ahead for a customer, approved, then picked for a content ID from the
 * brief window. Admins and managers see everyone's; employees their own and those they are asked to
 * approve, for the customers ticked for them in Settings → Users. Graphic designers can't open it.
 */
export default async function BankPage({ searchParams }: { searchParams: Promise<{ customer?: string; brief?: string }> }) {
  const me = await requireUser();
  if (!writesBriefs(me.role)) redirect(homeFor(me.role));
  const { t, locale } = await getDictionary();
  const staff = isStaff(me.role);
  const asked = staff ? [] : await approverBriefIds(me.id);
  // An employee also sees the customers of briefs they are asked to approve.
  const askedCustomers = asked.length ? (await db.select({ id: bankBriefs.customerId }).from(bankBriefs).where(inArray(bankBriefs.id, asked))).map((r) => r.id) : [];
  const allowed = [...new Set([...(await bankCustomerIds(me)), ...askedCustomers])];
  const when = (at: Date) => `${shortDate(dateInZone(at), t.tasks)}, ${clock(at)}`;

  const visible = staff ? inArray(bankBriefs.customerId, allowed) : and(inArray(bankBriefs.customerId, allowed), asked.length ? or(eq(bankBriefs.createdBy, me.id), inArray(bankBriefs.id, asked)) : eq(bankBriefs.createdBy, me.id));
  const [list, rows, template, access] = await Promise.all([
    allowed.length ? db.select({ id: customers.id, name: customers.name, color: customers.color }).from(customers).where(inArray(customers.id, allowed)).orderBy(asc(customers.name)) : [],
    allowed.length
      ? db
          .select({ id: bankBriefs.id, customerId: bankBriefs.customerId, title: bankBriefs.title, fields: bankBriefs.fields, byId: bankBriefs.createdBy, by: users.name, byRole: users.role, createdAt: bankBriefs.createdAt, approvedAt: bankBriefs.approvedAt, usedFor: contents.code })
          .from(bankBriefs)
          .innerJoin(users, eq(users.id, bankBriefs.createdBy))
          .leftJoin(contentBriefs, eq(contentBriefs.bankBriefId, bankBriefs.id))
          .leftJoin(contents, eq(contents.id, contentBriefs.contentId))
          .where(visible)
          .orderBy(desc(bankBriefs.createdAt))
      : [],
    db.select().from(briefFields).orderBy(asc(briefFields.position), asc(briefFields.createdAt)),
    // Who can be asked to approve, per customer (admins and managers pick them).
    staff
      ? db
          .select({ customerId: bankAccess.customerId, id: users.id, name: users.name })
          .from(bankAccess)
          .innerJoin(users, eq(users.id, bankAccess.userId))
          .where(and(eq(users.role, "employee"), eq(users.active, true)))
          .orderBy(asc(users.name))
      : [],
  ]);
  const ids = rows.map((r) => r.id);
  const [approverRows, noteRows] = ids.length
    ? await Promise.all([
        db.select({ briefId: bankApprovers.bankBriefId, id: users.id, name: users.name, approvedAt: bankApprovers.approvedAt, edited: bankApprovers.edited }).from(bankApprovers).innerJoin(users, eq(users.id, bankApprovers.userId)).where(inArray(bankApprovers.bankBriefId, ids)).orderBy(asc(users.name)),
        db.select({ briefId: bankNotes.bankBriefId, id: bankNotes.id, userId: bankNotes.userId, name: users.name, body: bankNotes.body, edited: bankNotes.edited, createdAt: bankNotes.createdAt }).from(bankNotes).innerJoin(users, eq(users.id, bankNotes.userId)).where(inArray(bankNotes.bankBriefId, ids)).orderBy(asc(bankNotes.createdAt)),
      ])
    : [[], []];

  const briefs: BankCard[] = rows.map((r) => {
    const approvers = approverRows.filter((a) => a.briefId === r.id);
    const approverIds = approvers.map((a) => a.id);
    return {
      id: r.id,
      customerId: r.customerId,
      title: r.title,
      fields: parseBrief(r.fields),
      byId: r.byId,
      by: r.by,
      on: shortDate(dateInZone(r.createdAt), t.tasks),
      usedFor: r.usedFor,
      approved: !!r.approvedAt,
      approvers: approvers.map((a) => ({ id: a.id, name: a.name, approved: !!a.approvedAt, edited: a.edited, on: a.approvedAt ? when(a.approvedAt) : null })),
      notes: noteRows.filter((n) => n.briefId === r.id).map((n) => ({ id: n.id, userId: n.userId, name: n.name, body: n.body, edited: n.edited, on: when(n.createdAt) })),
      canApprove: mayApprove(me, { authorId: r.byId, authorRole: r.byRole, approvedAt: r.approvedAt, approvers: approvers.map((a) => ({ userId: a.id, approvedAt: a.approvedAt })) }),
      canEdit: mayEditBank(me, r.byId, approverIds),
      canRemove: mayRemoveBank(me, r.byId),
      isApprover: approverIds.includes(me.id),
    };
  });
  const params = await searchParams;
  const opened = briefs.find((b) => b.id === params.brief);
  const start = opened?.customerId ?? list.find((c) => c.id === params.customer)?.id ?? list[0]?.id ?? null;
  const approverChoices: Record<string, { id: string; name: string }[]> = {};
  for (const a of access) (approverChoices[a.customerId] ??= []).push({ id: a.id, name: a.name });

  return (
    <BankView
      customers={list}
      briefs={briefs}
      start={start}
      openBrief={opened?.id ?? null}
      staff={staff}
      meId={me.id}
      approverChoices={approverChoices}
      template={template.map((f) => ({ id: f.id, label: locale === "en" && f.labelEn ? f.labelEn : f.label, hint: locale === "en" && f.hintEn ? f.hintEn : f.hint, type: f.type, visible: f.visible }))}
      t={t.bank}
      tasksT={t.tasks}
      errors={t.errors}
    />
  );
}
