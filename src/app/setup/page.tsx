import Image from "next/image";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { LanguageSwitch } from "@/components/language-switch";
import { getDictionary } from "@/i18n/server";
import { SetupForm } from "./setup-form";

/** First-run page: lets the very first admin be created on a fresh installation, then closes for good. */
export default async function SetupPage() {
  if ((await db.$count(users)) > 0) redirect("/login");
  const { locale, t } = await getDictionary();
  return (
    <div className="flex min-h-screen p-2 md:p-5">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 rounded-[32px] bg-mint p-3.5 md:p-6">
        <div className="flex justify-end">
          <LanguageSwitch locale={locale} label={t.common.language} />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-[460px] flex-col gap-6 rounded-[28px] bg-surface px-5 py-[26px] md:p-10">
            <div className="flex items-center gap-3">
              <Image src="/logo-mark.png" alt="" width={256} height={256} className="size-[52px] rounded-[18px]" />
              <span className="text-lg font-semibold">{t.brand}</span>
            </div>
            <SetupForm t={t.setup} errors={t.errors} copyLabels={{ copy: t.settings.users.copy, copied: t.settings.users.copied, copyFailed: t.settings.users.copyFailed }} />
          </div>
        </div>
      </div>
    </div>
  );
}
