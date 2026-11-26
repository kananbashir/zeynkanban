import { getDictionary } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { dashboardData } from "@/lib/dashboard";
import { periodOf } from "@/lib/dashboard-rules";
import { isIsoDateString, todayIso } from "@/lib/dates";
import { allSpecialDays } from "@/lib/tasks";
import { DashboardView } from "./dashboard-view";
import { isStaff } from "@/lib/roles";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ view?: string; d?: string }> }) {
  // Admins and managers see everyone's tasks; an employee only their own.
  const me = await requireUser();
  const { t, locale } = await getDictionary();
  const params = await searchParams;
  const today = todayIso();
  const period = periodOf(params.view === "week" ? "week" : "month", isIsoDateString(params.d) ? params.d : today);
  const [data, specialDays] = await Promise.all([dashboardData(period, today, locale, isStaff(me.role) ? undefined : me.id), allSpecialDays()]);
  return <DashboardView period={period} today={today} data={data} specialDays={specialDays} t={t.dashboard} taskT={t.tasks} months={t.customers.months} />;
}
