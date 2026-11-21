import Image from "next/image";
import { redirect } from "next/navigation";
import { LanguageSwitch } from "@/components/language-switch";
import { getDictionary } from "@/i18n/server";
import { homeFor } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./login-form";

const SAMPLE_CARDS = [
  { id: "thrive-vid-nd26-2", customer: "Thrive", bg: "bg-pastel-pink", dot: "bg-status-blue", indent: "" },
  { id: "caspfit-gpost-nd26-6", customer: "Caspian Fit", bg: "bg-pastel-blue", dot: "bg-status-amber", indent: "ml-7" },
  { id: "nar-gpost-nd26-3", customer: "Nar Café", bg: "bg-pastel-peach", dot: "bg-status-teal", indent: "" },
];

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  const { locale, t } = await getDictionary();

  return (
    <div className="flex min-h-screen p-2 md:p-5">
      <div className="mx-auto flex w-full max-w-[1480px] flex-wrap items-stretch gap-3.5 rounded-[32px] bg-mint p-3.5 md:gap-6 md:p-6">
        <section
          aria-hidden="true"
          className="hidden min-w-0 flex-[1_1_440px] flex-col justify-between gap-9 rounded-[28px] bg-forest p-11 text-white md:flex"
        >
          <div className="flex max-w-[460px] flex-col gap-3.5">
            <Image src="/logo-full.png" alt="" width={720} height={451} priority className="-ml-2 -mt-2 mb-2.5 h-auto w-[230px]" />
            <h2 className="text-balance text-[40px] font-semibold leading-[1.1]">{t.login.tagline}</h2>
            <p className="text-base leading-[1.55] text-teal-tint">{t.login.taglineSub}</p>
          </div>
          <div className="flex max-w-[480px] flex-col gap-3">
            {SAMPLE_CARDS.map((card, i) => (
              <div key={card.id} className={`flex flex-col gap-2.5 rounded-[22px] px-[18px] py-4 text-ink ${card.bg} ${card.indent}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-white px-2 py-1 font-mono text-xs font-medium">{card.id}</span>
                  <span className="text-[13px] font-semibold">{card.customer}</span>
                  <span className="ml-auto flex items-center gap-1.5 rounded-full bg-white px-2.5 py-[5px] text-xs font-semibold">
                    <span className={`size-2 rounded-full ${card.dot}`} />
                    {t.login.samples[i].status}
                  </span>
                </div>
                <span className="text-lg font-semibold">{t.login.samples[i].type}</span>
              </div>
            ))}
          </div>
        </section>

        <main className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
          <div className="flex justify-end">
            <LanguageSwitch locale={locale} label={t.common.language} />
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="flex w-full max-w-[460px] flex-col gap-6 rounded-[28px] bg-white px-5 py-[26px] md:p-10">
              <div className="flex items-center gap-3">
                <Image src="/logo-mark.png" alt="" width={256} height={256} className="size-[52px] rounded-[18px]" />
                <span className="text-lg font-semibold">{t.brand}</span>
              </div>
              <LoginForm t={t.login} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
