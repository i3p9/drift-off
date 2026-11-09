import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = readFileSync(join(root, "scenes.js"), "utf8");
const assignment = source.match(/globalThis\.DRIFT_CATALOG\s*=\s*([\s\S]+);\s*$/);
if (!assignment) throw new Error("Missing scene catalog.");
const catalog = JSON.parse(assignment[1]);
if (!Array.isArray(catalog.voices) || !catalog.voices.length) {
  throw new Error("The catalog must contain at least one bundled voice.");
}
const ids = catalog.voices.map(voice => voice.id);
if (ids.some(id => typeof id !== "string" || !/^[a-z][a-z0-9-]{0,40}$/.test(id)) || new Set(ids).size !== ids.length) {
  throw new Error("Voice IDs must be unique, safe local filenames.");
}

// Only player assets belong in the deployment output.
const runtime = [
  "index.html", "styles.css", "engine.js", "app.js", "scenes.js", "icon.svg", "_headers",
  ...ids.map(id => `voices/${id}.js`),
];
for (const relative of runtime) {
  if (!statSync(join(root, relative)).isFile()) throw new Error(`Missing runtime file: ${relative}`);
}

const output = join(root, "dist");
rmSync(output, { recursive: true, force: true });
for (const relative of runtime) {
  const target = join(output, relative);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(root, relative), target);
}
console.log(`Built ${runtime.length} static files in dist/.`);
