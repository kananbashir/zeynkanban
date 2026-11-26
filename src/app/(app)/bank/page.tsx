import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { bankBriefs, briefFields, contentBriefs, contents, customers, users } from "@/db/schema";
import { getDictionary } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { parseBrief } from "@/lib/brief-rules";
import { bankCustomerIds } from "@/lib/briefs";
import { dateInZone } from "@/lib/dates";
import { shortDate } from "@/lib/format-date";
import { homeFor, isStaff, writesBriefs } from "@/lib/roles";
import { BankView, type BankCard } from "./bank-view";

/**
 * Content bank: briefs written ahead for a customer, picked later for a content ID from the brief
 * window. Admins and managers see everyone's; employees only their own, for the customers ticked for
 * them in Settings → Users. Graphic designers can't open it.
 */
export default async function BankPage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const me = await requireUser();
  if (!writesBriefs(me.role)) redirect(homeFor(me.role));
  const { t, locale } = await getDictionary();
  const allowed = await bankCustomerIds(me);
  const staff = isStaff(me.role);

  const [list, rows, template] = await Promise.all([
    allowed.length ? db.select({ id: customers.id, name: customers.name, color: customers.color }).from(customers).where(inArray(customers.id, allowed)).orderBy(asc(customers.name)) : [],
    allowed.length
      ? db
          .select({ id: bankBriefs.id, customerId: bankBriefs.customerId, title: bankBriefs.title, fields: bankBriefs.fields, byId: bankBriefs.createdBy, by: users.name, createdAt: bankBriefs.createdAt, usedFor: contents.code })
          .from(bankBriefs)
          .innerJoin(users, eq(users.id, bankBriefs.createdBy))
          .leftJoin(contentBriefs, eq(contentBriefs.bankBriefId, bankBriefs.id))
          .leftJoin(contents, eq(contents.id, contentBriefs.contentId))
          .where(staff ? inArray(bankBriefs.customerId, allowed) : and(inArray(bankBriefs.customerId, allowed), eq(bankBriefs.createdBy, me.id)))
          .orderBy(desc(bankBriefs.createdAt))
      : [],
    db.select().from(briefFields).orderBy(asc(briefFields.position), asc(briefFields.createdAt)),
  ]);

  const briefs: BankCard[] = rows.map((r) => ({ id: r.id, customerId: r.customerId, title: r.title, fields: parseBrief(r.fields), byId: r.byId, by: r.by, on: shortDate(dateInZone(r.createdAt), t.tasks), usedFor: r.usedFor }));
  const params = await searchParams;
  const start = list.find((c) => c.id === params.customer)?.id ?? list[0]?.id ?? null;

  return (
    <BankView
      customers={list}
      briefs={briefs}
      start={start}
      staff={staff}
      template={template.map((f) => ({ id: f.id, label: locale === "en" && f.labelEn ? f.labelEn : f.label, hint: locale === "en" && f.hintEn ? f.hintEn : f.hint, type: f.type, visible: f.visible }))}
      t={t.bank}
      tasksT={t.tasks}
      errors={t.errors}
    />
  );
}
