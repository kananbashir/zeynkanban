"use server";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { ErrorKey } from "@/i18n/dictionaries";
import { generateCode, hashCode } from "@/lib/codes";
import { cleanName } from "@/lib/settings-rules";

export type SetupState = { code: string | null; error: ErrorKey | "taken" | null };

/**
 * Creates the first admin, only while nobody has an account. The insert itself checks that the
 * table is empty, so two people opening the page at the same moment can't both become admin.
 */
export async function createFirstAdmin(_previous: SetupState, formData: FormData): Promise<SetupState> {
  const clean = cleanName(formData.get("name"));
  if (!clean.ok) return { code: null, error: clean.error };
  const code = generateCode();
  const inserted = await db.execute(sql`
    insert into ${users} (name, role, code_hash)
    select ${clean.value}, 'admin', ${hashCode(code)}
    where not exists (select 1 from ${users})
    returning id
  `);
  if (inserted.length === 0) return { code: null, error: "taken" };
  return { code, error: null };
}
