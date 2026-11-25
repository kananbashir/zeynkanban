import { describe, expect, it } from "vitest";
import pkg from "../../package.json";
import { compareVersions, localRelease, RELEASES, releasesFor, unseenReleases, type Release } from "./whats-new";

const item = { kind: "new" as const, icon: "list" as const, az: { title: "a", text: "a" }, en: { title: "A", text: "A" } };
const list: Release[] = [
  { version: "0.15.0", date: "2026-12-01", items: [item] },
  { version: "0.14.1", date: "2026-11-30", items: [] },
  { version: "0.14.0", date: "2026-11-27", items: [{ ...item, kind: "fixed" }, item] },
  { version: "0.13.1", date: "2026-11-24", items: [item] },
];

describe("compareVersions", () => {
  it("compares number by number", () => {
    expect(compareVersions("0.13.1", "0.14.0")).toBe(-1);
    expect(compareVersions("0.10.0", "0.9.9")).toBe(1);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
  });
});

describe("unseenReleases", () => {
  it("lists versions after the one seen, up to the one running, skipping those with nothing to show", () => {
    expect(unseenReleases("0.13.1", "0.15.0", list).map((r) => r.version)).toEqual(["0.15.0", "0.14.0"]);
    expect(unseenReleases("0.13.0", "0.14.1", list).map((r) => r.version)).toEqual(["0.14.0", "0.13.1"]);
  });
  it("nothing once the current version was seen", () => {
    expect(unseenReleases("0.15.0", "0.15.0", list)).toEqual([]);
  });
});

describe("releasesFor", () => {
  const mixed: Release[] = [
    { version: "0.2.0", date: "2026-12-02", items: [{ ...item, for: "staff" }] },
    { version: "0.1.0", date: "2026-12-01", items: [item, { ...item, for: "employees", en: { title: "E", text: "E" } }, { ...item, for: "staff", en: { title: "S", text: "S" } }] },
  ];
  it("admins and managers see items for everyone and for staff", () => {
    for (const role of ["admin", "manager"] as const) {
      expect(releasesFor(role, mixed).map((r) => r.items.map((i) => i.en.title))).toEqual([["A"], ["A", "S"]]);
    }
  });
  it("employees see items for everyone and for employees; a version with nothing for them is left out", () => {
    expect(releasesFor("employee", mixed).map((r) => [r.version, r.items.map((i) => i.en.title)])).toEqual([["0.1.0", ["A", "E"]]]);
    expect(unseenReleases("0.0.1", "0.2.0", releasesFor("employee", mixed)).map((r) => r.version)).toEqual(["0.1.0"]);
  });
});

describe("localRelease", () => {
  it("groups new before fixed, in the chosen language", () => {
    const r = localRelease(list[2], "en");
    expect(r.items.map((i) => i.kind)).toEqual(["new", "fixed"]);
    expect(r.items[0].title).toBe("A");
    expect(localRelease(list[2], "az").items[0].title).toBe("a");
  });
});

describe("RELEASES", () => {
  it("newest first, the newest is the version in package.json, each with a date", () => {
    expect(RELEASES[0].version).toBe(pkg.version);
    for (let i = 1; i < RELEASES.length; i++) expect(compareVersions(RELEASES[i - 1].version, RELEASES[i].version)).toBe(1);
    for (const r of RELEASES) expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
