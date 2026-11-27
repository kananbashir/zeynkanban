import { describe, expect, it } from "vitest";
import { allApproved, briefText, cleanBankNote, cleanBankTitle, copyTitle, findBriefs, mayApprove, mayEditBank, mayRemoveBank } from "./bank-rules";
import type { BriefField } from "./brief-rules";

const fields = (text: string, links: string[] = []): BriefField[] => [
  { id: "a", label: "Məqsəd", type: "long", value: text },
  ...(links.length ? [{ id: "b", label: "Materiallar", type: "links" as const, value: links.map((name) => ({ name, url: "https://drive.google.com/x" })) }] : []),
];
const list = [
  { id: "1", title: "Yeni menyu videosu", fields: fields("Qış menyusu 30 saniyədə", ["Xam görüntülər"]), usedFor: null },
  { id: "2", title: "Qış endirimi postu", fields: fields("İsti içkilərə 20% endirim"), usedFor: "thrive-gpost-nd26-2" },
  { id: "3", title: "Barista ilə 1 gün", fields: fields("Səhər açılışdan axşama qədər"), usedFor: null },
];

describe("cleanBankTitle", () => {
  it("tidies spaces and caps the length; empty stays empty", () => {
    expect(cleanBankTitle("  Yeni   menyu \n videosu ")).toBe("Yeni menyu videosu");
    expect(cleanBankTitle("   ")).toBe("");
    expect(cleanBankTitle(undefined)).toBe("");
    expect(cleanBankTitle("x".repeat(200))).toHaveLength(120);
  });
});

describe("briefText", () => {
  it("joins the text of every field, link names included", () => {
    expect(briefText(fields("Qış menyusu", ["Xam görüntülər"]))).toBe("Qış menyusu Xam görüntülər");
  });
});

describe("findBriefs", () => {
  it("filters by status", () => {
    expect(findBriefs(list, "", "all").map((b) => b.id)).toEqual(["1", "2", "3"]);
    expect(findBriefs(list, "", "unused").map((b) => b.id)).toEqual(["1", "3"]);
    expect(findBriefs(list, "", "used").map((b) => b.id)).toEqual(["2"]);
  });
  it("finds every word in the title or the text, ignoring case", () => {
    expect(findBriefs(list, "qış", "all").map((b) => b.id)).toEqual(["1", "2"]);
    expect(findBriefs(list, "QIŞ endirim", "all").map((b) => b.id)).toEqual(["2"]);
    expect(findBriefs(list, "görüntülər", "all").map((b) => b.id)).toEqual(["1"]);
    expect(findBriefs(list, "qış", "unused").map((b) => b.id)).toEqual(["1"]);
    expect(findBriefs(list, "yoxdur", "all")).toEqual([]);
  });
});

describe("copyTitle", () => {
  it("adds (copy), then (copy 2) and so on when taken, without stacking", () => {
    expect(copyTitle("Qış postu", ["Qış postu"], "surət")).toBe("Qış postu (surət)");
    expect(copyTitle("Qış postu", ["Qış postu", "Qış postu (surət)"], "surət")).toBe("Qış postu (surət 2)");
    expect(copyTitle("Qış postu (surət)", ["Qış postu", "Qış postu (surət)"], "surət")).toBe("Qış postu (surət 2)");
  });
});

describe("approval", () => {
  const admin = { id: "a", role: "admin" }, manager = { id: "m", role: "manager" }, murad = { id: "e1", role: "employee" }, leyla = { id: "e2", role: "employee" };
  it("an admin's brief without approvers: only its author", () => {
    const brief = { authorId: "a", authorRole: "admin", approvedAt: null, approvers: [] };
    expect(mayApprove(admin, brief)).toBe(true);
    expect(mayApprove(manager, brief)).toBe(false);
    expect(mayApprove(murad, brief)).toBe(false);
  });
  it("an employee's brief without approvers: its author or any admin or manager", () => {
    const brief = { authorId: "e1", authorRole: "employee", approvedAt: null, approvers: [] };
    expect([murad, admin, manager, leyla].map((p) => mayApprove(p, brief))).toEqual([true, true, true, false]);
  });
  it("with approvers: each of them once, not the author or others", () => {
    const brief = { authorId: "a", authorRole: "admin", approvedAt: null, approvers: [{ userId: "e1", approvedAt: new Date() }, { userId: "e2", approvedAt: null }] };
    expect([admin, manager, murad, leyla].map((p) => mayApprove(p, brief))).toEqual([false, false, false, true]);
  });
  it("nobody once it is approved", () => {
    expect(mayApprove(admin, { authorId: "a", authorRole: "admin", approvedAt: new Date(), approvers: [] })).toBe(false);
  });
  it("approved when every approver has approved", () => {
    expect(allApproved([])).toBe(false);
    expect(allApproved([{ approvedAt: new Date() }, { approvedAt: null }])).toBe(false);
    expect(allApproved([{ approvedAt: new Date() }, { approvedAt: new Date() }])).toBe(true);
  });
  it("approvers may edit but not duplicate or delete", () => {
    expect(mayEditBank(leyla, "a", ["e2"])).toBe(true);
    expect(mayEditBank(leyla, "a", ["e1"])).toBe(false);
    expect(mayRemoveBank(leyla, "a")).toBe(false);
    expect(mayRemoveBank(murad, "e1")).toBe(true);
    expect(mayRemoveBank(manager, "e1")).toBe(true);
  });
  it("notes are trimmed and capped", () => {
    expect(cleanBankNote("  ok \r\nyes ")).toBe("ok \nyes");
    expect(cleanBankNote("x".repeat(1200))).toHaveLength(1000);
  });
  it("the “waiting for my approval” filter", () => {
    const list = [
      { title: "A", fields: [], usedFor: null, canApprove: true },
      { title: "B", fields: [], usedFor: null, canApprove: false },
    ];
    expect(findBriefs(list, "", "mine").map((b) => b.title)).toEqual(["A"]);
  });
});
