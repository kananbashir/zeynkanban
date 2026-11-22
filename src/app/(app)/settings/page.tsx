import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import Link from "next/link";
import { Fragment } from "react";
import { db } from "@/db";
import { contents, contentTypes, specialDays, statuses, taskTypes, users } from "@/db/schema";
import { getDictionary } from "@/i18n/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { DEFAULT_THEME, isTheme, THEME_COOKIE } from "@/lib/theme";
import { PreferencesSection } from "./preferences-section";
import { ContentTypesSection } from "./content-types-section";
import { SpecialDaysSection } from "./special-days-section";
import { StatusesSection } from "./statuses-section";
import { TaskTypesSection } from "./task-types-section";
import { UsersSection } from "./users-section";

const ADMIN_SECTIONS = ["users", "statuses", "types", "content", "days"] as const;
type Section = (typeof ADMIN_SECTIONS)[number] | "preferences";

/** Admins: everything. Everyone else: only their own appearance and language. */
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const me = await requireUser();
  const admin = me.role === "admin";
  const { locale, t } = await getDictionary();
  const requested = (await searchParams).section;
  const allowed: Section[] = admin ? [...ADMIN_SECTIONS, "preferences"] : ["preferences"];
  const section: Section = allowed.includes(requested as Section) ? (requested as Section) : admin ? "users" : "preferences";

  const counts = admin
    ? await Promise.all([
        db.$count(users, undefined),
        db.$count(statuses, isNull(statuses.deletedAt)),
        db.$count(taskTypes, and(isNull(taskTypes.deletedAt), eq(taskTypes.oneOff, false))),
        db.$count(contentTypes, undefined),
        db.$count(specialDays, undefined),
      ])
    : [];

  let content: React.ReactNode = null;
  if (section === "preferences") {
    const saved = (await cookies()).get(THEME_COOKIE)?.value;
    content = <PreferencesSection theme={isTheme(saved) ? saved : DEFAULT_THEME} locale={locale} t={t.settings} nav={t.nav} />;
  } else if (section === "users") {
    const list = await db
      .select({ id: users.id, name: users.name, role: users.role, active: users.active })
      .from(users)
      .orderBy(desc(users.active), asc(users.createdAt));
    content = <UsersSection users={list} meId={me.id} t={t.settings} errors={t.errors} roles={t.roles} />;
  } else if (section === "statuses") {
    const list = await db
      .select({ id: statuses.id, name: statuses.name, nameEn: statuses.nameEn, color: statuses.color, isFinished: statuses.isFinished, notifyReview: statuses.notifyReview })
      .from(statuses)
      .where(isNull(statuses.deletedAt))
      .orderBy(asc(statuses.position), asc(statuses.createdAt));
    content = <StatusesSection statuses={list} locale={locale} t={t.settings} errors={t.errors} />;
  } else if (section === "types") {
    const list = await db
      .select({ id: taskTypes.id, name: taskTypes.name, nameEn: taskTypes.nameEn, isPublishing: taskTypes.isPublishing })
      .from(taskTypes)
      .where(and(isNull(taskTypes.deletedAt), eq(taskTypes.oneOff, false)))
      .orderBy(asc(taskTypes.position), asc(taskTypes.createdAt));
    content = <TaskTypesSection types={list} locale={locale} t={t.settings} errors={t.errors} />;
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
      .select({ id: specialDays.id, date: specialDays.date, name: specialDays.name, nameEn: specialDays.nameEn, kind: specialDays.kind, yearly: specialDays.yearly })
      .from(specialDays)
      .orderBy(asc(specialDays.date), asc(specialDays.createdAt));
    content = <SpecialDaysSection days={list} t={t.settings} errors={t.errors} />;
  }

  const heading = (
    <div className="flex flex-col gap-0.5">
      <span className="text-[13px] font-semibold text-teal-deep">{section === "preferences" ? t.settings.eyebrowAll : t.settings.eyebrow}</span>
      <h1 className="text-[28px] font-semibold leading-tight">{t.nav.settings}</h1>
    </div>
  );
  if (!admin) {
    return (
      <main className="flex flex-col gap-5">
        {heading}
        {content}
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-5">
      {heading}
      <div className="flex flex-wrap items-start gap-6">
        <nav
          aria-label={t.settings.sectionsLabel}
          className="flex min-w-0 flex-[1_1_240px] flex-col gap-1 rounded-[28px] bg-surface p-3 lg:max-w-[300px]"
        >
          {allowed.map((key, i) => {
            const active = key === section;
            return (
              <Fragment key={key}>
              {key === "preferences" && <div aria-hidden="true" className="mx-2 my-1.5 border-t border-line" />}
              <Link
                href={{ pathname: "/settings", query: { section: key } }}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[52px] items-center gap-3 rounded-[18px] px-3.5 py-1.5 text-[15px] font-semibold transition-colors ${active ? "bg-teal text-white" : "text-ink hover:bg-mint"}`}
              >
                <span className="min-w-0 flex-1">{t.settings.sections[key]}</span>
                {counts[i] !== undefined && <span className="text-[13px] font-medium">{counts[i]}</span>}
              </Link>
              </Fragment>
            );
          })}
        </nav>
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">{content}</div>
      </div>
    </main>
  );
}
