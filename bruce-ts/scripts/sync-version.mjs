#!/usr/bin/env node
// 从根 package.json 读取 version，同步到各 packages/xxx/package.json 的 version 及 @nano-bruce/xxx 依赖。
// 版本号只改根目录 package.json，然后执行：npm run version:sync
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf-8"));
const version = rootPkg.version;
if (!version) {
  console.error("Root package.json has no version");
  process.exit(1);
}

const packagesDir = path.join(rootDir, "packages");
const names = fs.readdirSync(packagesDir).filter((n) => {
  const p = path.join(packagesDir, n);
  return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, "package.json"));
});

for (const name of names) {
  const pkgPath = path.join(packagesDir, name, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  pkg.version = version;
  if (pkg.dependencies) {
    for (const key of Object.keys(pkg.dependencies)) {
      if (key.startsWith("@nano-bruce/")) pkg.dependencies[key] = version;
    }
  }
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
  console.log(`packages/${name} -> ${version}`);
}
console.log("version:sync done.");
