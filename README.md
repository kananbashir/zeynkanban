# Zeyn Media task planner

A website for planning Zeyn Media's customers, content and tasks. It replaces the team's task spreadsheet.

## What is built so far

| Stage | What | Status |
|---|---|---|
| 1 | Foundation: login with 8-character codes, roles, page frame, Azerbaijani and English | Done |
| 2 | Settings: users, statuses, task types, content types, holidays and events | Next |
| 3 | Customers, content IDs, contract renewal | |
| 4 | Tasks, managing board, task form, archiving | |
| 5 | Month planner | |
| 6 | Dashboard | |
| 7 | My tasks and personal tasks | |
| 8 | Notifications, including phone push | |
| 9 | Going live on a zeynmedia.az subdomain | |

Until its stage is built, a page shows "This page is being built".

## How it is put together

- **The site**: [Next.js](https://nextjs.org) with TypeScript. Pages live in `src/app`.
- **The data**: a PostgreSQL database. Its structure is described in `src/db/schema.ts`, and each change to that structure is saved as a file in `drizzle/`.
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

## Running it on your own computer

You only need this if you want to try the site locally. You need [Node.js](https://nodejs.org) (version 22 or newer) and a PostgreSQL database (a free one from Supabase or Neon works).

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

5. Create the first admin. The command prints the access code once, so write it down:

   ```bash
   npm run user:create -- "Your Name" admin
   ```

6. Start the site:

   ```bash
   npm run dev
   ```

7. Open http://localhost:3000 and log in with the code from step 5.

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
