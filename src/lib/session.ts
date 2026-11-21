import "server-only";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { sessions, users, type Role } from "@/db/schema";
import { hashToken, newSessionToken } from "./codes";

const COOKIE = "zk_session";
const HOUR = 60 * 60 * 1000;
const SHORT_SESSION = 12 * HOUR; // "Keep me logged in" not ticked
const LONG_SESSION = 30 * 24 * HOUR; // ticked

export type CurrentUser = { id: string; name: string; role: Role };

export async function createSession(userId: string, remember: boolean) {
  const { token, tokenHash } = newSessionToken();
  const expiresAt = new Date(Date.now() + (remember ? LONG_SESSION : SHORT_SESSION));
  await db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())));
  await db.insert(sessions).values({ tokenHash, userId, expiresAt });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Without "expires" the cookie disappears when the browser is closed.
    ...(remember ? { expires: expiresAt } : {}),
  });
}

/** The logged-in person, or null. Checked against the database on every request, so deactivating someone takes effect at once. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date()), eq(users.active, true)))
    .limit(1);
  return rows[0] ?? null;
});

/** Ends every session of a person, except the one making the request (so an admin renewing their own code stays logged in here). */
export async function endSessionsOf(userId: string) {
  const token = (await cookies()).get(COOKIE)?.value;
  const keep = token ? hashToken(token) : null;
  await db
    .delete(sessions)
    .where(keep ? and(eq(sessions.userId, userId), ne(sessions.tokenHash, keep)) : eq(sessions.userId, userId));
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  store.delete(COOKIE);
}

export const SESSION_COOKIE = COOKIE;
