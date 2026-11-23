// Content briefs: the kinds of fields, the starting set, and checking what is saved.
// Pure, tested in brief-rules.test.ts.

export const BRIEF_TYPES = ["short", "long", "links", "checklist", "date"] as const;
export type BriefType = (typeof BRIEF_TYPES)[number];

export type BriefLink = { name: string; url: string };
/** One field of a brief. `hint` is the grey text shown in the empty box while writing (from Settings). */
export type BriefField =
  | { id: string; label: string; hint?: string; type: "short" | "long" | "date"; value: string }
  | { id: string; label: string; hint?: string; type: "links"; value: BriefLink[] }
  | { id: string; label: string; hint?: string; type: "checklist"; value: string[] };

export const BRIEF_LIMITS = { fields: 30, label: 60, hint: 200, short: 300, long: 10000, links: 20, linkName: 100, url: 2000, items: 30, item: 300, template: 30 };

/** A starting field as set in Settings → Content brief. */
export type BriefTemplateField = { id: string; label: string; labelEn: string | null; type: BriefType; hint: string; hintEn: string | null; visible: boolean };

/** Checks a starting field typed in Settings: a name is needed; everything is trimmed and capped. */
export function cleanTemplateField(input: { label?: unknown; labelEn?: unknown; type?: unknown; hint?: unknown; hintEn?: unknown }):
  | { ok: true; value: { label: string; labelEn: string | null; type: BriefType; hint: string; hintEn: string | null } }
  | { ok: false; error: "briefLabelMissing" | "briefTypeInvalid" } {
  const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const label = text(input.label, BRIEF_LIMITS.label);
  if (!label) return { ok: false, error: "briefLabelMissing" };
  if (!BRIEF_TYPES.includes(input.type as BriefType)) return { ok: false, error: "briefTypeInvalid" };
  return {
    ok: true,
    value: { label, labelEn: text(input.labelEn, BRIEF_LIMITS.label) || null, type: input.type as BriefType, hint: text(input.hint, BRIEF_LIMITS.hint), hintEn: text(input.hintEn, BRIEF_LIMITS.hint) || null },
  };
}

/** An empty value for a field of this type. */
export function emptyValue(type: BriefType): BriefField["value"] {
  return type === "links" ? [{ name: "", url: "" }] : type === "checklist" ? [""] : "";
}

/**
 * A web address as typed or pasted, made complete ("drive.google.com/…" gets https://), or null
 * when it isn't a web address. Only http and https are allowed, so a link can never run code.
 */
export function cleanUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text || /\s/.test(text)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** The site a link goes to, for the small badge next to it. */
export function linkSite(url: string): { host: string; kind: "drive" | "docs" | "instagram" | "youtube" | "tiktok" | "figma" | "dropbox" | "facebook" | "other" } {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return { host: url, kind: "other" };
  }
  const kind =
    host === "drive.google.com"
      ? "drive"
      : host === "docs.google.com"
        ? "docs"
        : host.endsWith("instagram.com")
          ? "instagram"
          : host.endsWith("youtube.com") || host === "youtu.be"
            ? "youtube"
            : host.endsWith("tiktok.com")
              ? "tiktok"
              : host.endsWith("figma.com")
                ? "figma"
                : host.endsWith("dropbox.com")
                  ? "dropbox"
                  : host.endsWith("facebook.com") || host === "fb.watch"
                    ? "facebook"
                    : "other";
  return { host, kind };
}

export type BriefProblem = "briefEmpty" | "briefLabelMissing" | "briefLinkInvalid" | "dateInvalid";

/**
 * Checks and tidies a brief before it is saved: trims everything, drops empty fields, empty link
 * rows and empty checklist items, completes web addresses, and caps lengths. A link without a name
 * is named after its site. Returns the fields to save, or what is wrong.
 */
export function cleanBrief(input: unknown): { ok: true; fields: BriefField[] } | { ok: false; error: BriefProblem; fieldId?: string } {
  if (!Array.isArray(input)) return { ok: false, error: "briefEmpty" };
  const out: BriefField[] = [];
  const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  for (const raw of input.slice(0, BRIEF_LIMITS.fields)) {
    if (!raw || typeof raw !== "object") continue;
    const f = raw as Record<string, unknown>;
    const type = BRIEF_TYPES.includes(f.type as BriefType) ? (f.type as BriefType) : null;
    if (!type) continue;
    const id = text(f.id, 40) || Math.random().toString(36).slice(2, 10);
    const label = text(f.label, BRIEF_LIMITS.label);
    const hint = text(f.hint, BRIEF_LIMITS.hint) || undefined;
    let field: BriefField | null = null;
    if (type === "links") {
      const links: BriefLink[] = [];
      for (const l of (Array.isArray(f.value) ? f.value : []).slice(0, BRIEF_LIMITS.links)) {
        const name = text((l as BriefLink)?.name, BRIEF_LIMITS.linkName);
        const rawUrl = text((l as BriefLink)?.url, BRIEF_LIMITS.url);
        if (!rawUrl && !name) continue;
        const url = cleanUrl(rawUrl);
        if (!url) return { ok: false, error: "briefLinkInvalid", fieldId: id };
        links.push({ name: name || linkSite(url).host, url });
      }
      if (links.length) field = { id, label, hint, type, value: links };
    } else if (type === "checklist") {
      const items = (Array.isArray(f.value) ? f.value : []).map((x) => text(x, BRIEF_LIMITS.item)).filter(Boolean).slice(0, BRIEF_LIMITS.items);
      if (items.length) field = { id, label, hint, type, value: items };
    } else {
      const value = text(f.value, type === "long" ? BRIEF_LIMITS.long : BRIEF_LIMITS.short);
      if (type === "date" && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { ok: false, error: "dateInvalid", fieldId: id };
      if (value) field = { id, label, hint, type, value };
    }
    if (!field) continue; // nothing filled in: left out
    if (!label) return { ok: false, error: "briefLabelMissing", fieldId: id };
    if (!field.hint) delete field.hint;
    out.push(field);
  }
  return out.length ? { ok: true, fields: out } : { ok: false, error: "briefEmpty" };
}

/** Reads stored fields back (anything unreadable is skipped rather than breaking the page). */
export function parseBrief(json: string): BriefField[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed.filter((f) => f && BRIEF_TYPES.includes(f.type)) as BriefField[]) : [];
  } catch {
    return [];
  }
}
