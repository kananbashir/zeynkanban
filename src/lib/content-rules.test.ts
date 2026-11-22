import { describe, expect, it } from "vitest";
import { compareCodes } from "./content-rules";
import {
  cleanContentId,
  cleanShortName,
  contractProblem,
  defaultRenewal,
  formatPeriod,
  monthSpan,
  parseMonth,
  periodCode,
  suggestContentId,
  suggestContentIds,
} from "./content-rules";

const m = (year: number, month: number) => ({ year, month });

describe("period codes", () => {
  it("matches the spreadsheet scheme", () => {
    expect(periodCode(m(2026, 11), m(2026, 12))).toBe("nd26");
    expect(periodCode(m(2026, 12), m(2027, 1))).toBe("dj2627");
    expect(periodCode(m(2026, 11), m(2026, 11))).toBe("n26");
    expect(periodCode(m(2027, 1), m(2027, 3))).toBe("jm27");
  });
});

describe("contract periods", () => {
  it("parses months", () => {
    expect(parseMonth("2026-11-01")).toEqual(m(2026, 11));
    expect(parseMonth("2026-11")).toEqual(m(2026, 11));
    expect(parseMonth("2026-13")).toBeNull();
    expect(parseMonth("nonsense")).toBeNull();
  });
  it("counts months including both ends", () => {
    expect(monthSpan(m(2026, 11), m(2026, 12))).toBe(2);
    expect(monthSpan(m(2026, 12), m(2027, 1))).toBe(2);
  });
  it("rejects backwards and very long contracts", () => {
    expect(contractProblem(m(2026, 12), m(2026, 11))).toBe("periodInvalid");
    expect(contractProblem(m(2026, 1), m(2028, 6))).toBe("periodTooLong");
    expect(contractProblem(m(2026, 11), m(2026, 12))).toBeNull();
    expect(contractProblem(null, m(2026, 12))).toBe("periodInvalid");
  });
  it("proposes the next period of the same length", () => {
    expect(defaultRenewal(m(2026, 11), m(2026, 12))).toEqual({ start: m(2027, 1), end: m(2027, 2) });
    expect(defaultRenewal(m(2026, 12), m(2026, 12))).toEqual({ start: m(2027, 1), end: m(2027, 1) });
  });
  it("formats periods for reading", () => {
    const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    expect(formatPeriod(m(2026, 11), m(2026, 12), names)).toBe("November – December 2026");
    expect(formatPeriod(m(2026, 12), m(2027, 1), names)).toBe("December 2026 – January 2027");
    expect(formatPeriod(m(2026, 11), m(2026, 11), names)).toBe("November 2026");
  });
});

describe("short names and content IDs", () => {
  it("accepts simple short names only", () => {
    expect(cleanShortName(" Thrive ")).toBe("thrive");
    expect(cleanShortName("caspfit2")).toBe("caspfit2");
    for (const bad of ["t", "2fit", "nar-cafe", "nar cafe", "lalə", "x".repeat(21)]) expect(cleanShortName(bad)).toBeNull();
  });
  it("accepts hand-typed content IDs with single hyphens", () => {
    expect(cleanContentId("Thrive-VID-nd26-1")).toBe("thrive-vid-nd26-1");
    for (const bad of ["ab", "thrive--vid", "-thrive", "thrive-", "thrive vid", "thrivə-vid"]) expect(cleanContentId(bad)).toBeNull();
  });
  it("suggests the next number for the same customer, type and period", () => {
    const existing = ["thrive-vid-nd26-1", "thrive-vid-nd26-3", "thrive-gpost-nd26-9", "thrive-vid-dj2627-5", "thrive-vid-nd26-x"];
    expect(suggestContentId("thrive", "vid", "nd26", existing)).toBe("thrive-vid-nd26-4");
    expect(suggestContentId("thrive", "gpost", "nd26", existing)).toBe("thrive-gpost-nd26-10");
    expect(suggestContentId("nar", "vid", "nd26", existing)).toBe("nar-vid-nd26-1");
    expect(suggestContentIds("thrive", "vid", "nd26", existing, 3)).toEqual(["thrive-vid-nd26-4", "thrive-vid-nd26-5", "thrive-vid-nd26-6"]);
  });
});

describe("compareCodes", () => {
  it("counts numbers naturally", () => {
    const codes = ["aliday-gpost-nd26-11", "aliday-gpost-nd26-2", "aliday-gpost-nd26-1", "aliday-vid-nd26-3", "aliday-gpost-nd26-10"];
    expect([...codes].sort(compareCodes)).toEqual(["aliday-gpost-nd26-1", "aliday-gpost-nd26-2", "aliday-gpost-nd26-10", "aliday-gpost-nd26-11", "aliday-vid-nd26-3"]);
  });
});
