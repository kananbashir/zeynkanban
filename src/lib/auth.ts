import "server-only";
import { redirect } from "next/navigation";
import type { Role } from "@/db/schema";
import { homeFor } from "./roles";
import { getCurrentUser, type CurrentUser } from "./session";

/** Use at the top of any page or action that needs a logged-in person. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Use at the top of any page or action limited to certain roles. Others are sent to their own first page. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}
