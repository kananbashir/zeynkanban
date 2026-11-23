import { describe, expect, it } from "vitest";
import { cleanBrief, cleanTemplateField, cleanUrl, linkSite, parseBrief } from "./brief-rules";

describe("cleanUrl", () => {
  it("completes addresses pasted without https://", () => {
    expect(cleanUrl("drive.google.com/drive/folders/abc")).toBe("https://drive.google.com/drive/folders/abc");
    expect(cleanUrl("  https://instagram.com/p/C9x ")).toBe("https://instagram.com/p/C9x");
  });
  it("refuses anything that isn't a web address", () => {
    expect(cleanUrl("javascript:alert(1)")).toBeNull();
    expect(cleanUrl("ftp://files.example.com/a")).toBeNull();
    expect(cleanUrl("not a link")).toBeNull();
    expect(cleanUrl("localhost")).toBeNull();
    expect(cleanUrl("")).toBeNull();
  });
});

describe("linkSite", () => {
  it("recognises the usual sites", () => {
    expect(linkSite("https://drive.google.com/x")).toEqual({ host: "drive.google.com", kind: "drive" });
    expect(linkSite("https://www.instagram.com/p/1")).toEqual({ host: "instagram.com", kind: "instagram" });
    expect(linkSite("https://youtu.be/abc").kind).toBe("youtube");
    expect(linkSite("https://example.az/a").kind).toBe("other");
  });
});

describe("cleanBrief", () => {
  it("keeps filled fields, drops empty ones and empty rows", () => {
    const r = cleanBrief([
      { id: "a", label: " Goal ", type: "long", value: " Book a trial lesson " },
      { id: "b", label: "Key message", type: "short", value: "   " },
      { id: "c", label: "Materials", type: "links", value: [{ name: "Raw footage", url: "drive.google.com/f/1" }, { name: "", url: "" }] },
      { id: "d", label: "Must include", type: "checklist", value: ["Logo", " ", "Price"] },
    ]);
    expect(r).toEqual({
      ok: true,
      fields: [
        { id: "a", label: "Goal", type: "long", value: "Book a trial lesson" },
        { id: "c", label: "Materials", type: "links", value: [{ name: "Raw footage", url: "https://drive.google.com/f/1" }] },
        { id: "d", label: "Must include", type: "checklist", value: ["Logo", "Price"] },
      ],
    });
  });
  it("names an unnamed link after its site", () => {
    const r = cleanBrief([{ id: "c", label: "Materials", type: "links", value: [{ name: "", url: "https://www.instagram.com/p/1" }] }]);
    expect(r.ok && r.fields[0].value).toEqual([{ name: "instagram.com", url: "https://www.instagram.com/p/1" }]);
  });
  it("says what is wrong", () => {
    expect(cleanBrief([])).toEqual({ ok: false, error: "briefEmpty" });
    expect(cleanBrief([{ id: "a", label: "Goal", type: "long", value: "" }])).toEqual({ ok: false, error: "briefEmpty" });
    expect(cleanBrief([{ id: "a", label: "", type: "short", value: "x" }])).toEqual({ ok: false, error: "briefLabelMissing", fieldId: "a" });
    expect(cleanBrief([{ id: "c", label: "Materials", type: "links", value: [{ name: "Bad", url: "javascript:alert(1)" }] }])).toEqual({ ok: false, error: "briefLinkInvalid", fieldId: "c" });
    expect(cleanBrief([{ id: "e", label: "Shoot day", type: "date", value: "next week" }])).toEqual({ ok: false, error: "dateInvalid", fieldId: "e" });
  });
  it("ignores unknown field types and reads stored briefs safely", () => {
    expect(cleanBrief([{ id: "x", label: "Odd", type: "script-tag", value: "<b>" }])).toEqual({ ok: false, error: "briefEmpty" });
    expect(parseBrief("not json")).toEqual([]);
    expect(parseBrief('[{"id":"a","label":"Goal","type":"long","value":"x"},{"type":"weird"}]')).toHaveLength(1);
  });
});

describe("cleanTemplateField", () => {
  it("needs a name and a known type; trims and caps the rest", () => {
    expect(cleanTemplateField({ label: " Hashtaqlar ", labelEn: " ", type: "short", hint: " #ielts " })).toEqual({ ok: true, value: { label: "Hashtaqlar", labelEn: null, type: "short", hint: "#ielts", hintEn: null } });
    expect(cleanTemplateField({ label: "", type: "short" })).toEqual({ ok: false, error: "briefLabelMissing" });
    expect(cleanTemplateField({ label: "X", type: "video" })).toEqual({ ok: false, error: "briefTypeInvalid" });
  });
  it("keeps a field's hint with the brief", () => {
    const r = cleanBrief([{ id: "a", label: "Goal", hint: "What should it achieve?", type: "long", value: "Trial lessons" }]);
    expect(r.ok && r.fields[0]).toEqual({ id: "a", label: "Goal", hint: "What should it achieve?", type: "long", value: "Trial lessons" });
  });
});
