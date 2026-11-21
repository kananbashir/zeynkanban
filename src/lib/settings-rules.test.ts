import { describe, expect, it } from "vitest";
import {
  cleanContentCode,
  cleanName,
  isIsoDate,
  isSameSet,
  isStatusColor,
  nextStatusColor,
  statusDeleteProblem,
  STATUS_COLORS,
  unfinishProblem,
} from "./settings-rules";

describe("names", () => {
  it("trims and squeezes spaces", () => {
    expect(cleanName("  Video   edit ")).toEqual({ ok: true, value: "Video edit" });
  });
  it("rejects empty and over-long names", () => {
    expect(cleanName("   ")).toEqual({ ok: false, error: "nameRequired" });
    expect(cleanName("x".repeat(61))).toEqual({ ok: false, error: "nameTooLong" });
  });
  it("keeps Azerbaijani letters", () => {
    expect(cleanName("Məmmədova Ələsgər")).toEqual({ ok: true, value: "Məmmədova Ələsgər" });
  });
});

describe("content type codes", () => {
  it("accepts lowercase letters and digits starting with a letter", () => {
    expect(cleanContentCode("vid")).toBe("vid");
    expect(cleanContentCode(" GPost ")).toBe("gpost");
    expect(cleanContentCode("reel2")).toBe("reel2");
  });
  it("rejects hyphens, spaces, leading digits and long codes", () => {
    for (const bad of ["v-id", "v id", "2vid", "", "abcdefghijk", "vıd"]) expect(cleanContentCode(bad)).toBeNull();
  });
});

describe("dates", () => {
  it("accepts real dates only", () => {
    expect(isIsoDate("2026-11-08")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("8 Nov")).toBe(false);
  });
});

describe("status colours", () => {
  it("only allows the palette", () => {
    expect(isStatusColor("#2a7de1")).toBe(true);
    expect(isStatusColor("#ff0000")).toBe(false);
  });
  it("picks an unused colour first", () => {
    expect(nextStatusColor(["#b04fb8", "#2a7de1"])).toBe("#c47a00");
    expect(nextStatusColor([...STATUS_COLORS, ...STATUS_COLORS.slice(0, 1)])).toBe(STATUS_COLORS[1]);
  });
});

describe("status safety", () => {
  const live = [
    { id: "a", isFinished: false },
    { id: "b", isFinished: true },
  ];
  it("keeps at least one status", () => {
    expect(statusDeleteProblem([{ id: "a", isFinished: true }], "a")).toBe("lastStatus");
  });
  it("keeps at least one finished status", () => {
    expect(statusDeleteProblem(live, "b")).toBe("lastFinished");
    expect(unfinishProblem(live, "b")).toBe("lastFinished");
    expect(statusDeleteProblem(live, "a")).toBeNull();
    expect(unfinishProblem([...live, { id: "c", isFinished: true }], "b")).toBeNull();
  });
});

describe("reordering", () => {
  it("needs every item exactly once", () => {
    expect(isSameSet(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
    expect(isSameSet(["a", "b", "c"], ["a", "b"])).toBe(false);
    expect(isSameSet(["a", "b", "c"], ["a", "a", "b"])).toBe(false);
    expect(isSameSet(["a", "b"], "a,b")).toBe(false);
  });
});
