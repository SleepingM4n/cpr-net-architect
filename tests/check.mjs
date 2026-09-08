import { readdir, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
const root = resolve(import.meta.dirname, "..");
let count = 0;
async function visit(path) {
  for (const entry of await readdir(path, {
    withFileTypes: true
  })) {
    const file = resolve(path, entry.name);
    if (entry.isDirectory()) await visit(file);else if (file.endsWith(".js") || file.endsWith(".mjs")) {
      const result = spawnSync(process.execPath, ["--check", file], {
        encoding: "utf8"
      });
      if (result.status) throw new Error(result.stderr);
      count++;
      if (file.replaceAll("\\", "/").includes("/scripts/")) {
        const source = await readFile(file, "utf8");
        for (const [, relative] of source.matchAll(/from\s+["'](\.[^"']+)["']/g)) await readFile(resolve(dirname(file), relative));
      }
    } else if (file.endsWith(".json")) JSON.parse(await readFile(file, "utf8"));
  }
}
await visit(root);
const manifest = JSON.parse(await readFile(resolve(root, "module.json"), "utf8"));
for (const file of [...manifest.esmodules, ...manifest.styles, ...manifest.languages.map(l => l.path), manifest.license]) await readFile(resolve(root, file));
console.log(`Validated ${count} JavaScript modules, imports, JSON, and manifest assets.`);
