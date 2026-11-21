import type { Role } from "@/db/schema";

/** The first page a person sees after logging in. */
export function homeFor(role: Role): string {
  return role === "employee" ? "/my-tasks" : "/dashboard";
}

export type NavKey = "dashboard" | "board" | "customers" | "myTasks" | "settings";

export const NAV: { key: NavKey; href: string; roles: Role[] }[] = [
  { key: "dashboard", href: "/dashboard", roles: ["admin", "manager"] },
  { key: "board", href: "/board", roles: ["admin", "manager"] },
  { key: "customers", href: "/customers", roles: ["admin", "manager"] },
  { key: "myTasks", href: "/my-tasks", roles: ["admin", "manager", "employee"] },
  { key: "settings", href: "/settings", roles: ["admin"] },
];

export function navFor(role: Role) {
  return NAV.filter((item) => item.roles.includes(role));
}
