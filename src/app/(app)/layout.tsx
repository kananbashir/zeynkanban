import { Rail } from "@/components/rail";
import { TopBar } from "@/components/top-bar";
import { getDictionary } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { navFor } from "@/lib/roles";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { locale, t } = await getDictionary();
  const items = navFor(user.role).map((item) => ({ key: item.key, href: item.href, label: t.nav[item.key] }));

  return (
    <div className="p-2 lg:p-5">
      <div className="mx-auto flex max-w-[1480px] flex-wrap items-stretch gap-4 rounded-[32px] bg-mint p-3.5 lg:min-h-[calc(100vh-40px)] lg:flex-nowrap lg:gap-6 lg:p-6">
        <Rail items={items} logoutLabel={t.nav.logout} mainLabel={t.nav.main} />
        <div className="flex min-w-0 flex-1 basis-full flex-col gap-5 lg:basis-0">
          <TopBar
            name={user.name}
            roleLabel={t.roles[user.role]}
            locale={locale}
            languageLabel={t.common.language}
            notificationsLabel={t.common.notifications}
          />
          {children}
        </div>
      </div>
    </div>
  );
}
