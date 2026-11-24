# Zeyn Media task planner

A website for planning Zeyn Media's customers, content and tasks. It replaces the team's task spreadsheet.

## What is built so far

| Stage | What | Status |
|---|---|---|
| 1 | Foundation: login with 8-character codes, roles, page frame, Azerbaijani and English | Done |
| 2 | Settings: users, statuses, task types, content types, holidays and events | Done |
| 3 | Customers, content IDs, contract renewal | Done |
| 4 | Tasks, managing board, task form, archiving | Done |
| 5 | Month planner | Done |
| 6 | Dashboard | Done |
| 7 | My tasks and personal tasks | Done |
| 8 | Notifications, including phone push | Done |
| 9 | Going live on project.zeynmedia.az (Railway) | Done |

Until its stage is built, a page shows "This page is being built".

## How it is put together

- **The site**: [Next.js](https://nextjs.org) with TypeScript. Pages live in `src/app`.
- **The data**: a MySQL (or MariaDB) database, as offered by the hosting. Its structure is described in `src/db/schema.ts`, and each change to that structure is saved as a file in `drizzle/`.
- **Hosting**: [Railway](https://railway.com) runs the site and its MySQL database, on `project.zeynmedia.az`. The domain stays at Turhost, which keeps hosting the main website and e-mail; Turhost's hosting plans can't run Node.js apps.
- **Interface text**: both languages live in `src/i18n/dictionaries.ts`.
- **Design**: colours and fonts are defined once in `src/app/globals.css`.

The repository holds code only. Customers, tasks and users live in the database, and passwords and keys live in a file called `.env.local` that is never uploaded.

## Roles

| | Admin | Manager | Employee |
|---|---|---|---|
| First page after login | Dashboard | Dashboard | My tasks |
| Dashboard, managing board, customers | Yes | Yes | No |
| My tasks | Yes | Yes | Yes |
| Settings: appearance and language | Yes | Yes | Yes |
| Settings: users, statuses, types, holidays | Yes | No | No |
| About | Yes | Yes | Yes |

A person who opens a page their role may not see is sent back to their own first page.

## Access codes

- Everyone logs in with their own 8-character code (letters, numbers and symbols; capitals matter).
- Admins can show and copy anyone's code in Settings → Users (the eye button). For logging in only a one-way hash is used; to be able to show a code again, an encrypted copy is kept too, locked with a key made from `AUTH_SECRET`. So the codes can be read only through the site by an admin, or by someone who has both the database and `AUTH_SECRET`. Codes made before this existed can't be shown: give a new code to see it.
- After 8 wrong codes from the same address within 15 minutes, logging in from that address is paused for 15 minutes.
- "Keep me logged in on this device" keeps a person logged in for 30 days. Without it, the login ends when the browser closes, or after 12 hours.

## Appearance, language and About (everyone)

Settings → **Appearance and language**, for every role, saved on the device: **Light**, **System** (follows the device's light or dark mode) or **Dark** (small previews of the page, with a ring that glides to the chosen one), the language (Azərbaycan / English), links to the About page and to **What's new**, and **Log out**, the only place to log out. It asks "Log out?" first, reminding that the access code is needed to log back in. The theme is applied before the page is drawn, so there is no flash.

The **About** page shows the version and its stage (**Beta** until `APP_STAGE=production` is set on the hosting when the site goes live on its real address), what the site is for, what it does and who can do what, and **What's new**: every version with what changed, newest first, the running one marked "Live now" (older ones fold away). The version number comes from `package.json`; see [Versions](#versions).

**What's new window**: the first time someone opens the site after a version with visible changes goes live, a window shows what changed: grouped as New, Improved and Fixed, each item with an icon and a short text in the site's language; items about admin tools carry an "Admins" tag (everyone sees the whole list). If someone skipped versions, the earlier ones are folded under "Also in …". "Got it", ✕, Escape or "All versions →" closes it for good: it is remembered per person (`users.seen_version`), on every device. Someone new starts at the current version and sees no window. On a computer it pops up in the middle; on a phone it slides up from the bottom and can be swiped down. The texts are in `src/lib/whats-new.ts`, written with each release in both languages; a version's date is the day it is merged into `main`.

On phones, the main pages are in a bar along the bottom of the screen and About is in Settings. On wider screens they are in the rail on the left.

All colours are named in `src/app/globals.css`, each with a value for the dark theme.

Every button (and every link styled as one) shrinks slightly while pressed and springs back on release: scale 0.97 on a spring with stiffness 550 and damping 30, the same as Animate UI's Button. It is done once for the whole site in `src/components/press-animation.tsx`, so new buttons get it automatically; nothing moves on hover, for disabled buttons, or when the device asks for reduced motion. Add `data-no-press` to leave an element out.

The login code boxes are animated the way Animate UI's Input OTP describes, built into `src/app/login/login-form.tsx` (the code still lives in one ordinary text field, so typing, pasting, autofill and password managers work as before): a typed character lands small and grows into place on a spring that never overshoots; pasted codes stagger in; the ring glides from box to box and turns red for a refused code; Backspace shrinks the character away; clearing the code drops the characters out one by one into a blur; a completed code sends a small wave through the boxes. With reduced motion, characters only fade. The springs are in `src/lib/spring.ts`.

## Settings (admin only)

Sections are in a menu on the left with an icon and a count each (a row of chips along the top on phones); a teal pill slides to the chosen section and the section fades across. Each section has a yellow **+ Add …** button whose + turns into × while its form is open. Rows show one line until opened, one at a time; their settings slide out underneath. New rows grow in with a fading teal outline. Deleting asks with a yellow bar inside the row, then the row shrinks away and **Undo** is offered for 5 seconds. On/off settings are switches; role and kind are pills that slide; colours have a ring that glides. Deactivated people, archived content types and past holidays fold away in their own groups. With "reduce motion" switched on, things simply appear.

- **Users, roles and codes**: add people (their code is shown at once), rename them, change their role, show or copy their code (the characters blur into view one by one; the copy button turns into a tick), give them a new code, deactivate (with Undo) or reactivate them. A new code logs the person out everywhere and their old code stops working. A deactivated person is logged out at once and can't log in; their tasks and history stay. Nobody can change their own role or deactivate themselves, so there is always at least one admin.
- **Statuses**: rename, recolour, reorder by dragging, mark which ones count as finished, add and delete. New tasks start with the first status. At least one status must count as finished. A status can instead **count as cancelled** (the task is closed like a finished one, shows only on the day it was cancelled, and is never overdue) or **count as postponed** (the task stays on its day, shows under "Postponed" instead of overdue, and gets no reminders). Only admins and managers can move a task into either; employees don't see those statuses on their cards. A deleted status is only marked as deleted, so tasks that used it can show "Deleted status (its name)" and stay finished if it counted as finished.
- **Task types**: rename, reorder by dragging, add and delete (deleted ones are kept the same way, and Undo brings one back). Each type has an **icon** (18 to choose from: camera, scissors, clapper, palette, pen, image, text, send, microphone, music, megaphone, live, idea, research, chat, calendar, location, layers), picked by tapping the icon at the start of its row or in the add form; it is saved at once and shows before the type's name on task cards, in the task form's type buttons, its day list and the customer's whole-day list. The starting types got camera, scissors, palette, text and send; others start with layers. "Post publishing" is the type the month planner uses, so it can be renamed but not deleted.
- **Content types**: a short code (it goes inside content IDs, as in `thrive-vid-nd26-1`) and a name, with a small bar showing how many content IDs use it. Archived, never deleted; archived ones fold away under "Archived".
- **Holidays and special events**: date, name, holiday or special event, and whether it repeats every year. Each shows a date tile, its kind, a mark when it repeats and "In N days"; they are in date order (a new or moved day glides to its place), and past days fold away under "Earlier".
- **Content brief**: the fields every new content brief starts with (Goal, Key message, Script / caption, Materials, References to begin with). Each has an Azerbaijani name and optional English one, a type (short text, long text, links, checklist, date), a hint (the grey text in the empty box) and a Show switch: hidden fields aren't added to new briefs but can still be picked by the writer. Rows open one at a time; new rows grow in, removed ones shrink away with Undo, rows can be dragged. Changes apply to new briefs only.
- **Names in two languages**: statuses, task types and holidays/events have an Azerbaijani name (required) and, under it, an optional English one. With the site in English, people see the English name; where it is empty they see the Azerbaijani one. Notifications use the reader's language too.

A new installation starts with four statuses (Ediləcək / To do, İcrada / In progress, Yoxlamaya hazır / Ready for review, Tamamlandı / Done), five task types (Video çəkilişi / Video shoot, Video montajı / Video edit, Qrafik dizayn / Graphic design, Mətnin yazılması / Caption writing, Postun paylaşılması / Post publishing) and two content types (`vid`, `gpost`). All can be changed. An existing installation gets the same Azerbaijani names on its update, with the English ones kept as the English names; a status or type that was already renamed is left as it is.

## Customers and content IDs

- **Customers** (admin adds, edits, renews and archives; managers can view): company name, a short name that starts every content ID, contact details, notes and a contract period. Archived customers leave the list but keep everything.
- **Contracts**: renewing adds a new period and keeps the old ones as history. The default renewal starts the month after the current contract and lasts as long.
- **Content IDs** (admin and manager add and rename; only admin archives) follow the scheme `[short name]-[type code]-[period]-[number]`, e.g. `thrive-vid-nd26-1`. The period uses English month initials and the year, both years when it crosses the new year: `nd26`, `dj2627`, `n26` for a single month. The next free number is suggested and can be overwritten; an ID can't be used twice.
- Once content IDs use a content type, its code is locked in Settings.
- **Note on a content ID** (admins and managers write it): an optional note for all tasks of a content ID, up to 500 characters. It can be typed when adding a content ID, once for all the IDs made with "Generate IDs and plan month", or later in the Contents tab: open the content ID's row to see it in a yellow box with **Edit** (empty it and save to remove it), or "+ Add note for all its tasks". A closed row shows a one-line preview. The note shows in a soft strip with a pin under the content ID on every task card of it (long notes show two lines and **More**, which opens smoothly), and under the content ID when it is picked in the task form. The people on its tasks are notified when it is added or changed.

## Tasks and the managing board

- Every task belongs to a content ID. It has a type, one or more assignees, a date, an optional deadline, an optional description and note, and a status; new tasks start with the first status.
- **Deadline**: a task can have a deadline after its date (same day, +1, +2, +3 days, +1 week, or any date). Until it is finished, it shows on every day from its date to its deadline, and only counts as overdue after the deadline. The card shows a **timeline strip**: the start day on the left, the deadline on the right, and a bar that fills up to today with a "Today" marker. A chip says where it stands: "Starts in 2 days", "1 day left", "Due today" (yellow), "2 days late" (red), or once finished "Done 1 day early", "Done on time" or "Done 1 day late". On phones the chip moves under the bar. Tasks without a deadline keep the plain "Due 26 Nov" line. Moving the task's date moves its deadline with it. Reminders, overdue alerts and the dashboard go by the deadline.
- **Several people on one task**: in the task form, tap each person to add or remove them. Everyone on a task sees it in My tasks, can change its status and add notes, and gets its notifications and reminders. The card shows the first name and "+N", with overlapping avatars: hover over one (or tap it on a phone, or reach it with Tab) and it rises with a little bounce while a label with the name glides from avatar to avatar. With "reduce motion" switched on in the device's settings, the avatar simply moves up and the label just fades in.
- **Content brief**: what a content ID is really about, written once and shown on every task of that content ID.
  - Admins and managers see **+ Add content brief** on a card whose content ID has none. The window starts from the starting fields in Settings; fields can be renamed, dragged, removed (with Undo) and added by type (short text, long text, links with a name each, checklist, date) or from the hidden starting fields. Empty fields are left out. "Reset to starting fields" asks first if something was typed.
  - Once written, a dark **Brief** tag follows the content ID on all its cards. Everyone on those tasks can read it (links open in a new tab and show their site); admins and managers can also edit or delete it. Employees only see briefs of content IDs they have a task on, and links can only be web addresses.
- **Finished work**: links to the final video, design or post, saved on the content ID and shown on every task of it.
  - When someone moves a task to a finished status, the card asks "Done! Add the finished work?": named links (several, "+ Another link"), **Save** or **Not now**. Finished cards whose content ID has none show **+ Add finished work**.
  - Once saved, a green **Finished work** tag ("Finished" on phones) follows the content ID on all its cards, and in the customer's Contents tab. It opens a window with the links (site badge, name, Open ↗) and who added or edited it.
  - Anyone on a task of that content ID can add it while there is none; admins and managers can always add it. **Edit and Delete**: admins, managers and whoever added it; others can only read it. Delete asks first. Links must be web addresses.
- **Cancelled and postponed tasks are locked for employees**: only admins and managers can change the status of a task that is cancelled or postponed (the status button is greyed out for the people on it).
- **A task with nobody on it is a draft**: it shows in the customer's Drafts box only, never on the managing board.
- **Day views** (managing board, customer Tasks tab, My tasks): unfinished tasks show on their date, or on every day from their date to their deadline; on today's view, unfinished tasks whose deadline has passed also show as overdue; finished tasks show on the day they were finished. "Today" is taken in Baku time (`APP_TIME_ZONE`).
- **Managing board** (admin, manager): calendar, day summary (overdue, open, postponed, finished, cancelled), filters by customer and person, search, the All / Overdue / Due / Postponed / Finished / Cancelled filter, and status changes from each card. "Open task" opens the task form on the customer's page.
- **Task form** (customer page, yellow button): type (or "Other…", optionally saved to the list), content ID with its publish date, the people on it (each with their load that day), description, note, and a calendar showing how many tasks each day already has, with holidays marked and that day's tasks grouped by person, in aligned columns: content ID, type and customer (long names shortened with "…"; on phones a small tile per task).
- Tasks are archived, never deleted (admin only), and can be restored from the Contents tab, where each content ID shows its publish date, progress and tasks.
- **Notes**: each task card has a Notes button. The people on the task, admins and managers can read and add notes (up to 10 per task); everyone can delete their own, and admins can delete any. Content IDs are always listed in counting order (…-2 before …-10).
- A task whose status or type was deleted in Settings shows "Deleted status (name)" or "Deleted task type (name)".

## Month planner

Opened from the customer page (yellow button → Plan month, or "Generate IDs and plan month" on the Contents tab). Admins and managers can use it.

- **Content IDs to place**: the customer's content IDs that have no publish date yet. Pick one, then click a day; the next one is picked for you. Click a new chip on the calendar to take it off again.
- **Generate IDs**: choose how many of each content type to create for the contract that covers the month shown. Numbers continue from the last ID of each type, and a preview shows the IDs before they are created.
- **Calendar**: each day shows how many tasks it already has across all customers, holidays and special events, publications already planned (grey) and the new ones (teal). Past days can't be picked. On phones it becomes a list of the remaining days.
- **Spread evenly** places every unplaced ID between a chosen first and last day (by default, today or the start of the month shown, to its end), as far apart as possible, around the publications already planned, alternating content types. The chosen days are tinted on the calendar. Weekends and holidays are not skipped.
- **Publishing rhythm**: the month's publishing days as a row of cards with the days between them; the longest gap is highlighted.
- **Save** creates one "Post publishing" draft (no assignee, first status) per placed ID. Drafts stay off the managing board until someone is assigned, from the customer's Drafts box. A content ID that already has a publishing task is never given a second one.

## Dashboard

The first page for admins and managers. It shows counts and charts for a month (the default) or a week, never task details. Arrows move to the previous or next period, and "Go to this month/week" comes back.

- **Totals**: tasks (compared with the period before), finished (and their share), overdue (unfinished and past their date), and drafts waiting for an assignee, plus postponed and cancelled tasks (neither counts as overdue; cancelled ones don't count as finished).
- **Tasks per day**: finished and open tasks for each day, with holidays and special events marked. Pick or hover a day to read its numbers; "Open this day" opens it on the managing board.
- **Team workload**, **Customers**, **Tasks by status** and **Content types**: how the period's tasks split up, each bar showing finished and open.

Every task with someone on it counts on its deadline (or its date when it has none), for each person on it (a task for two people counts once in the totals and once for each of them by person); archived tasks don't count. Drafts appear only in their own total, just as the managing board leaves them out.

## My tasks and personal tasks

Everyone has a My tasks page; it is the first page for employees, and the only one besides logging out.

- **Assigned tasks**: only the tasks assigned to you, in the same day view as the managing board (overdue on today's view, due, finished), with a calendar and a summary of your day. You can change the status of your own tasks, including straight to a finished status such as Done. Employees can't edit tasks; admins and managers get "Open task" as on the board.
- **Personal tasks**: private to-dos with a title, an optional note and an optional time, added to the day you are looking at. "Remind me" can be any of: at the time, 15 minutes, 1 hour or 1 day before (without a time, these count from 09:00 that day). Tick to mark done, or delete. Unfinished ones from earlier days also show on today, marked "From [date]".
- Personal tasks are kept in their own table (`personal_tasks`) and are read only by their owner's My tasks page, so nobody else sees them in the site, admins included, and they never count on the dashboard, the board or anyone's workload. Like everything else, they are stored in the database, so whoever manages the hosting database can technically read it.

## Notifications

The bell in the top bar shows how many notifications are unread; it checks again every 30 seconds and whenever the page comes back into view, and when something new has arrived the page refreshes its data, so cards and notes show the change without reloading. The panel lists them by Today and Earlier, with All / Unread and "Mark all as read". Tapping a task notification marks it read and shows the task in a window over the page you are on (with its notes open for a note); admins and managers can go on to edit it with "Open task". Closing the window leaves the page as it was. Any page can show a task this way with `?task=<id>` in the address, which is also where phone notifications lead.

| Notification | Who gets it |
|---|---|
| New task assigned to you | Each person put on a task, when it is created or when they are added to it |
| You are no longer on a task | A person taken off a task (with who has it now) |
| A task of yours changed | The people on a task, when the date, description or note changes, or when someone else changes its status |
| Status changed | Admins and managers, on every status change made by someone else (old status → new status, and who) |
| Ready for review | Admins and managers, when a task moves into a status marked "Sends ‘Ready for review’" (Settings → Statuses); this replaces "Status changed" for that move |
| Reminder | The people on a task, when it has reminders set (see below) |
| Content brief added or updated | Everyone on the tasks of that content ID except whoever wrote it; it opens the task with the brief open. Part of the "Changes to my tasks" setting |
| Note on a content ID added or changed | The people on the tasks of that content ID, except whoever wrote it. Part of the "Changes to my tasks" setting |
| Finished work added or updated | Admins, managers and the people on the other tasks of that content ID, except whoever did it; it opens the task with the finished work open. Part of the "Changes to my tasks" setting |
| 1 day left until the deadline | The people on a task and whoever created it, at 09:00 the day before its deadline (tasks with a deadline only, while unfinished). Part of the Reminders setting |
| New note on a task | Admins and managers, and the people on the task, when someone else adds a note to it |
| Personal reminder | Only the owner of a personal task with reminders |
| A task became overdue | Admins and managers, at 09:00, for tasks that passed their date unfinished (more than 3 become one notification) |
| Morning summary | Everyone at 09:00: the day's tasks, overdue and drafts (employees: their own; skipped when they have nothing) |

**Task reminders**: the task form has "Reminders for the people on it": no reminder (the default), or any of 1, 3 and 5 days before the deadline (or the task's date when it has none), at one chosen time (Baku time). Each reminder goes once to everyone on the task. Changing the due date or the time makes them all due again; adding or removing one leaves the others as they were. They aren't sent for finished or archived tasks, or once the due date has passed. A reminder whose moment has already passed when it is set goes out right away; if several are due at once, one notification covers them.

Nobody is notified about their own changes. Each person chooses what they want in the panel's settings, and can turn on **phone notifications on this device**. On an iPhone (iOS 16.4 or newer) the site must first be added to the home screen and opened from there. Phone notifications need the site on HTTPS (or `localhost` when testing on your own computer).

How it works:

- Notifications are stored per person in the database (`notifications`) and written out in the language the site is shown in. They are kept for 90 days.
- All times are stored in UTC: every database connection is set to UTC, whatever time zone the MySQL server itself uses, and shown in Baku time.
- Phone notifications use Web Push. The signing keys are created on first use and kept in the database (`app_values`), so nothing needs setting up on the hosting; `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` can be set instead. Devices that no longer accept pushes are forgotten automatically.
- The 09:00 work runs once a day (Baku time): from a timer while the server is running, and also on the first page visit after 09:00 in case the hosting put the server to sleep overnight. A database row claims each day, so it never runs twice. Set `SKIP_DAILY_JOBS=1` to turn the timer off.
- Task reminders are checked about once a minute by the same timer, and on page visits. If the hosting has put the server to sleep, a reminder goes out when the server next wakes.

## First start on a new server

The first time the site is opened on an empty database, it shows a one-time setup page where you create the first admin and receive their access code. Once that admin exists, the setup page closes for good and everyone else is added from Settings.

Pending database changes are applied automatically each time the app starts (see `src/instrumentation.ts`), both on the hosting and with `npm run dev` on your own computer, so the hosting never needs a command line and a pulled update never needs an extra step. Set `SKIP_MIGRATIONS=1` to turn this off.

## Running it on your own computer

You need two free programs, installed once:

- **Node.js 22** (the "LTS" installer from [nodejs.org](https://nodejs.org)).
- **MySQL**. On a Mac the simplest is [DBngin](https://dbngin.com): create a MySQL 8 service and press Start. On Windows, use the MySQL installer from [dev.mysql.com](https://dev.mysql.com/downloads/installer/) and note the root password you choose.

Then, in a terminal opened in the project folder:

```bash
npm install
```

```bash
npm run setup:local
```

```bash
npm run dev
```

Open http://localhost:3000. The first time, the setup page creates your admin and shows your access code.

`npm run setup:local` creates `.env.local` for a MySQL user `root` with no password (DBngin's default), creates the database and its tables. If your `root` has a password, put it after `DB_PASSWORD=` in `.env.local` and run the command again. It's safe to run any time, for example after downloading a newer version.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the site for development |
| `npm run build` | Builds the site the way the hosting service will |
| `npm run test` | Runs the automatic checks |
| `npm run lint` and `npm run typecheck` | Check the code for mistakes |
| `npm run db:generate` | After changing `src/db/schema.ts`, writes the matching database change into `drizzle/` |
| `npm run local` | Everything for running locally in one go: installs what's needed, updates the database, starts the site |
| `npm run setup:local` | First-time setup on your own computer (settings file, database, tables) |
| `npm run db:migrate` | Applies pending database changes |
| `npm run user:create -- "Name" role` | Creates a person (`admin`, `manager` or `employee`) and prints their code |
| `npm run user:code -- "Name"` | Gives an existing person a new code and prints it (e.g. a locked-out admin); part of the name is enough |

## The live site (Railway)

Railway builds the site from this GitHub repository and runs it with `npm start`; the database tables are created or updated on every start. The service needs these variables (set in Railway, never in the repository):

- `DATABASE_URL`: the MySQL database's connection address (Railway provides it), or `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` separately.
- `AUTH_SECRET`: a random string of at least 32 characters. Changing it later makes every existing access code stop working.
- `APP_STAGE`: `production` (the About page then shows "Live" instead of "Beta").

The address `project.zeynmedia.az` is a custom domain in Railway, with a DNS record for `project` in Turhost's cPanel (Zone Editor) pointing to it.

### Updating the live site

1. A change is pushed to GitHub on a work branch.
2. Try it on your own computer: download the update and run `npm run local`. Your computer has its own database, so nothing you do there touches the live site.
3. When it's good, merge the work branch into `main` on GitHub (a pull request, then "Merge").
4. Railway sees the new `main`, builds it and swaps the site over in a few minutes. Data stays; database changes are applied automatically when the new version starts.

If building a new version fails, Railway keeps the previous one running.

## Versions

Every change that reaches the live site gets a new version number in `package.json`, shown on the About page: the middle number goes up for new features, the last one for fixes only.

| Version | What changed |
|---|---|
| 0.15.0 | A note on a content ID, written on the Contents tab (or when adding or generating IDs) and shown under the content ID on every task card of it; the task type icon grid fits on phones |
| 0.14.0 | Finished work on content IDs (asked after "Done", green tag on every task of the content ID, notifications); icons for task types; the "What's new" window and the version list on the About page; a redesigned Settings (menu with icons, rows that open, Undo, switches, groups, theme previews); cancelled and postponed tasks locked for employees |
| 0.13.1 | The task form's day list in tidy columns (content ID · type · customer; a small tile per task on phones); opening and closing panels (notes, the personal task form, brief fields, Settings rows) ease in and out with no jump; the personal task form no longer brings up the keyboard on phones |
| 0.13.0 | Statuses that count as cancelled or postponed, shown in the day summary, the board filter and the dashboard; wider board search; the brief's "Add field" list opens upwards when there is no room below |
| 0.12.0 | Content briefs on content IDs, with their starting fields in Settings → Content brief |
| 0.11.0 | Timeline strip on cards with a deadline; "1 day left" notifications; content IDs in the task form's day list; log out only in Settings, after a confirmation |
| 0.10.0 | Deadlines: a task shows every day from its date to its deadline until it is finished |
| 0.9.0 | First live version: everything up to several people per task, the avatar group and English names |
