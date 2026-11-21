// All interface text lives here, in both languages. Azerbaijani is the default.
// Text that people type themselves (names, task types, notes) is never translated.

export const en = {
  brand: "Zeyn Media",
  login: {
    tagline: "Plan the month. Run the day.",
    taglineSub: "Customers, content IDs and every task for the team, in one place.",
    title: "Log in",
    intro: "Enter your 8-character access code.",
    codeLabel: "Access code",
    showCode: "Show code",
    hideCode: "Hide code",
    remember: "Keep me logged in on this device",
    submit: "Log in",
    submitting: "Checking…",
    invalid: "That code isn’t recognised. Check it and try again.",
    tooMany: "Too many attempts. Wait 15 minutes and try again.",
    noCode: "No code, or forgot it?",
    askNew: "Ask for a new one",
    askNewHelp: "Tell your admin you need a new code. They can create one for you in Settings.",
    samples: [
      { type: "Video shoot", status: "In progress" },
      { type: "Caption writing", status: "Ready for review" },
      { type: "Post publishing", status: "Done" },
    ],
  },
  nav: {
    dashboard: "Dashboard",
    board: "Managing board",
    customers: "Customers",
    myTasks: "My tasks",
    settings: "Settings",
    logout: "Log out",
    main: "Main",
  },
  roles: { admin: "Admin", manager: "Manager", employee: "Employee" },
  common: {
    language: "Language",
    notifications: "Notifications",
    comingTitle: "This page is being built",
    comingText: "The frame, login and roles are ready. This page’s content arrives in a later stage.",
  },
};

export type Dictionary = typeof en;

export const az: Dictionary = {
  brand: "Zeyn Media",
  login: {
    tagline: "Ayı planla. Günü idarə et.",
    taglineSub: "Müştərilər, kontent ID-ləri və komandanın bütün tapşırıqları bir yerdə.",
    title: "Daxil ol",
    intro: "8 simvollu giriş kodunuzu daxil edin.",
    codeLabel: "Giriş kodu",
    showCode: "Kodu göstər",
    hideCode: "Kodu gizlət",
    remember: "Bu cihazda məni yadda saxla",
    submit: "Daxil ol",
    submitting: "Yoxlanılır…",
    invalid: "Bu kod tanınmadı. Yoxlayıb yenidən cəhd edin.",
    tooMany: "Həddən çox cəhd edildi. 15 dəqiqə gözləyib yenidən cəhd edin.",
    noCode: "Kodunuz yoxdur və ya unutmusunuz?",
    askNew: "Yenisini istəyin",
    askNewHelp: "Admininizə yeni kod lazım olduğunu bildirin. O, Tənzimləmələr bölməsində sizin üçün yeni kod yarada bilər.",
    samples: [
      { type: "Video çəkilişi", status: "İcrada" },
      { type: "Mətnin yazılması", status: "Yoxlamaya hazır" },
      { type: "Postun paylaşılması", status: "Tamamlandı" },
    ],
  },
  nav: {
    dashboard: "İdarə paneli",
    board: "İdarəetmə lövhəsi",
    customers: "Müştərilər",
    myTasks: "Tapşırıqlarım",
    settings: "Tənzimləmələr",
    logout: "Çıxış",
    main: "Əsas",
  },
  roles: { admin: "Admin", manager: "Menecer", employee: "Əməkdaş" },
  common: {
    language: "Dil",
    notifications: "Bildirişlər",
    comingTitle: "Bu səhifə hazırlanır",
    comingText: "Çərçivə, giriş və rollar hazırdır. Bu səhifənin məzmunu növbəti mərhələlərdə əlavə olunacaq.",
  },
};

export const LOCALES = ["az", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "az";
export const dictionaries: Record<Locale, Dictionary> = { az, en };
