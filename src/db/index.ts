import "server-only";
import { connect } from "./client";

// Reuse one connection across hot reloads in development.
const globalForDb = globalThis as unknown as { zkDb?: ReturnType<typeof connect> };
const connection = globalForDb.zkDb ?? connect();
if (process.env.NODE_ENV !== "production") globalForDb.zkDb = connection;

export const db = connection.db;
