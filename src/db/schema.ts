import { bigserial, boolean, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
