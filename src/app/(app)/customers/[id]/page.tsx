import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { getDictionary } from "@/i18n/server";
import { fill } from "@/i18n/format";
import { requireRole } from "@/lib/auth";
import { formatPeriod, parseMonth, periodCode } from "@/lib/content-rules";
import { activeContentTypes, contentsOf, contractsOf } from "@/lib/customers";
import { ContentsTab } from "./contents-tab";
import { InfoTab } from "./info-tab";
import { RestoreCustomer } from "./restore-customer";

const TABS = ["tasks", "contents", "info"] as const;
type Tab = (typeof TABS)[number];

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireRole("admin", "manager");
  const { id } = await params;
  const requested = (await searchParams).tab;
  const tab: Tab = (TABS as readonly string[]).includes(requested ?? "") ? (requested as Tab) : "contents";
  const { t } = await getDictionary();
  const c = t.customers;

  const [customer] = await db.select().from(customers).where(eq(customers.id, id));
  if (!customer) notFound();
  const [contractRows, contentRows, types] = await Promise.all([contractsOf(id), contentsOf(id), activeContentTypes()]);

  const periods = contractRows.map((row) => {
    const start = parseMonth(row.startMonth)!;
    const end = parseMonth(row.endMonth)!;
    return { id: row.id, start: row.startMonth.slice(0, 7), end: row.endMonth.slice(0, 7), label: formatPeriod(start, end, c.months), code: periodCode(start, end) };
  });
  const current = periods[0];
  const activeCount = contentRows.filter((x) => !x.archived).length;
  const admin = user.role === "admin";

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-x-[18px] gap-y-3.5 rounded-[28px] bg-white p-4 md:px-[22px] md:py-5">
        <div className="flex min-w-0 flex-[1_1_260px] items-center gap-3.5">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-[18px] text-[22px] font-bold text-ink" style={{ background: customer.color }}>
            {customer.name.charAt(0).toLocaleUpperCase("az")}
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="text-[22px] font-semibold leading-tight md:text-[28px]">{customer.name}</h1>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13px] text-ink-soft">
              <span className="rounded-lg bg-mint px-2 py-1 font-mono text-xs font-medium text-ink">{customer.shortName}</span>
              <span>{fill(c.summary, { contents: activeCount, period: current ? current.label : c.noContract })}</span>
            </div>
          </div>
        </div>
        <nav aria-label={customer.name} className="flex gap-1 rounded-full bg-mint p-1">
          {TABS.map((key) => {
            const active = key === tab;
            return (
              <Link
                key={key}
                href={{ pathname: `/customers/${id}`, query: { tab: key } }}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center whitespace-nowrap rounded-full px-3 text-[13px] font-semibold md:px-[18px] md:text-sm ${active ? "bg-white text-ink shadow-[0_1px_3px_rgba(24,35,47,0.14)]" : "text-ink-soft"}`}
              >
                {c.tabs[key]}
              </Link>
            );
          })}
        </nav>
      </header>

      {customer.archived && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-[22px] bg-sun-tint px-4 py-3 text-sm text-sun-ink">
          <span className="flex-[1_1_260px]">{c.archivedBanner}</span>
          {admin && <RestoreCustomer id={id} label={c.restore} errors={t.errors} />}
        </div>
      )}

      {tab === "tasks" && <section className="rounded-[28px] bg-white px-4 py-12 text-center text-sm text-muted md:px-6">{c.tasksSoon}</section>}

      {tab === "contents" && (
        <ContentsTab
          customerId={id}
          shortName={customer.shortName}
          periods={periods}
          contents={contentRows}
          types={types}
          canArchive={admin}
          t={c.contents}
          errors={t.errors}
        />
      )}

      {tab === "info" && (
        <InfoTab
          customerId={id}
          name={customer.name}
          archived={customer.archived}
          info={{
            name: customer.name,
            shortName: customer.shortName,
            contactPerson: customer.contactPerson,
            phone: customer.phone,
            email: customer.email,
            social: customer.social,
            notes: customer.notes ?? "",
          }}
          periods={periods}
          isAdmin={admin}
          t={c}
          errors={t.errors}
        />
      )}
    </main>
  );
}
