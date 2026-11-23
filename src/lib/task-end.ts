import { sql } from "drizzle-orm";
import { tasks } from "@/db/schema";

/** In queries: the day a task must be finished by, its deadline or else its own day (see taskEnd in task-rules). */
export const taskEndColumn = sql<string>`coalesce(greatest(${tasks.deadline}, ${tasks.dueDate}), ${tasks.dueDate})`;
