import Link from "next/link";
import { redirect } from "next/navigation";
import { btn } from "@/components/ui";
import { getDictionary } from "@/i18n/server";
import { requireRole } from "@/lib/auth";
import { customerList } from "@/lib/customers";

export default async function CustomersPage() {
  const user = await requireRole("admin", "manager");
  const list = await customerList(false);
  if (list.length > 0) redirect(`/customers/${list[0].id}`);
  const { t } = await getDictionary();
  const admin = user.role === "admin";
  return (
    <main className="flex flex-col items-center gap-2 rounded-[28px] bg-surface px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">{t.customers.emptyTitle}</h1>
      <p className="max-w-[48ch] text-sm text-muted">{admin ? t.customers.emptyAdmin : t.customers.emptyManager}</p>
      {admin && (
        <Link href="/customers/new" className={`${btn.primary} mt-3`}>
          {t.customers.add}
        </Link>
      )}
    </main>
  );
}
