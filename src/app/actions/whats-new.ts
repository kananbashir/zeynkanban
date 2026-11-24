"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { appVersion } from "@/lib/version";

/** Remembers (for this person, on every device) that they have seen what's new in the running version. */
export async function markWhatsNewSeen(): Promise<{ ok: true }> {
  const me = await requireUser();
  await db.update(users).set({ seenVersion: appVersion().version }).where(eq(users.id, me.id));
  return { ok: true };
}
