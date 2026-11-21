import { beforeAll, describe, expect, it } from "vitest";
import { CODE_LENGTH, generateCode, hashCode, hashToken, isWellFormedCode, newSessionToken } from "./codes";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-test-secret-test-secret";
});

describe("access codes", () => {
  it("generates 8-character codes without spaces", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(code).toHaveLength(CODE_LENGTH);
      expect(isWellFormedCode(code)).toBe(true);
    }
  });

  it("does not repeat codes in practice", () => {
    const seen = new Set(Array.from({ length: 2000 }, generateCode));
    expect(seen.size).toBe(2000);
  });

  it("rejects codes of the wrong length or with spaces", () => {
    expect(isWellFormedCode("short")).toBe(false);
    expect(isWellFormedCode("waytoolong")).toBe(false);
    expect(isWellFormedCode("abc defg")).toBe(false);
  });

  it("stores the same value for the same code, and a different one for a different code", () => {
    expect(hashCode("Ab3!xyZ9")).toBe(hashCode("Ab3!xyZ9"));
    expect(hashCode("Ab3!xyZ9")).not.toBe(hashCode("ab3!xyZ9")); // capitals matter
    expect(hashCode("Ab3!xyZ9")).not.toContain("Ab3!xyZ9");
  });

  it("depends on the secret, so a stolen database alone cannot be used to check guesses", () => {
    const before = hashCode("Ab3!xyZ9");
    process.env.AUTH_SECRET = "another-secret-another-secret-12345";
    expect(hashCode("Ab3!xyZ9")).not.toBe(before);
    process.env.AUTH_SECRET = "test-secret-test-secret-test-secret";
  });

  it("refuses to work without a secret", () => {
    const saved = process.env.AUTH_SECRET;
    delete process.env.AUTH_SECRET;
    expect(() => hashCode("Ab3!xyZ9")).toThrow();
    process.env.AUTH_SECRET = saved;
  });
});

describe("session tokens", () => {
  it("creates a random token and stores only its hash", () => {
    const a = newSessionToken();
    const b = newSessionToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).toBe(hashToken(a.token));
    expect(a.tokenHash).not.toBe(a.token);
  });
});
