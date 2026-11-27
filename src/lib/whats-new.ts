// What changed in each version, for the "What's new" window and the About page. Newest first.
// Written with each release, in both languages. A version with no items (nothing anyone would
// notice) shows no window. Pure, tested in whats-new.test.ts.
import type { Locale } from "@/i18n/dictionaries";

export type ReleaseKind = "new" | "improved" | "fixed";
/** The small picture before an item (drawn in whats-new-window.tsx). */
export type ReleaseIcon = "finished" | "icons" | "motion" | "settings" | "keyboard" | "lock" | "bell" | "brief" | "deadline" | "list" | "search" | "status" | "logout" | "sparkle" | "pin" | "chart";
/** `text` may be empty: then only the title is shown. */
type Text = { title: string; text: string };
/** Who sees an item: "staff" (admins and managers) or "employees". Without it, everyone. */
export type Audience = "staff" | "employees";
/** `writers`: only for those who write briefs (not graphic designers, who otherwise see what employees see). */
export type ReleaseItem = { kind: ReleaseKind; icon: ReleaseIcon; az: Text; en: Text; for?: Audience; writers?: boolean };
/** `date`: the day the version went live (merged into main), yyyy-mm-dd. */
export type Release = { version: string; date: string; items: ReleaseItem[] };

export const RELEASES: Release[] = [
  {
    version: "0.21.0",
    date: "2026-11-28",
    items: [
      { kind: "new", icon: "list", az: { title: "Yeni tapşırıq kartları", text: "Tapşırıq kartları yenidən dizayn olundu: kontent ID və müştəri, tapşırıq növü və icraçılar, düymələr və son tarix ayrı-ayrı hissələrdədir. Uzun təsvir və kontent ID qeydi “daha çox” ilə açılır, qeydlər isə ayrıca pəncərədə açılır. Telefonda kartlar daha yığcamdır." }, en: { title: "New task cards", text: "Task cards were redesigned: the content ID and customer, the task type and the people on it, the buttons and the deadline each have their own section. A long description or content ID note opens with “more”, and notes open in their own window. On phones the cards are more compact." } },
      { kind: "improved", icon: "list", for: "staff", az: { title: "Karta toxunun, tapşırıq açılsın", text: "Kartın istənilən yerinə toxunanda tapşırıq açılır (əvvəlki “Tapşırığı aç” kimi)." }, en: { title: "Tap a card to open the task", text: "Tapping anywhere on a card opens the task (like “Open task” did before)." } },
    ],
  },
  {
    version: "0.20.1",
    date: "2026-11-27",
    items: [
      { kind: "improved", icon: "brief", for: "staff", az: { title: "Kontent bankında təsdiq", text: "Bankdakı brif yalnız təsdiqlənəndən sonra kontent ID üçün seçilə bilər. Brifi yazanda onu təsdiq edəcək əməkdaşları seçə bilərsiniz: hamısı təsdiqləyəndə brif təsdiqlənir. Heç kim seçilməsə, brifi özünüz təsdiqləyirsiniz. Əməkdaşların yazdığı briflər də onların və ya sizin təsdiqinizi gözləyir. Təsdiq edənlər brifə qeyd yaza və onu düzəldib təsdiqləyə bilər." }, en: { title: "Approval in the Content bank", text: "A bank brief can be picked for a content ID only once it is approved. When writing a brief you can choose employees to approve it: it is approved once all of them have. If nobody is chosen, you approve it yourself. Briefs written by employees wait for their approval or yours. Approvers can write notes on a brief, or edit and approve it." } },
      { kind: "improved", icon: "brief", for: "employees", writers: true, az: { title: "Kontent bankında təsdiq", text: "Bankdakı brif yalnız təsdiqlənəndən sonra kontent ID üçün seçilə bilər. Yazdığınız brifi özünüz və ya admin/menecer təsdiqləyir. Təsdiqinizə göndərilən briflər də bankda görünür: onlara qeyd yaza, onları düzəldib təsdiqləyə bilərsiniz." }, en: { title: "Approval in the Content bank", text: "A bank brief can be picked for a content ID only once it is approved. You, or an admin or manager, approve the briefs you write. Briefs sent for your approval show in the bank too: you can write notes on them, or edit and approve them." } },
      { kind: "improved", icon: "bell", az: { title: "Bildirişlər daha oxunaqlıdır", text: "Hər bildiriş ayrıca kartdadır, oxunmamışlar rənglə seçilir." }, en: { title: "Easier-to-read notifications", text: "Each notification is its own card, and unread ones are tinted." } },
    ],
  },
  {
    version: "0.20.0",
    date: "2026-11-27",
    items: [
      { kind: "new", icon: "brief", for: "staff", az: { title: "Kontent bankı", text: "Müştərilər üçün brifləri əvvəlcədən yazın: menyudakı yeni “Kontent bankı” səhifəsində müştərini seçib brif əlavə edin, düzəldin, çoxaldın və ya silin. Siz hamının briflərini görürsünüz. Telefonda aşağı menyuda Tənzimləmələrin yerində indi Kontent bankı var." }, en: { title: "Content bank", text: "Write briefs for customers ahead of time: on the new “Content bank” page, pick a customer and add, edit, duplicate or delete briefs. You see everyone’s briefs. On phones, the Content bank now takes Settings’ place in the bottom bar." } },
      { kind: "new", icon: "brief", for: "employees", writers: true, az: { title: "Kontent bankı", text: "Brifləri əvvəlcədən yazın: menyudakı yeni “Kontent bankı” səhifəsində sizə açılan müştərilər üçün brif əlavə edin, düzəldin, çoxaldın və ya silin. Yalnız öz yazdığınız briflər görünür. Telefonda aşağı menyuda Tənzimləmələrin yerində indi Kontent bankı var." }, en: { title: "Content bank", text: "Write briefs ahead of time: on the new “Content bank” page, add, edit, duplicate or delete briefs for the customers open to you. Only the briefs you wrote are shown. On phones, the Content bank now takes Settings’ place in the bottom bar." } },
      { kind: "new", icon: "list", writers: true, az: { title: "Kontent bankından seç", text: "Yeni brif yazanda “Kontent bankından seç” ilə hazır brifi kontent ID-yə əlavə edin. Bank brifi ilə kontent ID-nin brifi bağlı qalır: birində edilən dəyişiklik digərində də görünür. Belə brifin kartdakı “Brif” işarəsində kiçik kitab var." }, en: { title: "Pick from the content bank", text: "When writing a new brief, add a ready one to the content ID with “Pick from the content bank”. The bank brief and the content ID’s brief stay linked: a change in one shows in the other. The card’s “Brief” tag shows a small book for such briefs." } },
      { kind: "new", icon: "settings", for: "staff", az: { title: "Qrafik dizayner rolu", text: "Tənzimləmələr → İstifadəçilər bölməsində yeni rol var: qrafik dizayner əməkdaş kimi işləyir, amma brif yaza və Kontent bankını aça bilməz. Orada hər əməkdaş üçün bankda hansı müştərilərə brif yaza biləcəyini də seçə bilərsiniz." }, en: { title: "Graphic designer role", text: "Settings → Users has a new role: a graphic designer works like an employee but can’t write briefs or open the Content bank. There you can also choose which customers each employee can write bank briefs for." } },
      { kind: "improved", icon: "sparkle", az: { title: "Telefonlarda tapşırıq kartlarının görünüşündə təkmiləşdirmələr.", text: "" }, en: { title: "Improvements to how task cards look on phones.", text: "" } },
      { kind: "improved", icon: "logout", az: { title: "Profil paneli", text: "Sağ yuxarıda adınıza toxunanda panel açılır: Tənzimləmələr və Çıxış artıq oradadır." }, en: { title: "Profile panel", text: "Tap your name at the top right to open a panel: Settings and Log out are there now." } },
    ],
  },
  {
    version: "0.19.2",
    date: "2026-11-26",
    items: [
      { kind: "fixed", icon: "status", az: { title: "Təxirə salınmış tapşırıqlar sonrakı günlərdə görünmür", text: "Təxirə salınmış tapşırıq artıq yalnız təxirə salındığı gündə göstərilir, ləğv olunmuş tapşırıq kimi." }, en: { title: "Postponed tasks no longer show on later days", text: "A postponed task now shows only on the day it was postponed, like a cancelled one." } },
    ],
  },
  {
    version: "0.19.1",
    date: "2026-11-26",
    items: [
      { kind: "fixed", icon: "status", az: { title: "Ləğv olunmuş tapşırıqlar sonrakı günlərdə görünmür", text: "Ləğv olunmuş və ya tamamlanmış tapşırıq artıq yalnız bağlandığı gündə sayılır: təqvimdəki rəqəmlərdə və günün bütün tapşırıqları siyahısında son tarixə qədər qalmır." }, en: { title: "Cancelled tasks no longer show on later days", text: "A cancelled or finished task now counts only on the day it was closed: it no longer stays in the calendar numbers and the whole-day list until its deadline." } },
      { kind: "fixed", icon: "pin", for: "staff", az: { title: "Kontent ID qeydi öz yerində", text: "Tapşırıq əlavə edəndə və ayı planlayanda kontent ID-nin sarı qeydi artıq sətirdən kənara çıxmır." }, en: { title: "Content ID note stays in place", text: "When adding a task or planning a month, the content ID’s yellow note no longer spills out of its row." } },
    ],
  },
  {
    version: "0.19.0",
    date: "2026-11-26",
    items: [
      { kind: "new", icon: "search", for: "staff", az: { title: "Filtrlər tapşırıqların üstündə", text: "İdarəetmə lövhəsində və Tapşırıqlarımda axtarış qutusu ilə yanaşı status, müştəri, icraçı və tapşırıq növü üzrə filtrlər var. Müştəri siyahısındakı ↗ müştərinin səhifəsini həmin gündə açır." }, en: { title: "Filters above the task list", text: "The managing board and My tasks have filters for status, customer, assignee and task type, next to the search box. ↗ in the customer list opens that customer’s page on the same day." } },
      { kind: "new", icon: "search", for: "employees", az: { title: "Tapşırıqlarımda filtrlər", text: "Tapşırıqlarınızı status, müştəri və tapşırıq növü üzrə filtrləyə və axtarışla tapa bilərsiniz." }, en: { title: "Filters in My tasks", text: "Filter your tasks by status, customer and task type, or find them with the search box." } },
      { kind: "improved", icon: "list", az: { title: "Yalnız tapşırıqlar sürüşür", text: "Kompüterdə təqvim, gün xülasəsi və filtrlər yerində qalır, yalnız tapşırıq siyahısı sürüşür; sürüşdürəndə tarix sətri gizlənir ki, tapşırıqlara daha çox yer qalsın. Telefonda aşağı sürüşdürəndə yuxarıda gün və “Filtr” düyməsi olan kiçik zolaq görünür." }, en: { title: "Only the tasks scroll", text: "On computers the calendar, day summary and filters stay in place and only the task list scrolls; while you scroll, the date line folds away to give the tasks more room. On phones, a slim bar with the day and a Filter button appears at the top when you scroll down." } },
      { kind: "improved", icon: "status", az: { title: "Yığcam gün xülasəsi", text: "Gün xülasəsi daha az yer tutur və hər qrup öz ikonu ilə göstərilir." }, en: { title: "A compact day summary", text: "The day summary takes less space and shows each group with its own icon." } },
      { kind: "fixed", icon: "sparkle", az: { title: "Android-də ağ zolaq yoxdur", text: "Telefona əlavə edilmiş saytda Android-in aşağısındakı ağ zolaq artıq görünmür." }, en: { title: "No white strip on Android", text: "In the site added to an Android phone, the white strip at the bottom is gone." } },
    ],
  },
  {
    version: "0.18.1",
    date: "2026-11-25",
    items: [
      { kind: "improved", icon: "sparkle", for: "employees", az: { title: "Təkmilləşdirmələr edildi", text: "" }, en: { title: "Improvements were made", text: "" } },
      { kind: "improved", icon: "list", for: "staff", az: { title: "“Bərabər payla” ritmlə", text: "Ayı planlayanda “Bərabər payla” kontent ID-ləri ritmlə yerləşdirir: 2 post, 1 video, 2 post… Hər növ öz sırasını saxlayır, əvvəl planlaşdırılan paylaşımlar da nəzərə alınır." }, en: { title: "“Spread evenly” in a rhythm", text: "When planning a month, “Spread evenly” places content IDs in a rhythm: 2 posts, a video, 2 posts, … Each type keeps its order, and publications planned earlier are taken into account." } },
      { kind: "new", icon: "pin", for: "staff", az: { title: "Əl ilə qoyulanlar yerində qalır", text: "Təqvimə özünüz qoyduğunuz kontent ID sancaqla işarələnir və “Bərabər payla” onu yerindən tərpətmir." }, en: { title: "IDs placed by hand stay put", text: "A content ID you put on a day yourself gets a pin, and “Spread evenly” leaves it there." } },
      { kind: "improved", icon: "deadline", for: "staff", az: { title: "Paylaşım ritmi bir sütunda", text: "Ritm indi solda, yuxarıdan aşağıdır: müştərinin bütün paylaşımları birincidən sonuncuya qədər, aylar üzrə, hər növ öz rəngi ilə. “ID-ləri yarat” təqvimin altına keçib." }, en: { title: "The publishing rhythm in one column", text: "The rhythm is now on the left, top to bottom: every publication of the customer from the first to the last, by month, each type in its own colour. “Generate IDs” has moved under the calendar." } },
    ],
  },
  {
    version: "0.17.0",
    date: "2026-11-25",
    items: [
      { kind: "new", icon: "bell", for: "staff", az: { title: "Zənglə xatırlatma", text: "Tapşırıq kartındakı zəngə toxunub tapşırıqdakı insanlara xatırlatma göndərin. Onlara saytda və telefonda bildiriş gedir." }, en: { title: "Remind with the bell", text: "Tap the bell on a task card to remind the people on the task. They get a notification in the site and on their phone." } },
      { kind: "new", icon: "bell", for: "employees", az: { title: "Admin və menecerdən xatırlatma", text: "Admin və ya menecer tapşırığınızın kartındakı zəngə toxunanda saytda və telefonunuzda bildiriş alırsınız. Bildirişə toxunanda tapşırıq açılır." }, en: { title: "Reminders from admins and managers", text: "When an admin or manager rings the bell on your task, you get a notification in the site and on your phone. Tapping it opens the task." } },
      { kind: "improved", icon: "list", for: "staff", az: { title: "Tapşırıq növü siyahıda", text: "Tapşırıq formasında növlər artıq düymələrdə yox, axtarışı olan açılan siyahıdadır, ona görə forma daha az yer tutur." }, en: { title: "Task type in a dropdown", text: "In the task form, the task types are now in a dropdown with search instead of buttons, so the form takes less space." } },
      { kind: "improved", icon: "settings", az: { title: "Tənzimləmələr və Haqqında bölmələri hər zaman ekranın sol alt hissəsində görünəcək", text: "Kompüterdə səhifəni sürüşdürəndə soldakı menyu yerində qalır." }, en: { title: "Settings and About are always at the bottom left of the screen", text: "On computers, the menu on the left stays in place while you scroll." } },
    ],
  },
  {
    version: "0.16.0",
    date: "2026-11-25",
    items: [
      { kind: "new", icon: "brief", for: "employees", writers: true, az: { title: "İşçilər də brif yaza bilər", text: "Tapşırığınız olan kontent ID-nin brifi yoxdursa, kartdakı “+ Kontent brifi əlavə et” ilə onu yaza bilərsiniz. Yalnız özünüz əlavə etdiyiniz brifə düzəliş edə və onu silə bilərsiniz. Adminlərə, menecerlərə və digər tapşırıqlardakı insanlara bildiriş gedir." }, en: { title: "Employees can write briefs too", text: "If a content ID you have a task on has no brief, add one with “+ Add content brief” on the card. You can edit or delete only the briefs you added. Admins, managers and the people on the other tasks are notified." } },
      { kind: "new", icon: "chart", for: "employees", az: { title: "Sizin paneliniz", text: "Daxil olandan sonra öz panelinizi görürsünüz, yalnız sizin tapşırıqlarla: bitənlər (və vaxtında bitənlər), gecikənlər, gün-gün qrafik, qarşıdakı son tarixlər, müştərilər və tapşırıq növləri." }, en: { title: "Your own dashboard", text: "After logging in you land on your own dashboard, with only your tasks: finished (and on time), overdue, a day-by-day chart, your next deadlines, customers and task types." } },
      { kind: "new", icon: "brief", for: "staff", az: { title: "İşçilər də brif yaza bilər", text: "İşçilər tapşırığı olduqları kontent ID-yə brif əlavə edə, öz əlavə etdikləri brifə düzəliş edə və onu silə bilər. Onlar bunu edəndə sizə bildiriş gəlir. Siz istənilən brifi dəyişə bilərsiniz." }, en: { title: "Employees can write briefs too", text: "Employees can add a brief to a content ID they have a task on, and edit or delete the briefs they added. You are notified when they do. You can still change any brief." } },
      { kind: "new", icon: "chart", for: "staff", az: { title: "İşçilər üçün panel", text: "İşçilər daxil olanda öz panellərini görür: yalnız öz tapşırıqları, qarşıdakı son tarixləri, müştəriləri və tapşırıq növləri." }, en: { title: "A dashboard for employees", text: "Employees now land on their own dashboard after logging in, with only their tasks, their next deadlines, customers and task types." } },
    ],
  },
  {
    version: "0.15.1",
    date: "2026-11-24",
    items: [
      { kind: "improved", icon: "list", for: "employees", az: { title: "Kontent ID pəncərəsi hamı üçün", text: "İşçilər də “Tapşırıqlarım”da kartdakı kontent ID-yə toxunub onun bütün tapşırıqlarını görə bilər. Öz tapşırıqlarına toxunanda onların günü açılır; başqalarının tapşırıqları yalnız görünür." }, en: { title: "Content ID window for everyone", text: "Employees can also tap the content ID on their cards in My tasks to see all its tasks. Tapping one of their own tasks opens its day; other people’s tasks are only shown." } },
    ],
  },
  {
    version: "0.15.0",
    date: "2026-11-24",
    items: [
      { kind: "new", icon: "pin", az: { title: "Kontent ID-yə qeyd", text: "Adminlər və menecerlər müştərinin “Kontentlər” bölməsində kontent ID-yə qeyd yaza bilər. Qeyd həmin kontent ID-nin bütün tapşırıqlarında onun altında görünür və tapşırıqlardakı insanlara bildiriş gedir." }, en: { title: "Notes on content IDs", text: "Admins and managers can write a note on a content ID in the customer’s Contents tab. It shows under the content ID on every task of it, and the people on those tasks are notified." } },
      { kind: "new", icon: "list", for: "staff", az: { title: "Kontent ID pəncərəsi", text: "İdarəetmə lövhəsində və müştəri səhifəsində kartdakı kontent ID-yə toxunun: onun bütün tapşırıqları, zaman xətti, qeydi və irəliləyişi bir pəncərədə görünür. Tapşırığa toxunanda onun günü açılır." }, en: { title: "Content ID window", text: "On the managing board and the customer page, tap the content ID on a card to see all its tasks, a timeline, its note and progress in one window. Tapping a task opens its day." } },
      { kind: "new", icon: "bell", az: { title: "Telefon bildirişləri bir toxunuşla", text: "Daxil olandan sonra sayt bu cihazda bildirişləri açmağı özü təklif edir: “Aç” düyməsinə və telefonun “İcazə ver” sualına toxunmaq kifayətdir." }, en: { title: "Phone notifications in one tap", text: "After logging in, the site offers to turn on notifications on this device: tap “Turn on”, then “Allow” in your phone’s box." } },
      { kind: "fixed", icon: "bell", az: { title: "Bildirişlər daha tez gəlir", text: "Xatırlatmalar və bildirişlər artıq bir-iki dəqiqə gecikmir, bir neçə saniyəyə gəlir. Telefon bildirişləri də dərhal çatdırılır." }, en: { title: "Notifications arrive faster", text: "Reminders and notifications no longer come a minute or two late; they arrive within seconds, and phone notifications are delivered straight away." } },
      { kind: "fixed", icon: "brief", for: "staff", az: { title: "Brifdə sahə silinməsi", text: "Brif pəncərəsində sahə silinəndə artıq titrəmə olmur." }, en: { title: "Removing a brief field", text: "Removing a field in the brief window no longer flickers." } },
      { kind: "fixed", icon: "icons", for: "staff", az: { title: "Telefonda ikon seçimi", text: "Tənzimləmələrdə tapşırıq növünün ikon cədvəli artıq telefon ekranına tam sığır." }, en: { title: "Icon picker on phones", text: "The task type icon grid in Settings now fits on phone screens." } },
    ],
  },
  {
    version: "0.14.0",
    date: "2026-11-24",
    items: [
      { kind: "new", icon: "finished", az: { title: "Kontent ID-də tamamlanmış iş", text: "Tapşırıq bitəndə yekun video və ya dizaynın linklərini əlavə edin. Əlavə olunmuş material bu kontent ID-nin bütün tapşırıqlarında yaşıl “Tamamlanmış iş” etiketi kimi görünür." }, en: { title: "Finished work on content IDs", text: "When a task is done, add links to the final video or design. It shows as a green “Finished work” tag on every task of that content ID." } },
      { kind: "new", icon: "icons", az: { title: "Tapşırıq növləri üçün ikonlar", text: "Hər tapşırıq növü üçün uyğun ikonlar əlavə edildi. Bu ikonlara sonradan düzəliş edilə bilir." }, en: { title: "Icons for task types", text: "Each task type has an icon before its name on cards and in the task form." } },
      { kind: "new", icon: "sparkle", az: { title: "Yeniliklər pəncərəsi", text: "Yeni versiyadan sonra nələrin dəyişdiyini burada görürsünüz. Bütün versiyalar “Haqqında” səhifəsindədir." }, en: { title: "This “What’s new” window", text: "After an update you see what changed, right here. Every version is listed on the About page." } },
      { kind: "improved", icon: "settings", for: "staff", az: { title: "Yenilənmiş Tənzimləmələr", text: "Bölmələr ikonlu menyuda; sətirlər açılıb-bağlanır, silinən sətri geri qaytarmaq olar, tapşırıq növünə ikon seçilir." }, en: { title: "Redesigned Settings", text: "Sections in a menu with icons; rows open and close, a deleted row can be brought back with Undo, and task types get an icon picker." } },
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
      { kind: "improved", icon: "search", for: "staff", az: { title: "Daha geniş axtarış", text: "İdarə lövhəsində axtarış qutusu bütün eni tutur." }, en: { title: "Wider search", text: "The board’s search box takes the full width." } },
    ],
  },
  {
    version: "0.12.0",
    date: "2026-11-23",
    items: [
      { kind: "new", icon: "brief", az: { title: "Kontent brifləri", text: "Kontent ID-yə brif: mətnlər, linklər, yoxlama siyahısı. Bütün tapşırıqlarında tünd “Brif” etiketi kimi görünür." }, en: { title: "Content briefs", text: "A brief on a content ID: texts, links, a checklist. It shows as a dark “Brief” tag on all its tasks." } },
      { kind: "new", icon: "settings", for: "staff", az: { title: "Brifin başlanğıc sahələri", text: "Tənzimləmələr → Kontent brifi: hər yeni brifin hansı sahələrlə başladığını seçin." }, en: { title: "Starting fields for briefs", text: "Settings → Content brief: choose the fields every new brief starts with." } },
    ],
  },
  {
    version: "0.11.0",
    date: "2026-11-23",
    items: [
      { kind: "new", icon: "deadline", az: { title: "Kartda vaxt zolağı", text: "Son tarixi olan tapşırıqda başlanğıcdan son tarixə qədər zolaq." }, en: { title: "Timeline strip on cards", text: "A task with a deadline shows a strip from its start to its deadline." } },
      { kind: "new", icon: "bell", az: { title: "“1 gün qalıb” bildirişi", text: "Son tarixdən bir gün əvvəl tapşırıqdakı insanlara və onu yaradana." }, en: { title: "“1 day left” notifications", text: "One day before a deadline, to the people on the task and whoever created it." } },
      { kind: "improved", icon: "logout", az: { title: "Çıxış Tənzimləmələrdə", text: "Çıxış düyməsi Tənzimləmələrdədir və əvvəlcə soruşur." }, en: { title: "Log out in Settings", text: "The log out button is in Settings and asks first." } },
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
  // (Give it releasesFor(role) so that only what is meant for the person counts.)
  return releases.filter((r) => r.items.length && compareVersions(r.version, seen) > 0 && compareVersions(r.version, current) <= 0);
}

/**
 * The releases as one person sees them: admins and managers get the items for everyone and for
 * "staff", employees those for everyone and for "employees". Graphic designers see what employees
 * see, except items about writing briefs (`writers`). A version left with nothing is dropped.
 */
export function releasesFor(role: "admin" | "manager" | "employee" | "designer", releases: Release[] = RELEASES): Release[] {
  const audience: Audience = role === "admin" || role === "manager" ? "staff" : "employees";
  return releases
    .map((r) => ({ ...r, items: r.items.filter((i) => (!i.for || i.for === audience) && !(role === "designer" && i.writers)) }))
    .filter((r) => r.items.length);
}

export type ShownItem = { kind: ReleaseKind; icon: ReleaseIcon; title: string; text: string };
export type ShownRelease = { version: string; date: string; items: ShownItem[] };

/** A release in one language, items grouped New → Improved → Fixed. */
export function localRelease(r: Release, locale: Locale): ShownRelease {
  const order: ReleaseKind[] = ["new", "improved", "fixed"];
  const items = [...r.items].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)).map((i) => ({ kind: i.kind, icon: i.icon, ...(locale === "en" ? i.en : i.az) }));
  return { version: r.version, date: r.date, items };
}
