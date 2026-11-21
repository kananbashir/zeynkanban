import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { bigint, boolean, date, datetime, index, int, mysqlEnum, mysqlTable, varchar } from "drizzle-orm/mysql-core";

// MySQL has no UUID type, so ids are UUID strings created by the app.
const id = () => varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID());
const now = (name: string) => datetime(name, { mode: "date", fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`);
const createdAt = () => now("created_at");

export const ROLES = ["admin", "manager", "employee"] as const;
export type Role = (typeof ROLES)[number];

/** People who can log in. A person is deactivated, never deleted, so their history stays. */
export const users = mysqlTable("users", {
  id: id(),
  name: varchar("name", { length: 120 }).notNull(),
  role: mysqlEnum("role", ROLES).notNull().default("employee"),
  /** HMAC of the access code. The code itself is never stored. */
  codeHash: varchar("code_hash", { length: 64 }).notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: now("updated_at"),
});

/** One row per logged-in browser. Only a hash of the cookie value is stored. */
export const sessions = mysqlTable(
  "sessions",
  {
    id: id(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Login attempts, used to slow down code guessing. */
export const loginAttempts = mysqlTable(
  "login_attempts",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    ip: varchar("ip", { length: 64 }).notNull(),
    success: boolean("success").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("login_attempts_ip_idx").on(t.ip, t.createdAt)],
);

/**
 * Task statuses, in the order people pick from. New tasks start with the first one.
 * Deleting a status only marks it deleted, so tasks that used it can still show
 * "Deleted status (its name)" and keep counting as finished if it did.
 */
export const statuses = mysqlTable("statuses", {
  id: id(),
  name: varchar("name", { length: 120 }).notNull(),
  color: varchar("color", { length: 7 }).notNull(),
  isFinished: boolean("is_finished").notNull().default(false),
  position: int("position").notNull().default(0),
  deletedAt: datetime("deleted_at", { mode: "date", fsp: 3 }),
  createdAt: createdAt(),
});

/** Task types, the header of every task. Deleted ones are only marked, as with statuses. */
export const taskTypes = mysqlTable("task_types", {
  id: id(),
  name: varchar("name", { length: 120 }).notNull(),
  position: int("position").notNull().default(0),
  /** The type the month planner gives every task it creates ("Post publishing"). */
  isPublishing: boolean("is_publishing").notNull().default(false),
  deletedAt: datetime("deleted_at", { mode: "date", fsp: 3 }),
  createdAt: createdAt(),
});

/** Content types. The code goes inside content IDs (thrive-vid-nd26-1), so types are archived, never deleted. */
export const contentTypes = mysqlTable("content_types", {
  id: id(),
  code: varchar("code", { length: 10 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  archived: boolean("archived").notNull().default(false),
  createdAt: createdAt(),
});

export const DAY_KINDS = ["holiday", "event"] as const;
export type DayKind = (typeof DAY_KINDS)[number];

/** Holidays and special events, marked on every calendar. A yearly one repeats on the same day each year. */
export const specialDays = mysqlTable("special_days", {
  id: id(),
  date: date("date", { mode: "string" }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  kind: mysqlEnum("kind", DAY_KINDS).notNull().default("holiday"),
  yearly: boolean("yearly").notNull().default(false),
  createdAt: createdAt(),
});
