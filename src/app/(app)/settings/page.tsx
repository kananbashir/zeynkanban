import { ComingSoon } from "@/components/coming-soon";
import { getDictionary } from "@/i18n/server";
import { requireRole } from "@/lib/auth";

export default async function Page() {
  await requireRole("admin");
  const { t } = await getDictionary();
  return <ComingSoon title={t.nav.settings} heading={t.common.comingTitle} text={t.common.comingText} />;
}
