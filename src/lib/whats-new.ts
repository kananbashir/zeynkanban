// What changed in each version, for the "What's new" window and the About page. Newest first.
// Written with each release, in both languages. A version with no items (nothing anyone would
// notice) shows no window. Pure, tested in whats-new.test.ts.
import type { Locale } from "@/i18n/dictionaries";

export type ReleaseKind = "new" | "improved" | "fixed";
/** The small picture before an item (drawn in whats-new-window.tsx). */
export type ReleaseIcon = "finished" | "icons" | "motion" | "settings" | "keyboard" | "lock" | "bell" | "brief" | "deadline" | "list" | "search" | "status" | "logout" | "sparkle" | "pin";
type Text = { title: string; text: string };
export type ReleaseItem = { kind: ReleaseKind; icon: ReleaseIcon; az: Text; en: Text; /** Only about things admins (and managers) use, e.g. Settings. */ admins?: boolean };
/** `date`: the day the version went live (merged into main), yyyy-mm-dd. */
export type Release = { version: string; date: string; items: ReleaseItem[] };

export const RELEASES: Release[] = [
  {
    version: "0.15.0",
    date: "2026-11-24",
    items: [
      { kind: "new", icon: "pin", az: { title: "Kontent ID-yə qeyd", text: "Adminlər və menecerlər müştərinin “Kontentlər” bölməsində kontent ID-yə qeyd yaza bilər. Qeyd həmin kontent ID-nin bütün tapşırıqlarında onun altında görünür və tapşırıqlardakı insanlara bildiriş gedir." }, en: { title: "Notes on content IDs", text: "Admins and managers can write a note on a content ID in the customer’s Contents tab. It shows under the content ID on every task of it, and the people on those tasks are notified." } },
      { kind: "new", icon: "list", admins: true, az: { title: "Kontent ID pəncərəsi", text: "İdarəetmə lövhəsində və müştəri səhifəsində kartdakı kontent ID-yə toxunun: onun bütün tapşırıqları, zaman xətti, qeydi və irəliləyişi bir pəncərədə görünür. Tapşırığa toxunanda onun günü açılır." }, en: { title: "Content ID window", text: "On the managing board and the customer page, tap the content ID on a card to see all its tasks, a timeline, its note and progress in one window. Tapping a task opens its day." } },
      { kind: "fixed", icon: "icons", admins: true, az: { title: "Telefonda ikon seçimi", text: "Ayarlarda tapşırıq növünün ikon cədvəli artıq telefon ekranına tam sığır." }, en: { title: "Icon picker on phones", text: "The task type icon grid in Settings now fits on phone screens." } },
    ],
  },
  {
    version: "0.14.0",
    date: "2026-11-24",
    items: [
      { kind: "new", icon: "finished", az: { title: "Kontent ID-də tamamlanmış iş", text: "Tapşırıq bitəndə yekun video və ya dizaynın linklərini əlavə edin. Əlavə olunmuş material bu kontent ID-nin bütün tapşırıqlarında yaşıl “Tamamlanmış iş” etiketi kimi görünür." }, en: { title: "Finished work on content IDs", text: "When a task is done, add links to the final video or design. It shows as a green “Finished work” tag on every task of that content ID." } },
      { kind: "new", icon: "icons", az: { title: "Tapşırıq növləri üçün ikonlar", text: "Hər tapşırıq növü üçün uyğun ikonlar əlavə edildi. Bu ikonlara sonradan düzəliş edilə bilir." }, en: { title: "Icons for task types", text: "Each task type has an icon before its name on cards and in the task form." } },
      { kind: "new", icon: "sparkle", az: { title: "Yeniliklər pəncərəsi", text: "Yeni versiyadan sonra nələrin dəyişdiyini burada görürsünüz. Bütün versiyalar “Haqqında” səhifəsindədir." }, en: { title: "This “What’s new” window", text: "After an update you see what changed, right here. Every version is listed on the About page." } },
      { kind: "improved", icon: "settings", admins: true, az: { title: "Yenilənmiş Ayarlar", text: "Bölmələr ikonlu menyuda; sətirlər açılıb-bağlanır, silinən sətri geri qaytarmaq olar, tapşırıq növünə ikon seçilir." }, en: { title: "Redesigned Settings", text: "Sections in a menu with icons; rows open and close, a deleted row can be brought back with Undo, and task types get an icon picker." } },
      { kind: "improved", icon: "lock", az: { title: "Ləğv edilmiş və təxirə salınmış tapşırıqlar kilidlənir", text: "Bu statusları yalnız admin və menecerlər dəyişə bilər." }, en: { title: "Cancelled and postponed tasks are locked", text: "Only admins and managers can change their status." } },
      { kind: "improved", icon: "motion", az: { title: "Daha gözəl animasiyalar", text: "Əlavə edilən, silinən və açılan hər şey sıçramadan hərəkət edir." }, en: { title: "Smoother animations", text: "Everything that is added, removed or opened moves without jumping." } },
    ],
  },
  {
    version: "0.13.1",
    date: "2026-11-23",
    items: [
      { kind: "improved", icon: "list", az: { title: "Səliqəli gün siyahısı", text: "Tapşırıq formasında günün tapşırıqları sütunlarda: kontent ID, növ, müştəri. Telefonda hər tapşırıq kiçik kart kimi." }, en: { title: "A tidier day list", text: "The task form’s day list in columns: content ID, type, customer. On phones each task is a small tile." } },
      { kind: "improved", icon: "motion", az: { title: "Rəvan açılıb-bağlanma", text: "Qeydlər, şəxsi tapşırıq forması və brif sahələri sıçramadan açılıb bağlanır." }, en: { title: "Smooth opening and closing", text: "Notes, the personal task form and brief fields open and close without jumping." } },
      { kind: "fixed", icon: "keyboard", az: { title: "Telefonda klaviatura özü açılmır", text: "Şəxsi tapşırıq forması açılanda klaviatura artıq özbaşına çıxmır." }, en: { title: "No keyboard popping up on phones", text: "Opening the personal task form no longer brings up the keyboard by itself." } },
    ],
  },
  {
    version: "0.13.0",
    date: "2026-11-23",
    items: [
      { kind: "new", icon: "status", az: { title: "Ləğv edilmiş və təxirə salınmış statuslar", text: "Gün xülasəsində, idarə lövhəsinin filtrində və paneldə ayrıca görünür." }, en: { title: "Cancelled and postponed statuses", text: "Shown separately in the day summary, the board filter and the dashboard." } },
      { kind: "improved", icon: "search", az: { title: "Daha geniş axtarış", text: "İdarə lövhəsində axtarış qutusu bütün eni tutur." }, en: { title: "Wider search", text: "The board’s search box takes the full width." } },
    ],
  },
  {
    version: "0.12.0",
    date: "2026-11-23",
    items: [
      { kind: "new", icon: "brief", az: { title: "Kontent brifləri", text: "Kontent ID-yə brif: mətnlər, linklər, yoxlama siyahısı. Bütün tapşırıqlarında tünd “Brif” etiketi kimi görünür." }, en: { title: "Content briefs", text: "A brief on a content ID: texts, links, a checklist. It shows as a dark “Brief” tag on all its tasks." } },
      { kind: "new", icon: "settings", admins: true, az: { title: "Brifin başlanğıc sahələri", text: "Ayarlar → Kontent brifi: hər yeni brifin hansı sahələrlə başladığını seçin." }, en: { title: "Starting fields for briefs", text: "Settings → Content brief: choose the fields every new brief starts with." } },
    ],
  },
  {
    version: "0.11.0",
    date: "2026-11-23",
    items: [
      { kind: "new", icon: "deadline", az: { title: "Kartda vaxt zolağı", text: "Son tarixi olan tapşırıqda başlanğıcdan son tarixə qədər zolaq." }, en: { title: "Timeline strip on cards", text: "A task with a deadline shows a strip from its start to its deadline." } },
      { kind: "new", icon: "bell", az: { title: "“1 gün qalıb” bildirişi", text: "Son tarixdən bir gün əvvəl tapşırıqdakı insanlara və onu yaradana." }, en: { title: "“1 day left” notifications", text: "One day before a deadline, to the people on the task and whoever created it." } },
      { kind: "improved", icon: "logout", az: { title: "Çıxış Ayarlarda", text: "Çıxış düyməsi Ayarlardadır və əvvəlcə soruşur." }, en: { title: "Log out in Settings", text: "The log out button is in Settings and asks first." } },
    ],
  },
  {
    version: "0.10.0",
    date: "2026-11-23",
    items: [{ kind: "new", icon: "deadline", az: { title: "Son tarixlər", text: "Tapşırıq tarixindən son tarixinə qədər, bitənə kimi hər gün görünür." }, en: { title: "Deadlines", text: "A task shows every day from its date to its deadline until it is finished." } }],
  },
];

/** -1, 0 or 1, comparing "0.13.1" with "0.14.0" number by number. */
export function compareVersions(a: string, b: string) {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

/**
 * The versions someone hasn't seen yet, newest first: those after `seen`, up to the version
 * running now, with something to show. Nothing for someone who has seen the current one.
 */
export function unseenReleases(seen: string, current: string, releases: Release[] = RELEASES) {
  return releases.filter((r) => r.items.length && compareVersions(r.version, seen) > 0 && compareVersions(r.version, current) <= 0);
}

export type ShownItem = { kind: ReleaseKind; icon: ReleaseIcon; title: string; text: string; admins: boolean };
export type ShownRelease = { version: string; date: string; items: ShownItem[] };

/** A release in one language, items grouped New → Improved → Fixed. */
export function localRelease(r: Release, locale: Locale): ShownRelease {
  const order: ReleaseKind[] = ["new", "improved", "fixed"];
  const items = [...r.items].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)).map((i) => ({ kind: i.kind, icon: i.icon, ...(locale === "en" ? i.en : i.az), admins: !!i.admins }));
  return { version: r.version, date: r.date, items };
}
