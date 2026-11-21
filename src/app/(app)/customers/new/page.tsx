import { getDictionary } from "@/i18n/server";
import { requireRole } from "@/lib/auth";
import { CustomerForm } from "../customer-form";

export default async function NewCustomerPage() {
  await requireRole("admin");
  const { t } = await getDictionary();
  return (
    <main className="flex flex-col gap-5 rounded-[28px] bg-white p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold leading-tight">{t.customers.newTitle}</h1>
        <p className="max-w-[64ch] text-sm text-ink-soft">{t.customers.newIntro}</p>
      </div>
      <CustomerForm mode="create" t={t.customers} errors={t.errors} />
    </main>
  );
}
