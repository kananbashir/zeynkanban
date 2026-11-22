/**
 * Creates a person and prints their access code once.
 *
 *   npm run user:create -- "Full Name" admin
 *
 * Roles: admin, manager, employee. Used to create the very first admin;
 * after that, people are added from the Settings page.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const [name, role = "employee"] = process.argv.slice(2);
  if (!name || !["admin", "manager", "employee"].includes(role)) {
    console.error('Usage: npm run user:create -- "Full Name" admin|manager|employee');
    process.exit(1);
  }
  const { connect } = await import("../src/db/client");
  const { users } = await import("../src/db/schema");
  const { encryptCode, generateCode, hashCode } = await import("../src/lib/codes");
  const { pool, db } = connect();
  const code = generateCode();
  await db.insert(users).values({ name, role: role as "admin" | "manager" | "employee", codeHash: hashCode(code), codeSecret: encryptCode(code) });
  await pool.end();
  console.log(`\nCreated ${role}: ${name}`);
  console.log(`Access code: ${code}`);
  console.log("An admin can also show it later in Settings → Users.\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
