// Builds the folder and zip file that are uploaded to the hosting.
// Run after `next build`:  npm run package
// Result: release/zeynkanban/ (ready to run with `node server.js`) and release/zeynkanban.zip
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const out = "release/zeynkanban";
if (!existsSync(".next/standalone/server.js")) throw new Error("Run `npm run build` first.");
rmSync("release", { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(".next/standalone", out, { recursive: true });
cpSync(".next/static", `${out}/.next/static`, { recursive: true });
cpSync("public", `${out}/public`, { recursive: true });
cpSync("drizzle", `${out}/drizzle`, { recursive: true }); // database changes, applied when the app starts
rmSync(`${out}/.env.local`, { force: true }); // never ship local secrets
// A minimal package.json: nothing to install, and "npm start" runs the server.
writeFileSync(
  `${out}/package.json`,
  JSON.stringify({ name: "zeynkanban", private: true, main: "server.js", scripts: { start: "node server.js" }, engines: { node: ">=20.9" } }, null, 2) + "\n",
);
const commit = execSync("git rev-parse --short HEAD").toString().trim();
writeFileSync(`${out}/VERSION.txt`, `zeynkanban ${commit} built ${new Date().toISOString()}\nStart file: server.js\n`);
execSync(`cd release && zip -qr zeynkanban.zip zeynkanban`);
console.log(`Ready: release/zeynkanban.zip (${commit})`);
