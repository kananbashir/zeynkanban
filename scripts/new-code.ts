/**
 * Gives an existing person a new access code and prints it, e.g. when an admin is locked out.
 *
 *   npm run user:code -- "Full Name"
 *
 * Part of the name is enough if it matches only one person. Their old code stops working and they
 * are logged out everywhere. Without a name, it lists everyone.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const wanted = process.argv.slice(2).join(" ").trim().toLocaleLowerCase("az");
  const { eq } = await import("drizzle-orm");
  const { connect } = await import("../src/db/client");
  const { sessions, users } = await import("../src/db/schema");
  const { encryptCode, generateCode, hashCode } = await import("../src/lib/codes");
  const { pool, db } = connect();
  try {
    const people = await db.select({ id: users.id, name: users.name, role: users.role, active: users.active }).from(users);
    const list = () => people.map((p) => `  - ${p.name} (${p.role}${p.active ? "" : ", deactivated"})`).join("\n");
    if (!wanted) {
      console.log(`\nUsage: npm run user:code -- "Full Name"\n\nPeople:\n${list()}\n`);
      return;
    }
    const exact = people.filter((p) => p.name.toLocaleLowerCase("az") === wanted);
    const matches = exact.length ? exact : people.filter((p) => p.name.toLocaleLowerCase("az").includes(wanted));
    if (matches.length !== 1) {
      console.error(`\n${matches.length ? "More than one person matches" : "Nobody matches"} "${wanted}". People:\n${list()}\n`);
      process.exitCode = 1;
      return;
    }
    const person = matches[0];
    const code = generateCode();
    await db.update(users).set({ codeHash: hashCode(code), codeSecret: encryptCode(code), active: true, updatedAt: new Date() }).where(eq(users.id, person.id));
    await db.delete(sessions).where(eq(sessions.userId, person.id));
    console.log(`\nNew access code for ${person.name} (${person.role}): ${code}`);
    if (!person.active) console.log("They were deactivated; they can log in again now.");
    console.log("Their old code no longer works. An admin can also show this code later in Settings → Users.\n");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
