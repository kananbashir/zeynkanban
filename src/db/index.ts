import "server-only";
import { connect, type Database } from "./client";

// The connection opens on first use, not when this file loads, so building the app
// works on machines (like the hosting's build step) that don't have the database settings.
const globalForDb = globalThis as unknown as { zkDb?: ReturnType<typeof connect> };

function connection() {
  if (!globalForDb.zkDb) globalForDb.zkDb = connect();
  return globalForDb.zkDb;
}

export const db = new Proxy({} as Database, {
  get(_target, property) {
    const real = connection().db;
    const value = Reflect.get(real, property, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
