import type { Dictionary, Locale } from "@/i18n/dictionaries";
import { LanguageSwitch } from "./language-switch";
import { NotificationBell } from "./notification-bell";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toLocaleUpperCase("az");
}

/** Language, notifications and the logged-in person. Shown on every page inside the app. */
export function TopBar({
  name,
  roleLabel,
  locale,
  languageLabel,
  unread,
  notificationsT,
}: {
  name: string;
  roleLabel: string;
  locale: Locale;
  languageLabel: string;
  unread: number;
  notificationsT: Dictionary["notifications"];
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2.5">
      <LanguageSwitch locale={locale} label={languageLabel} />
      <NotificationBell initialUnread={unread} locale={locale} t={notificationsT} />
      <div className="flex h-[52px] items-center gap-2.5 rounded-full bg-white py-1.5 pl-1.5 pr-4">
        <span className="flex size-10 items-center justify-center rounded-full bg-teal text-[13px] font-semibold text-white">{initials(name)}</span>
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">{name}</span>
          <span className="text-xs text-muted">{roleLabel}</span>
        </span>
      </div>
    </div>
  );
}
