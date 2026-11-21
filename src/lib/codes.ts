import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";

export const CODE_LENGTH = 8;

// Letters, digits and symbols, without look-alikes such as 0/O and 1/l/I.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?";

/** A new random access code. It is shown once and never stored. */
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
