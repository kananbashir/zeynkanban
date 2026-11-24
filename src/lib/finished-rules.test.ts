import { describe, expect, it } from "vitest";
import { cleanFinishedLinks, finishedRights, parseFinished } from "./finished-rules";

describe("cleanFinishedLinks", () => {
  it("keeps named links, completes addresses and names unnamed ones after their site", () => {
    const r = cleanFinishedLinks([
      { name: " Final video ", url: "drive.google.com/file/d/1" },
      { name: "", url: "https://www.instagram.com/p/x" },
      { name: "", url: "" },
    ]);
    expect(r).toEqual({ ok: true, links: [{ name: "Final video", url: "https://drive.google.com/file/d/1" }, { name: "instagram.com", url: "https://www.instagram.com/p/x" }] });
  });
  it("refuses something that isn't a web address, saying which row", () => {
    expect(cleanFinishedLinks([{ name: "a", url: "https://x.com" }, { name: "b", url: "javascript:alert(1)" }])).toEqual({ ok: false, error: "briefLinkInvalid", index: 1 });
    expect(cleanFinishedLinks([{ name: "only a name", url: "" }])).toEqual({ ok: false, error: "briefLinkInvalid", index: 0 });
  });
  it("needs at least one link", () => {
    expect(cleanFinishedLinks([{ name: "", url: "" }])).toEqual({ ok: false, error: "finishedEmpty" });
    expect(cleanFinishedLinks("nope")).toEqual({ ok: false, error: "finishedEmpty" });
  });
  it("keeps at most 10", () => {
    const r = cleanFinishedLinks(Array.from({ length: 14 }, (_, i) => ({ name: `n${i}`, url: `https://a.com/${i}` })));
    expect(r.ok && r.links.length).toBe(10);
  });
});

describe("parseFinished", () => {
  it("reads stored links and skips broken ones", () => {
    expect(parseFinished('[{"name":"a","url":"https://a.com/"},{"name":"b","url":"javascript:x"},null]')).toEqual([{ name: "a", url: "https://a.com/" }]);
    expect(parseFinished("not json")).toEqual([]);
  });
});

describe("finishedRights", () => {
  const emp = { id: "e", role: "employee" };
  const admin = { id: "a", role: "admin" };
  it("lets someone on a task add it when there is none", () => {
    expect(finishedRights(emp, true, null, false)).toEqual({ read: true, add: true, edit: false });
    expect(finishedRights(emp, false, null, false)).toEqual({ read: false, add: false, edit: false });
  });
  it("lets whoever added it, and admins and managers, change it", () => {
    expect(finishedRights(emp, true, "e", true)).toEqual({ read: true, add: false, edit: true });
    expect(finishedRights(emp, true, "x", true)).toEqual({ read: true, add: false, edit: false });
    expect(finishedRights(admin, false, "x", true)).toEqual({ read: true, add: false, edit: true });
    expect(finishedRights({ id: "m", role: "manager" }, false, null, false).add).toBe(true);
  });
});
