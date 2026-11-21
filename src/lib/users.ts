import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { users, type Role } from "@/db/schema";
import { generateCode, hashCode } from "./codes";

/** True when an insert or update hit a unique rule (for example, a content type code already in use). */
export function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; errno?: number; cause?: { code?: string; errno?: number } };
  return e?.code === "ER_DUP_ENTRY" || e?.errno === 1062 || e?.cause?.code === "ER_DUP_ENTRY" || e?.cause?.errno === 1062;
}

/** True when an update or delete matched a row. (MySQL reports matched rows, so saving an unchanged value still counts.) */
export function found(result: unknown): boolean {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number })?.affectedRows ?? 0) > 0;
}

/** Creates a person with a fresh code and returns the code. The code is never stored, only its hash. */
export async function insertUserWithCode(name: string, role: Role): Promise<{ id: string; code: string }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      const id = randomUUID();
      await db.insert(users).values({ id, name, role, codeHash: hashCode(code) });
      return { id, code };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error; // a code collision is astronomically rare; just try again
    }
  }
  throw new Error("Could not create a unique access code.");
}

/** Gives a person a fresh code. Their old code stops working at once. */
export async function replaceCode(userId: string, update: (codeHash: string) => Promise<boolean>): Promise<string | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      return (await update(hashCode(code))) ? code : null;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new Error("Could not create a unique access code.");
}
