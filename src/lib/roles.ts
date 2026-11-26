import type { Role } from "@/db/schema";

/** Where someone lands after logging in: everyone starts on their dashboard. */
export function homeFor(_role: Role): string { // eslint-disable-line @typescript-eslint/no-unused-vars
  return "/dashboard";
}

/** Admins and managers: they see everyone's work. Employees and graphic designers see only their own. */
export function isStaff(role: string): boolean {
  return role === "admin" || role === "manager";
}

/** May write content briefs (on task cards and in the Content bank): everyone but graphic designers. */
export function writesBriefs(role: string): boolean {
  return role !== "designer";
}

export type NavKey = "dashboard" | "board" | "customers" | "myTasks" | "bank" | "settings" | "about";

const ALL: Role[] = ["admin", "manager", "employee", "designer"];

/** `bar`: also in the phone's bottom bar (Settings is in the profile panel there). */
export const NAV: { key: NavKey; href: string; roles: Role[]; bar: boolean }[] = [
  { key: "dashboard", href: "/dashboard", roles: ALL, bar: true },
  { key: "board", href: "/board", roles: ["admin", "manager"], bar: true },
  { key: "customers", href: "/customers", roles: ["admin", "manager"], bar: true },
  { key: "myTasks", href: "/my-tasks", roles: ALL, bar: true },
  { key: "bank", href: "/bank", roles: ["admin", "manager", "employee"], bar: true },
  { key: "settings", href: "/settings", roles: ALL, bar: false },
];

/** Shown at the bottom of the rail on wide screens, and from Settings on phones. */
export const ABOUT = { key: "about" as const, href: "/about" };

export function navFor(role: Role) {
  return NAV.filter((item) => item.roles.includes(role));
}
