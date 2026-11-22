import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt } from "node:crypto";

export const CODE_LENGTH = 8;

// Letters, digits and symbols, without look-alikes such as 0/O and 1/l/I.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?";

/** A new random access code. Stored as a hash (to log in) and encrypted (so an admin can show it). */
export function generateCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 16) throw new Error("AUTH_SECRET is missing or too short. See .env.example.");
  return value;
}

/**
 * What we store for a code. People log in with the code alone, so the stored value must be
 * the same every time for the same code (to find the person), and useless without AUTH_SECRET.
 */
export function hashCode(code: string): string {
  return createHmac("sha256", secret()).update(code, "utf8").digest("hex");
}

// An encrypted copy of each code lets an admin show it again (Settings → Users). The key is made
// from AUTH_SECRET, so the copy is useless without it; logging in still uses the hash above.
const codeKey = () => createHash("sha256").update(`zeynkanban:access-code:${secret()}`).digest();

export function encryptCode(code: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", codeKey(), iv);
  const body = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

/** The code back, or null if there is no copy or it can't be read (e.g. AUTH_SECRET was changed). */
export function decryptCode(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    const raw = Buffer.from(stored, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", codeKey(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function isWellFormedCode(code: string): boolean {
  return code.length === CODE_LENGTH && !/\s/.test(code);
}

/** A new session cookie value and the hash stored for it. */
export function newSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
