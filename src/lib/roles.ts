import type { Role } from "@/db/schema";

/** The first page a person sees after logging in. */
/** Where someone lands after logging in: everyone starts on their dashboard. */
export function homeFor(_role: Role): string { // eslint-disable-line @typescript-eslint/no-unused-vars
  return "/dashboard";
}

export type NavKey = "dashboard" | "board" | "customers" | "myTasks" | "settings" | "about";

export const NAV: { key: NavKey; href: string; roles: Role[] }[] = [
  { key: "dashboard", href: "/dashboard", roles: ["admin", "manager", "employee"] },
  { key: "board", href: "/board", roles: ["admin", "manager"] },
  { key: "customers", href: "/customers", roles: ["admin", "manager"] },
  { key: "myTasks", href: "/my-tasks", roles: ["admin", "manager", "employee"] },
  { key: "settings", href: "/settings", roles: ["admin", "manager", "employee"] },
];

/** Shown at the bottom of the rail on wide screens, and from Settings on phones. */
export const ABOUT = { key: "about" as const, href: "/about" };

export function navFor(role: Role) {
  return NAV.filter((item) => item.roles.includes(role));
}
