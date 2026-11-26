import Image from "next/image";
import { Icon } from "@/components/icons";
import { VersionList } from "@/components/version-list";
import type { Role } from "@/db/schema";
import type { Dictionary } from "@/i18n/dictionaries";
import { getDictionary } from "@/i18n/server";
import { fill } from "@/i18n/format";
import { requireUser } from "@/lib/auth";
import { appVersion } from "@/lib/version";
import { localRelease, releasesFor } from "@/lib/whats-new";

/** What the site does, for each role: only the parts that person has. */
const FEATURES: Record<Role, (keyof Dictionary["about"]["features"])[]> = {
  admin: ["dashboardStaff", "board", "customers", "myTasks", "bankStaff", "notifications", "settings"],
  manager: ["dashboardStaff", "board", "customers", "myTasks", "bankStaff", "notifications"],
  employee: ["dashboardOwn", "myTasks", "briefs", "bankOwn", "notifications"],
  designer: ["dashboardOwn", "myTasks", "briefsRead", "notifications"],
};

/** About the site: version, what it does for this person's role, privacy, help and What's new. Every role can open it. */
export default async function AboutPage() {
  const me = await requireUser();
  const { t, locale } = await getDictionary();
  const a = t.about;
  const { version, stage } = appVersion();
  const card = "flex flex-col gap-4 rounded-[28px] bg-surface p-5 md:p-7";
  return (
    <main className="flex flex-col gap-5">
      <section className="zk-fade-up flex flex-wrap items-center gap-5 rounded-[28px] bg-surface p-5 md:p-7">
        <Image src="/logo-mark.png" alt="Zeyn Media" width={256} height={256} className="size-[72px] rounded-[22px]" />
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-teal-deep">{a.eyebrow}</span>
          <h1 className="text-[26px] font-semibold leading-tight md:text-[32px]">{a.title}</h1>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className={`rounded-full px-3 py-1 text-[13px] font-bold ${stage === "beta" ? "bg-sun text-ink" : "bg-teal text-white"}`}>{a.stage[stage]}</span>
            <span className="rounded-full bg-mint px-3 py-1 font-mono text-xs font-medium">{fill(a.version, { version })}</span>
          </div>
        </div>
        <p className="basis-full rounded-2xl bg-mint px-4 py-3 text-sm leading-normal text-ink-soft">{stage === "beta" ? a.betaNote : a.productionNote}</p>
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold">{a.featuresTitle}</h2>
        <ul className="grid gap-x-7 gap-y-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
          {FEATURES[me.role].map((key) => {
            const [name, text] = a.features[key];
            return (
              <li key={key} className="flex gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-teal" />
                <span className="text-sm leading-normal">
                  <span className="font-semibold">{name}</span> <span className="text-ink-soft">— {text}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
        <section className={card}>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Icon name="eyeOff" size={18} />
            {a.privacyTitle}
          </h2>
          <p className="text-sm leading-normal text-ink-soft">{a.privacy}</p>
        </section>
        <section className={card}>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Icon name="about" size={18} />
            {a.helpTitle}
          </h2>
          <p className="text-sm leading-normal text-ink-soft">{a.help}</p>
        </section>
      </div>
      <section id="versions" aria-label={t.whatsNew.listTitle} className={`${card} scroll-mt-6`}>
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">{t.whatsNew.listTitle}</h2>
          <p className="text-sm text-ink-soft">{t.whatsNew.listIntro}</p>
        </div>
        <VersionList releases={releasesFor(me.role).map((r) => localRelease(r, locale))} current={version} t={t.whatsNew} />
      </section>
      <p className="px-2 text-center text-xs text-muted">{a.madeFor}</p>
    </main>
  );
}
