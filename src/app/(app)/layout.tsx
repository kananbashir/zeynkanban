import { after } from "next/server";
import { unreadCount } from "@/app/actions/notifications";
import { Suspense } from "react";
import { MeProvider } from "@/components/me";
import { Rail } from "@/components/rail";
import { TaskPeek } from "@/components/task-peek";
import { TopBar } from "@/components/top-bar";
import { getDictionary } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { runDailyJobs } from "@/lib/daily";
import { runReminders } from "@/lib/reminders";
import { ABOUT, navFor } from "@/lib/roles";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { locale, t } = await getDictionary();
  // The 09:00 job and task reminders also start from here, in case the hosting put the server to sleep.
  after(() => runDailyJobs().catch((error) => console.error("daily jobs", error)));
  after(() => runReminders().catch((error) => console.error("reminders", error)));
  const unread = await unreadCount();
  const items = navFor(user.role).map((item) => ({ key: item.key, href: item.href, label: t.nav[item.key], short: t.nav.short[item.key] }));
  const about = { ...ABOUT, label: t.nav.about, short: t.nav.short.about };

  return (
    <div className="p-2 pb-[calc(92px+env(safe-area-inset-bottom))] lg:p-5">
      <div className="mx-auto flex max-w-[1480px] flex-wrap items-stretch gap-4 rounded-[32px] bg-mint p-3.5 lg:min-h-[calc(100vh-40px)] lg:flex-nowrap lg:gap-6 lg:p-6">
        <Rail items={items} about={about} logoutLabel={t.nav.logout} mainLabel={t.nav.main} />
        <div className="flex min-w-0 flex-1 basis-full flex-col gap-5 lg:basis-0">
          <TopBar
            name={user.name}
            roleLabel={t.roles[user.role]}
            locale={locale}
            unread={unread}
            notificationsT={t.notifications}
          />
          <MeProvider me={{ id: user.id, name: user.name }}>
            {children}
            <Suspense fallback={null}>
              <TaskPeek t={t.tasks} errors={t.errors} />
            </Suspense>
          </MeProvider>
        </div>
      </div>
    </div>
  );
}
