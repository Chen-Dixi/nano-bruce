#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const order = ["ai", "agent", "bruce", "app"];

for (const name of order) {
  const pkgDir = path.join(root, "packages", name);
  console.log(`Building packages/${name}...`);
  const r = spawnSync("bun", ["run", "build"], { cwd: pkgDir, stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
console.log("Build done.");
