// Builds the folder and zip file that are uploaded to the hosting.
// Run after `next build`:  npm run package
// Result: release/zeynkanban/ (ready to run with `node server.js`) and release/zeynkanban.zip
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
// package.json for the server. If the hosting installs packages (npm ci / npm install), it gets
// exactly the versions the server was built with; "build" only checks the files are in place, and
// "start" runs the server. A matching package-lock.json is generated next to it.
const lock = JSON.parse(readFileSync("package-lock.json", "utf8")).packages;
const runtime = ["next", "react", "react-dom"];
const dependencies = Object.fromEntries(runtime.map((name) => [name, lock[`node_modules/${name}`].version]));
writeFileSync(
  `${out}/package.json`,
  JSON.stringify(
    {
      name: "zeynkanban",
      private: true,
      main: "server.js",
      scripts: { build: "node check-package.js", start: "node server.js" },
      engines: { node: ">=20.9" },
      dependencies,
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  `${out}/check-package.js`,
  [
    "// Run as the build step on the hosting: the app is already built, so this only confirms the files arrived.",
    "const fs = require('fs');",
    "for (const f of ['server.js', '.next', 'drizzle', 'public']) {",
    "  if (!fs.existsSync(f)) { console.error('Missing from the package: ' + f); process.exit(1); }",
    "}",
    "console.log('Package complete. Node ' + process.version + '. Start with: node server.js');",
    "",
  ].join("\n"),
);
execSync("npm install --package-lock-only --ignore-scripts --no-audit --no-fund", { cwd: out, stdio: "inherit" });
const commit = execSync("git rev-parse --short HEAD").toString().trim();
writeFileSync(`${out}/VERSION.txt`, `zeynkanban ${commit} built ${new Date().toISOString()}\nStart file: server.js\n`);
// Files at the top level of the zip (no wrapping folder), so the hosting finds server.js directly.
execSync(`cd ${out} && zip -qr ../zeynkanban.zip .`);
console.log(`Ready: release/zeynkanban.zip (${commit})`);
