import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { bigint, boolean, date, datetime, index, int, mediumtext, mysqlEnum, mysqlTable, primaryKey, text, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

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
  /** The code itself, encrypted with a key made from AUTH_SECRET, so an admin can show it again. Empty for codes made before this existed. */
  codeSecret: varchar("code_secret", { length: 200 }),
  active: boolean("active").notNull().default(true),
  /** The newest version whose "What's new" this person has seen. Empty for someone new: set on their first visit, with no window. */
  seenVersion: varchar("seen_version", { length: 20 }),
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
  nameEn: varchar("name_en", { length: 120 }),
  color: varchar("color", { length: 7 }).notNull(),
  isFinished: boolean("is_finished").notNull().default(false),
  /** Moving a task into this status tells admins and managers it is ready for review. */
  notifyReview: boolean("notify_review").notNull().default(false),
  /** Tasks in this status were called off: closed like finished ones, never overdue, counted as cancelled. Only admins and managers can choose it. */
  isCancelled: boolean("is_cancelled").notNull().default(false),
  /** Tasks in this status are postponed: still open but never overdue, counted as postponed. Only admins and managers can choose it. */
  isPostponed: boolean("is_postponed").notNull().default(false),
  position: int("position").notNull().default(0),
  deletedAt: datetime("deleted_at", { mode: "date", fsp: 3 }),
  createdAt: createdAt(),
});

/** Task types, the header of every task. Deleted ones are only marked, as with statuses. */
export const taskTypes = mysqlTable("task_types", {
  id: id(),
  /** The name in Azerbaijani (the site's main language). */
  name: varchar("name", { length: 120 }).notNull(),
  /** The name in English; when empty, the Azerbaijani name is shown in English too. */
  nameEn: varchar("name_en", { length: 120 }),
  position: int("position").notNull().default(0),
  /** The type the month planner gives every task it creates ("Post publishing"). */
  isPublishing: boolean("is_publishing").notNull().default(false),
  /** Typed once with "Other…" in the task form and not saved to the list: used by its task, hidden everywhere else. */
  oneOff: boolean("one_off").notNull().default(false),
  /** The icon shown before its name on task cards (one of TASK_ICONS in src/lib/task-icons.ts). */
  icon: varchar("icon", { length: 20 }).notNull().default("layers"),
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
  nameEn: varchar("name_en", { length: 120 }),
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
    /** A note for all tasks of this content ID, shown under the content ID on their cards (admins and managers write it). */
    note: text("note"),
    noteBy: varchar("note_by", { length: 36 }).references(() => users.id),
    noteAt: datetime("note_at", { mode: "date", fsp: 3 }),
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
    /** The task's day: it shows from here (and, without a deadline, it is due that day). */
    dueDate: date("due_date", { mode: "string" }).notNull(),
    /** Optional last day, after dueDate: until then the unfinished task shows every day, then it is overdue. */
    deadline: date("deadline", { mode: "string" }),
    description: text("description"),
    note: varchar("note", { length: 500 }).notNull().default(""),
    archived: boolean("archived").notNull().default(false),
    /** When the task last moved into a status that counts as finished (for "Finished today"). */
    finishedAt: datetime("finished_at", { mode: "date", fsp: 3 }),
    /** Time of day ("09:00", Baku) for the task's reminders (see taskReminders). */
    remindTime: varchar("remind_time", { length: 5 }),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
    /** The last reminder an admin or manager sent to the people on the task with the bell (when, and who). */
    nudgedAt: datetime("nudged_at", { mode: "date", fsp: 3 }),
    nudgedBy: varchar("nudged_by", { length: 36 }).references(() => users.id),
    createdAt: createdAt(),
    updatedAt: now("updated_at"),
  },
  (t) => [
    index("tasks_due_idx").on(t.dueDate, t.archived),
    index("tasks_customer_idx").on(t.customerId, t.dueDate),
    index("tasks_content_idx").on(t.contentId),
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
    /** Optional time of day ("14:30", Baku). Reminders count back from it, or from 09:00 without one. */
    time: varchar("time", { length: 5 }),
    done: boolean("done").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: now("updated_at"),
  },
  (t) => [index("personal_owner_idx").on(t.ownerId, t.dueDate)],
);

/** Reminders of a personal task: one row per "minutes before" (0 = at the time). */
export const personalReminders = mysqlTable(
  "personal_reminders",
  {
    personalTaskId: varchar("personal_task_id", { length: 36 })
      .notNull()
      .references(() => personalTasks.id, { onDelete: "cascade" }),
    minutesBefore: int("minutes_before").notNull(),
    sentAt: datetime("sent_at", { mode: "date", fsp: 3 }),
  },
  (t) => [primaryKey({ columns: [t.personalTaskId, t.minutesBefore] })],
);

/** Notes people add to a task (the assignee, admins, managers). At most 10 per task. */
export const taskNotes = mysqlTable(
  "task_notes",
  {
    id: id(),
    taskId: varchar("task_id", { length: 36 })
      .notNull()
      .references(() => tasks.id),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id),
    body: varchar("body", { length: 500 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("task_notes_task_idx").on(t.taskId, t.createdAt)],
);

/**
 * The fields every new content brief starts with (Settings → Content brief, admins only). Each has a
 * name and a hint (the grey text in the empty box) in Azerbaijani and, optionally, English.
 * Hidden fields are not added to new briefs but can still be picked from "Add field".
 */
export const BRIEF_FIELD_TYPES = ["short", "long", "links", "checklist", "date"] as const;
export const briefFields = mysqlTable("brief_fields", {
  id: id(),
  position: int("position").notNull().default(0),
  label: varchar("label", { length: 60 }).notNull(),
  labelEn: varchar("label_en", { length: 60 }),
  type: mysqlEnum("type", BRIEF_FIELD_TYPES).notNull(),
  hint: varchar("hint", { length: 200 }).notNull().default(""),
  hintEn: varchar("hint_en", { length: 200 }),
  visible: boolean("visible").notNull().default(true),
  createdAt: createdAt(),
});

/**
 * What a content ID is really about, for everyone working on its tasks: a list of fields (goal,
 * key message, script, links to materials…) as JSON, see src/lib/brief-rules.ts. One per content ID.
 */
export const contentBriefs = mysqlTable("content_briefs", {
  contentId: varchar("content_id", { length: 36 })
    .primaryKey()
    .references(() => contents.id),
  fields: mediumtext("fields").notNull(),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  updatedBy: varchar("updated_by", { length: 36 }).references(() => users.id),
  createdAt: createdAt(),
  updatedAt: now("updated_at"),
});

/**
 * The finished work of a content ID: links (each with a name) to the final video, design or post,
 * shown on every task of that content ID. Admins, managers and whoever added it can change it.
 */
export const finishedWorks = mysqlTable("finished_works", {
  contentId: varchar("content_id", { length: 36 })
    .primaryKey()
    .references(() => contents.id),
  links: text("links").notNull(),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  updatedBy: varchar("updated_by", { length: 36 }).references(() => users.id),
  createdAt: createdAt(),
  updatedAt: now("updated_at"),
});

/** Who works on a task: one or more people, in the order they were picked. A task with nobody is a draft. */
export const taskAssignees = mysqlTable(
  "task_assignees",
  {
    taskId: varchar("task_id", { length: 36 })
      .notNull()
      .references(() => tasks.id),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id),
    position: int("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.userId] }), index("task_assignees_user_idx").on(t.userId)],
);

/** Reminders for a task's assignee: one row per "days before the due date". */
export const taskReminders = mysqlTable(
  "task_reminders",
  {
    taskId: varchar("task_id", { length: 36 })
      .notNull()
      .references(() => tasks.id),
    daysBefore: int("days_before").notNull(),
    /** Set once this reminder has gone out; cleared when the due date or the time changes. */
    sentAt: datetime("sent_at", { mode: "date", fsp: 3 }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.daysBefore] })],
);

export const NOTIFICATION_KINDS = ["assigned", "moved", "changed", "review", "overdue", "summary", "status", "reminder", "note", "personal", "deadline", "brief", "finished", "contentNote", "nudge"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/**
 * One notification for one person. `data` holds what is needed to write the text later
 * (names, codes, dates), so it can be shown in either language.
 */
export const notifications = mysqlTable(
  "notifications",
  {
    id: id(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id),
    kind: mysqlEnum("kind", NOTIFICATION_KINDS).notNull(),
    taskId: varchar("task_id", { length: 36 }),
    data: text("data").notNull(),
    readAt: datetime("read_at", { mode: "date", fsp: 3 }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

/** What each person wants to be told about. A missing row means everything is on. */
export const notificationPrefs = mysqlTable("notification_prefs", {
  userId: varchar("user_id", { length: 36 })
    .primaryKey()
    .references(() => users.id),
  assigned: boolean("assigned").notNull().default(true),
  changed: boolean("changed").notNull().default(true),
  summary: boolean("summary").notNull().default(true),
  review: boolean("review").notNull().default(true),
  overdue: boolean("overdue").notNull().default(true),
  status: boolean("status").notNull().default(true),
  reminder: boolean("reminder").notNull().default(true),
  notes: boolean("notes").notNull().default(true),
});

/** A browser or phone that accepted push notifications. */
export const pushSubscriptions = mysqlTable(
  "push_subscriptions",
  {
    id: id(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id),
    endpointHash: varchar("endpoint_hash", { length: 64 }).notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: varchar("p256dh", { length: 255 }).notNull(),
    auth: varchar("auth", { length: 255 }).notNull(),
    /** The language the site was in when push was turned on; pushes are written in it. */
    locale: varchar("locale", { length: 5 }).notNull().default("az"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("push_endpoint_idx").on(t.endpointHash), index("push_user_idx").on(t.userId)],
);

/** Small values the app keeps for itself: generated push keys, and which daily jobs already ran. */
export const appValues = mysqlTable("app_values", {
  key: varchar("key", { length: 80 }).primaryKey(),
  value: text("value").notNull(),
  createdAt: createdAt(),
});
