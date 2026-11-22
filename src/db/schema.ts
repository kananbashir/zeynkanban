import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { bigint, boolean, date, datetime, index, int, mysqlEnum, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";

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
  /** Typed once with "Other…" in the task form and not saved to the list: used by its task, hidden everywhere else. */
  oneOff: boolean("one_off").notNull().default(false),
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

/** Customers. Archived, never deleted, so their contents, tasks and history stay. */
export const customers = mysqlTable("customers", {
  id: id(),
  name: varchar("name", { length: 120 }).notNull(),
  /** Goes at the start of every content ID (thrive-vid-nd26-1). Lowercase letters and digits. */
  shortName: varchar("short_name", { length: 20 }).notNull().unique(),
  contactPerson: varchar("contact_person", { length: 120 }).notNull().default(""),
  phone: varchar("phone", { length: 40 }).notNull().default(""),
  email: varchar("email", { length: 120 }).notNull().default(""),
  social: varchar("social", { length: 200 }).notNull().default(""),
  notes: text("notes"),
  /** Card colour on the board, one of the pastel colours. */
  color: varchar("color", { length: 7 }).notNull(),
  archived: boolean("archived").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: now("updated_at"),
});

/**
 * Contract periods. A renewal adds a new row; the newest one is the current contract.
 * Months are stored as the first day of the month ("2026-11-01").
 */
export const contracts = mysqlTable(
  "contracts",
  {
    id: id(),
    customerId: varchar("customer_id", { length: 36 })
      .notNull()
      .references(() => customers.id),
    startMonth: date("start_month", { mode: "string" }).notNull(),
    endMonth: date("end_month", { mode: "string" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("contracts_customer_idx").on(t.customerId, t.startMonth)],
);

/** Content IDs: one piece of content (a video, a post) that tasks belong to. Archived, never deleted. */
export const contents = mysqlTable(
  "contents",
  {
    id: id(),
    /** The content ID itself, e.g. thrive-vid-nd26-1. Unique across all customers. */
    code: varchar("code", { length: 60 }).notNull().unique(),
    customerId: varchar("customer_id", { length: 36 })
      .notNull()
      .references(() => customers.id),
    contentTypeId: varchar("content_type_id", { length: 36 })
      .notNull()
      .references(() => contentTypes.id),
    contractId: varchar("contract_id", { length: 36 }).references(() => contracts.id),
    archived: boolean("archived").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("contents_customer_idx").on(t.customerId, t.archived)],
);

/**
 * Tasks. Every task belongs to a content ID (and so to a customer).
 * A task without an assignee is a draft: it shows on the customer page only, never on the managing board.
 * Archived, never deleted.
 */
export const tasks = mysqlTable(
  "tasks",
  {
    id: id(),
    customerId: varchar("customer_id", { length: 36 })
      .notNull()
      .references(() => customers.id),
    contentId: varchar("content_id", { length: 36 })
      .notNull()
      .references(() => contents.id),
    taskTypeId: varchar("task_type_id", { length: 36 })
      .notNull()
      .references(() => taskTypes.id),
    statusId: varchar("status_id", { length: 36 })
      .notNull()
      .references(() => statuses.id),
    assigneeId: varchar("assignee_id", { length: 36 }).references(() => users.id),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    description: text("description"),
    note: varchar("note", { length: 500 }).notNull().default(""),
    archived: boolean("archived").notNull().default(false),
    /** When the task last moved into a status that counts as finished (for "Finished today"). */
    finishedAt: datetime("finished_at", { mode: "date", fsp: 3 }),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
    createdAt: createdAt(),
    updatedAt: now("updated_at"),
  },
  (t) => [
    index("tasks_due_idx").on(t.dueDate, t.archived),
    index("tasks_customer_idx").on(t.customerId, t.dueDate),
    index("tasks_content_idx").on(t.contentId),
    index("tasks_assignee_idx").on(t.assigneeId, t.dueDate),
  ],
);

/**
 * Personal tasks: private to-dos of one person. Kept in their own table so that no other page,
 * count or chart can ever include them; only the owner's My tasks page reads it.
 */
export const personalTasks = mysqlTable(
  "personal_tasks",
  {
    id: id(),
    ownerId: varchar("owner_id", { length: 36 })
      .notNull()
      .references(() => users.id),
    title: varchar("title", { length: 200 }).notNull(),
    note: varchar("note", { length: 500 }).notNull().default(""),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    done: boolean("done").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: now("updated_at"),
  },
  (t) => [index("personal_owner_idx").on(t.ownerId, t.dueDate)],
);
