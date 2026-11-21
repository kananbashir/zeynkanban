import "server-only";
import { db } from "@/db";
import { users, type Role } from "@/db/schema";
import { generateCode, hashCode } from "./codes";

export function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

/** Creates a person with a fresh code and returns the code. The code is never stored, only its hash. */
export async function insertUserWithCode(name: string, role: Role): Promise<{ id: string; code: string }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      const [row] = await db.insert(users).values({ name, role, codeHash: hashCode(code) }).returning({ id: users.id });
      return { id: row.id, code };
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
