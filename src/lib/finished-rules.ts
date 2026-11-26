// Finished work on a content ID: named links to the final video, design or post.
// Pure, tested in finished-rules.test.ts.
import { BRIEF_LIMITS, cleanUrl, linkSite, type BriefLink } from "./brief-rules";
import { isStaff } from "./roles";

export const FINISHED_LIMITS = { links: 10, name: BRIEF_LIMITS.linkName, url: BRIEF_LIMITS.url };

export type FinishedProblem = "finishedEmpty" | "briefLinkInvalid";

/**
 * Checks and tidies the links before they are saved: trims, drops empty rows, completes web
 * addresses (only http and https), names a link after its site when no name is given, and caps
 * lengths. Returns the links, or what is wrong (with the row it is on).
 */
export function cleanFinishedLinks(input: unknown): { ok: true; links: BriefLink[] } | { ok: false; error: FinishedProblem; index?: number } {
  if (!Array.isArray(input)) return { ok: false, error: "finishedEmpty" };
  const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const links: BriefLink[] = [];
  for (const [index, raw] of input.slice(0, FINISHED_LIMITS.links).entries()) {
    const name = text((raw as BriefLink | null)?.name, FINISHED_LIMITS.name);
    const rawUrl = text((raw as BriefLink | null)?.url, FINISHED_LIMITS.url);
    if (!rawUrl && !name) continue;
    const url = cleanUrl(rawUrl);
    if (!url) return { ok: false, error: "briefLinkInvalid", index };
    links.push({ name: name || linkSite(url).host, url });
  }
  return links.length ? { ok: true, links } : { ok: false, error: "finishedEmpty" };
}

/** Reads stored links back (anything unreadable is skipped rather than breaking the page). */
export function parseFinished(json: string): BriefLink[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((l) => l && typeof l.url === "string" && typeof l.name === "string" && cleanUrl(l.url)) : [];
  } catch {
    return [];
  }
}

/**
 * Who may do what with the finished work of a content ID. Admins and managers may do everything;
 * someone on one of its tasks may add it when there is none; whoever added it may change or remove it.
 */
export function finishedRights(me: { id: string; role: string }, onTask: boolean, createdBy: string | null, exists: boolean) {
  const staff = isStaff(me.role);
  const owner = exists && !!createdBy && createdBy === me.id;
  return { read: staff || onTask, add: !exists && (staff || onTask), edit: exists && (staff || owner) };
}
