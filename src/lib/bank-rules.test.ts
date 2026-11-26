import { describe, expect, it } from "vitest";
import { briefText, cleanBankTitle, copyTitle, findBriefs } from "./bank-rules";
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
