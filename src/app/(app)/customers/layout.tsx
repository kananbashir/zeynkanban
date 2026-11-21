import { getDictionary } from "@/i18n/server";
import { requireRole } from "@/lib/auth";
import { customerList } from "@/lib/customers";
import { CustomerList } from "./customer-list";

export default async function CustomersLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("admin", "manager");
  const { t } = await getDictionary();
  const list = await customerList(true);
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
      <CustomerList customers={list} canAdd={user.role === "admin"} t={t.customers} />
      <div className="flex min-w-0 flex-1 flex-col gap-5">{children}</div>
    </div>
  );
}
