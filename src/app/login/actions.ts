"use server";

import { and, eq, gt, lt } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { loginAttempts, users } from "@/db/schema";
import { hashCode, isWellFormedCode } from "@/lib/codes";
import { homeFor } from "@/lib/roles";
import { createSession, destroySession } from "@/lib/session";

export type LoginState = { error: "invalid" | "tooMany" | null };

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED = 8;

async function clientIp(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const code = String(formData.get("code") ?? "");
  const remember = formData.get("remember") === "on";
  const ip = await clientIp();

  // Slow down guessing: after several wrong codes from one address, refuse for a while.
  const since = new Date(Date.now() - WINDOW_MS);
  const failed = await db.$count(
    loginAttempts,
    and(eq(loginAttempts.ip, ip), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since)),
  );
  if (failed >= MAX_FAILED) return { error: "tooMany" };

  const user = isWellFormedCode(code)
    ? (
        await db
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(and(eq(users.codeHash, hashCode(code)), eq(users.active, true)))
          .limit(1)
      )[0]
    : undefined;

  await db.insert(loginAttempts).values({ ip, success: !!user });
  if (!user) return { error: "invalid" };

  // Housekeeping: forget attempts older than a day.
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
  await createSession(user.id, remember);
  redirect(homeFor(user.role));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
