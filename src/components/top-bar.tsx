import Image from "next/image";
import type { Dictionary, Locale } from "@/i18n/dictionaries";
import { NotificationBell } from "./notification-bell";
import { ProfileMenu } from "./profile-menu";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toLocaleUpperCase("az");
}

/** Notifications and the logged-in person, who opens the profile panel (Settings, Log out). On phones, also the logo. */
export function TopBar({
  name,
  roleLabel,
  locale,
  unread,
  notificationsT,
  profileT,
}: {
  name: string;
  roleLabel: string;
  locale: Locale;
  unread: number;
  notificationsT: Dictionary["notifications"];
  profileT: Parameters<typeof ProfileMenu>[0]["t"];
}) {
  return (
    <div className="flex items-center justify-end gap-2.5">
      <Image src="/logo-mark.png" alt="Zeyn Media" width={256} height={256} className="mr-auto size-[44px] rounded-[15px] lg:hidden" />
      <NotificationBell initialUnread={unread} locale={locale} t={notificationsT} />
      <ProfileMenu name={name} initials={initials(name)} roleLabel={roleLabel} t={profileT} />
    </div>
  );
}
