import { getDictionary } from "@/i18n/server";
import { requireRole } from "@/lib/auth";
import { dashboardData } from "@/lib/dashboard";
import { periodOf } from "@/lib/dashboard-rules";
import { isIsoDateString, todayIso } from "@/lib/dates";
import { allSpecialDays } from "@/lib/tasks";
import { DashboardView } from "./dashboard-view";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ view?: string; d?: string }> }) {
  await requireRole("admin", "manager");
  const { t } = await getDictionary();
  const params = await searchParams;
  const today = todayIso();
  const period = periodOf(params.view === "week" ? "week" : "month", isIsoDateString(params.d) ? params.d : today);
  const [data, specialDays] = await Promise.all([dashboardData(period, today), allSpecialDays()]);
  return <DashboardView period={period} today={today} data={data} specialDays={specialDays} t={t.dashboard} taskT={t.tasks} months={t.customers.months} />;
}
