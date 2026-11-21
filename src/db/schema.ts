import { bigserial, boolean, date, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "manager", "employee"]);
export type Role = (typeof roleEnum.enumValues)[number];

/** People who can log in. A person is deactivated, never deleted, so their history stays. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull().default("employee"),
  /** HMAC of the access code. The code itself is never stored. */
  codeHash: text("code_hash").notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One row per logged-in browser. Only a hash of the cookie value is stored. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Login attempts, used to slow down code guessing. */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ip: text("ip").notNull(),
    success: boolean("success").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("login_attempts_ip_idx").on(t.ip, t.createdAt)],
);

/**
 * Task statuses, in the order people pick from. New tasks start with the first one.
 * Deleting a status only marks it deleted, so tasks that used it can still show
 * "Deleted status (its name)" and keep counting as finished if it did.
 */
export const statuses = pgTable("statuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  isFinished: boolean("is_finished").notNull().default(false),
  position: integer("position").notNull().default(0),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Task types, the header of every task. Deleted ones are only marked, as with statuses. */
export const taskTypes = pgTable("task_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  /** The type the month planner gives every task it creates ("Post publishing"). */
  isPublishing: boolean("is_publishing").notNull().default(false),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Content types. The code goes inside content IDs (thrive-vid-nd26-1), so types are archived, never deleted. */
export const contentTypes = pgTable("content_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dayKindEnum = pgEnum("day_kind", ["holiday", "event"]);
export type DayKind = (typeof dayKindEnum.enumValues)[number];

/** Holidays and special events, marked on every calendar. A yearly one repeats on the same day each year. */
export const specialDays = pgTable("special_days", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: date("date", { mode: "string" }).notNull(),
  name: text("name").notNull(),
  kind: dayKindEnum("kind").notNull().default("holiday"),
  yearly: boolean("yearly").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
