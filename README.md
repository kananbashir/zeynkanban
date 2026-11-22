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
| 8 | Notifications, including phone push | Next |
| 9 | Going live on a zeynmedia.az subdomain | |

Until its stage is built, a page shows "This page is being built".

## How it is put together

- **The site**: [Next.js](https://nextjs.org) with TypeScript. Pages live in `src/app`.
- **The data**: a MySQL (or MariaDB) database, as offered by the hosting. Its structure is described in `src/db/schema.ts`, and each change to that structure is saved as a file in `drizzle/`.
- **Hosting**: the Node.js app feature of the Turhost cPanel account, on `projects.zeynmedia.az`.
- **Interface text**: both languages live in `src/i18n/dictionaries.ts`.
- **Design**: colours and fonts are defined once in `src/app/globals.css`.

The repository holds code only. Customers, tasks and users live in the database, and passwords and keys live in a file called `.env.local` that is never uploaded.

## Roles

| | Admin | Manager | Employee |
|---|---|---|---|
| First page after login | Dashboard | Dashboard | My tasks |
| Dashboard, managing board, customers | Yes | Yes | No |
| My tasks | Yes | Yes | Yes |
| Settings | Yes | No | No |

A person who opens a page their role may not see is sent back to their own first page.

## Access codes

- Everyone logs in with their own 8-character code (letters, numbers and symbols; capitals matter).
- A code is shown once, when it is created. Only a scrambled form is stored, so nobody can look a code up later, not even in the database. A forgotten code is replaced with a new one.
- After 8 wrong codes from the same address within 15 minutes, logging in from that address is paused for 15 minutes.
- "Keep me logged in on this device" keeps a person logged in for 30 days. Without it, the login ends when the browser closes, or after 12 hours.

## Settings (admin only)

- **Users, roles and codes**: add people, rename them, change their role, give them a new code, deactivate or reactivate them. A new code logs the person out everywhere and their old code stops working. A deactivated person is logged out at once and can't log in; their tasks and history stay. Nobody can change their own role or deactivate themselves, so there is always at least one admin.
- **Statuses**: rename, recolour, reorder by dragging, mark which ones count as finished, add and delete. New tasks start with the first status. At least one status must count as finished. A deleted status is only marked as deleted, so tasks that used it can show "Deleted status (its name)" and stay finished if it counted as finished.
- **Task types**: rename, reorder by dragging, add and delete (deleted ones are kept the same way). "Post publishing" is the type the month planner uses, so it can be renamed but not deleted.
- **Content types**: a short code (it goes inside content IDs, as in `thrive-vid-nd26-1`) and a name. Archived, never deleted.
- **Holidays and special events**: date, name, holiday or special event, and whether it repeats every year.

A new installation starts with four statuses (To do, In progress, Ready for review, Done), five task types and two content types (`vid`, `gpost`). All can be changed.

## Customers and content IDs

- **Customers** (admin adds, edits, renews and archives; managers can view): company name, a short name that starts every content ID, contact details, notes and a contract period. Archived customers leave the list but keep everything.
- **Contracts**: renewing adds a new period and keeps the old ones as history. The default renewal starts the month after the current contract and lasts as long.
- **Content IDs** (admin and manager add and rename; only admin archives) follow the scheme `[short name]-[type code]-[period]-[number]`, e.g. `thrive-vid-nd26-1`. The period uses English month initials and the year, both years when it crosses the new year: `nd26`, `dj2627`, `n26` for a single month. The next free number is suggested and can be overwritten; an ID can't be used twice.
- Once content IDs use a content type, its code is locked in Settings.

## Tasks and the managing board

- Every task belongs to a content ID. It has a type, an assignee, a date, an optional description and note, and a status; new tasks start with the first status.
- **A task without an assignee is a draft**: it shows in the customer's Drafts box only, never on the managing board.
- **Day views** (managing board, customer Tasks tab): unfinished tasks show on their due day; on today's view, unfinished tasks from earlier days also show as overdue; finished tasks show on the day they were finished. "Today" is taken in Baku time (`APP_TIME_ZONE`).
- **Managing board** (admin, manager): calendar, day summary, filters by customer and assignee, search, and status changes from each card. "Open task" opens the task form on the customer's page.
- **Task form** (customer page, yellow button): type (or "Other…", optionally saved to the list), content ID with its publish date, assignee with their load that day, description, note, and a calendar showing how many tasks each day already has, with holidays marked and that day's tasks grouped by person.
- Tasks are archived, never deleted (admin only), and can be restored from the Contents tab, where each content ID shows its publish date, progress and tasks.
- A task whose status or type was deleted in Settings shows "Deleted status (name)" or "Deleted task type (name)".

## Month planner

Opened from the customer page (yellow button → Plan month, or "Generate IDs and plan month" on the Contents tab). Admins and managers can use it.

- **Content IDs to place**: the customer's content IDs that have no publish date yet. Pick one, then click a day; the next one is picked for you. Click a new chip on the calendar to take it off again.
- **Generate IDs**: choose how many of each content type to create for the contract that covers the month shown. Numbers continue from the last ID of each type, and a preview shows the IDs before they are created.
- **Calendar**: each day shows how many tasks it already has across all customers, holidays and special events, publications already planned (grey) and the new ones (teal). Past days can't be picked. On phones it becomes a list of the remaining days.
- **Spread evenly** places every unplaced ID over the rest of the month, as far apart as possible, around the publications already planned, alternating content types. Weekends and holidays are not skipped.
- **Publishing rhythm**: the month's publishing days as a row of cards with the days between them; the longest gap is highlighted.
- **Save** creates one "Post publishing" draft (no assignee, first status) per placed ID. Drafts stay off the managing board until someone is assigned, from the customer's Drafts box. A content ID that already has a publishing task is never given a second one.

## Dashboard

The first page for admins and managers. It shows counts and charts for a month (the default) or a week, never task details. Arrows move to the previous or next period, and "Go to this month/week" comes back.

- **Totals**: tasks (compared with the period before), finished (and their share), overdue (unfinished and past their date), and drafts waiting for an assignee.
- **Tasks per day**: finished and open tasks for each day, with holidays and special events marked. Pick or hover a day to read its numbers; "Open this day" opens it on the managing board.
- **Team workload**, **Customers**, **Tasks by status** and **Content types**: how the period's tasks split up, each bar showing finished and open.

Every task with an assignee counts on its due date; archived tasks don't count. Drafts appear only in their own total, just as the managing board leaves them out.

## My tasks and personal tasks

Everyone has a My tasks page; it is the first page for employees, and the only one besides logging out.

- **Assigned tasks**: only the tasks assigned to you, in the same day view as the managing board (overdue on today's view, due, finished), with a calendar and a summary of your day. You can change the status of your own tasks, including straight to a finished status such as Done. Employees can't edit tasks; admins and managers get "Open task" as on the board.
- **Personal tasks**: private to-dos with a title and an optional note, added to the day you are looking at. Tick to mark done, or delete. Unfinished ones from earlier days also show on today, marked "From [date]".
- Personal tasks are kept in their own table (`personal_tasks`) and are read only by their owner's My tasks page, so nobody else sees them in the site, admins included, and they never count on the dashboard, the board or anyone's workload. Like everything else, they are stored in the database, so whoever manages the hosting database can technically read it.

## First start on a new server

The first time the site is opened on an empty database, it shows a one-time setup page where you create the first admin and receive their access code. Once that admin exists, the setup page closes for good and everyone else is added from Settings.

Pending database changes are applied automatically each time the app starts (see `src/instrumentation.ts`), so the hosting never needs a command line. Set `SKIP_MIGRATIONS=1` to turn this off.

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

## Installing on the hosting (Turhost cPanel)

The hosting runs a ready-made package; it never installs or builds anything itself.

1. Build the package: `npm run build`, then `npm run package`. The result is `release/zeynkanban.zip`.
2. In cPanel, use **Deploy a Node.js App** on the `projects.zeynmedia.az` subdomain, upload the zip, and choose Node.js 20 or newer. The start file is `server.js`.
3. Set these environment variables for the app:
   - `DB_HOST` (usually `localhost`), `DB_NAME`, `DB_USER`, `DB_PASSWORD`: the MySQL database created in the hosting panel.
   - `AUTH_SECRET`: a random string of at least 32 characters. Changing it later makes every existing access code stop working.
   - `NODE_ENV`: `production`.
4. Start the app and open the address. The database tables are created on the first start, and the setup page asks for the first admin.
