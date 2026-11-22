import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { contents, contentTypes, specialDays, statuses, taskTypes, users } from "@/db/schema";
import { getDictionary } from "@/i18n/server";
import { requireRole } from "@/lib/auth";
import { ContentTypesSection } from "./content-types-section";
import { SpecialDaysSection } from "./special-days-section";
import { StatusesSection } from "./statuses-section";
import { TaskTypesSection } from "./task-types-section";
import { UsersSection } from "./users-section";

const SECTIONS = ["users", "statuses", "types", "content", "days"] as const;
type Section = (typeof SECTIONS)[number];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const me = await requireRole("admin");
  const { t } = await getDictionary();
  const requested = (await searchParams).section;
  const section: Section = (SECTIONS as readonly string[]).includes(requested ?? "") ? (requested as Section) : "users";

  const counts = await Promise.all([
    db.$count(users, undefined),
    db.$count(statuses, isNull(statuses.deletedAt)),
    db.$count(taskTypes, and(isNull(taskTypes.deletedAt), eq(taskTypes.oneOff, false))),
    db.$count(contentTypes, undefined),
    db.$count(specialDays, undefined),
  ]);

  let content: React.ReactNode = null;
  if (section === "users") {
    const list = await db
      .select({ id: users.id, name: users.name, role: users.role, active: users.active })
      .from(users)
      .orderBy(desc(users.active), asc(users.createdAt));
    content = <UsersSection users={list} meId={me.id} t={t.settings} errors={t.errors} roles={t.roles} />;
  } else if (section === "statuses") {
    const list = await db
      .select({ id: statuses.id, name: statuses.name, color: statuses.color, isFinished: statuses.isFinished, notifyReview: statuses.notifyReview })
      .from(statuses)
      .where(isNull(statuses.deletedAt))
      .orderBy(asc(statuses.position), asc(statuses.createdAt));
    content = <StatusesSection statuses={list} t={t.settings} errors={t.errors} />;
  } else if (section === "types") {
    const list = await db
      .select({ id: taskTypes.id, name: taskTypes.name, isPublishing: taskTypes.isPublishing })
      .from(taskTypes)
      .where(and(isNull(taskTypes.deletedAt), eq(taskTypes.oneOff, false)))
      .orderBy(asc(taskTypes.position), asc(taskTypes.createdAt));
    content = <TaskTypesSection types={list} t={t.settings} errors={t.errors} />;
  } else if (section === "content") {
    const [types, usage] = await Promise.all([
      db
        .select({ id: contentTypes.id, code: contentTypes.code, name: contentTypes.name, archived: contentTypes.archived })
        .from(contentTypes)
        .orderBy(asc(contentTypes.archived), asc(contentTypes.createdAt)),
      db
        .select({ contentTypeId: contents.contentTypeId, used: sql<number>`count(*)`.mapWith(Number) })
        .from(contents)
        .groupBy(contents.contentTypeId),
    ]);
    const usedBy = new Map(usage.map((u) => [u.contentTypeId, u.used]));
    const list = types.map((type) => ({ ...type, used: usedBy.get(type.id) ?? 0 }));
    content = <ContentTypesSection types={list} t={t.settings} errors={t.errors} />;
  } else {
    const list = await db
      .select({ id: specialDays.id, date: specialDays.date, name: specialDays.name, kind: specialDays.kind, yearly: specialDays.yearly })
      .from(specialDays)
      .orderBy(asc(specialDays.date), asc(specialDays.createdAt));
    content = <SpecialDaysSection days={list} t={t.settings} errors={t.errors} />;
  }

  return (
    <main className="flex flex-col gap-5">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-teal-deep">{t.settings.eyebrow}</span>
        <h1 className="text-[28px] font-semibold leading-tight">{t.nav.settings}</h1>
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <nav
          aria-label={t.settings.sectionsLabel}
          className="flex min-w-0 flex-[1_1_240px] flex-col gap-1 rounded-[28px] bg-white p-3 lg:max-w-[300px]"
        >
          {SECTIONS.map((key, i) => {
            const active = key === section;
            return (
              <Link
                key={key}
                href={{ pathname: "/settings", query: { section: key } }}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[52px] items-center gap-3 rounded-[18px] px-3.5 py-1.5 text-[15px] font-semibold ${active ? "bg-teal text-white" : "text-ink hover:bg-mint"}`}
              >
                <span className="min-w-0 flex-1">{t.settings.sections[key]}</span>
                <span className="text-[13px] font-medium">{counts[i]}</span>
              </Link>
            );
          })}
        </nav>
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">{content}</div>
      </div>
    </main>
  );
}
