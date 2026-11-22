"use server";

import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { ErrorKey } from "@/i18n/dictionaries";
import { encryptCode, generateCode, hashCode } from "@/lib/codes";
import { cleanName } from "@/lib/settings-rules";

export type SetupState = { code: string | null; error: ErrorKey | "taken" | null };

/**
 * Creates the first admin, only while nobody has an account. The check and the insert happen in one
 * locked transaction, so two people opening the page at the same moment can't both become admin.
 */
export async function createFirstAdmin(_previous: SetupState, formData: FormData): Promise<SetupState> {
  const clean = cleanName(formData.get("name"));
  if (!clean.ok) return { code: null, error: clean.error };
  const code = generateCode();
  const created = await db.transaction(async (tx) => {
    const [rows] = (await tx.execute(sql`select count(*) as n from ${users} for update`)) as unknown as [{ n: number | string }[]];
    if (Number(rows[0]?.n ?? 0) > 0) return false;
    await tx.insert(users).values({ id: randomUUID(), name: clean.value, role: "admin", codeHash: hashCode(code), codeSecret: encryptCode(code) });
    return true;
  });
  return created ? { code, error: null } : { code: null, error: "taken" };
}
