import Image from "next/image";
import type { Dictionary, Locale } from "@/i18n/dictionaries";
import { NotificationBell } from "./notification-bell";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toLocaleUpperCase("az");
}

/** Notifications and the logged-in person (the language is chosen in Settings). On phones, also the logo. */
export function TopBar({
  name,
  roleLabel,
  locale,
  unread,
  notificationsT,
}: {
  name: string;
  roleLabel: string;
  locale: Locale;
  unread: number;
  notificationsT: Dictionary["notifications"];
}) {
  return (
    <div className="flex items-center justify-end gap-2.5">
      <Image src="/logo-mark.png" alt="Zeyn Media" width={256} height={256} className="mr-auto size-[44px] rounded-[15px] lg:hidden" />
      <NotificationBell initialUnread={unread} locale={locale} t={notificationsT} />
      <div className="flex h-[52px] items-center gap-2.5 rounded-full bg-surface py-1.5 pl-1.5 pr-4">
        <span className="flex size-10 items-center justify-center rounded-full bg-teal text-[13px] font-semibold text-white">{initials(name)}</span>
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">{name}</span>
          <span className="text-xs text-muted">{roleLabel}</span>
        </span>
      </div>
    </div>
  );
}
