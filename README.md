# Zeyn Media task planner

A website for planning Zeyn Media's customers, content and tasks. It replaces the team's task spreadsheet.

## What is built so far

| Stage | What | Status |
|---|---|---|
| 1 | Foundation: login with 8-character codes, roles, page frame, Azerbaijani and English | Done |
| 2 | Settings: users, statuses, task types, content types, holidays and events | Done |
| 3 | Customers, content IDs, contract renewal | Done |
| 4 | Tasks, managing board, task form, archiving | Next |
| 5 | Month planner | |
| 6 | Dashboard | |
| 7 | My tasks and personal tasks | |
| 8 | Notifications, including phone push | |
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

## First start on a new server

The first time the site is opened on an empty database, it shows a one-time setup page where you create the first admin and receive their access code. Once that admin exists, the setup page closes for good and everyone else is added from Settings.

Pending database changes are applied automatically each time the app starts (see `src/instrumentation.ts`), so the hosting never needs a command line. Set `SKIP_MIGRATIONS=1` to turn this off.

## Running it on your own computer

You only need this if you want to try the site locally. You need [Node.js](https://nodejs.org) (version 22 or newer) and a MySQL or MariaDB database.

1. Download the code and open a terminal in its folder.
2. Install what the site needs:

   ```bash
   npm install
   ```

3. Copy `.env.example` to a new file named `.env.local`, then fill in the two values it describes: the database address and a long random secret.
4. Create the tables in the database:

   ```bash
   npm run db:migrate
   ```

5. Start the site:

   ```bash
   npm run dev
   ```

6. Open http://localhost:3000. On an empty database you'll see the setup page: create the first admin there and write down the code it shows. (Alternatively, `npm run user:create -- "Your Name" admin` does the same from the terminal.)

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the site for development |
| `npm run build` | Builds the site the way the hosting service will |
| `npm run test` | Runs the automatic checks |
| `npm run lint` and `npm run typecheck` | Check the code for mistakes |
| `npm run db:generate` | After changing `src/db/schema.ts`, writes the matching database change into `drizzle/` |
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
