#!/usr/bin/env bun

import { chmodSync, mkdirSync, symlinkSync, unlinkSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { createSolidTransformPlugin } from "@opentui/solid/bun-plugin";

type BuildTarget = {
  platform: "darwin" | "linux" | "windows";
  arch: "x64" | "arm64";
};

const ALL_TARGETS: BuildTarget[] = [
  { platform: "darwin", arch: "x64" },
  { platform: "darwin", arch: "arm64" },
  { platform: "linux", arch: "x64" },
  { platform: "linux", arch: "arm64" },
  { platform: "windows", arch: "x64" },
];

function normalizePlatform(platform: NodeJS.Platform): BuildTarget["platform"] | null {
  if (platform === "win32") return "windows";
  if (platform === "darwin" || platform === "linux") return platform;
  return null;
}

function getHostTarget(): BuildTarget {
  const platform = normalizePlatform(process.platform);
  if (!platform) throw new Error(`Unsupported platform: ${process.platform}`);
  if (process.arch !== "x64" && process.arch !== "arm64") throw new Error(`Unsupported arch: ${process.arch}`);
  return { platform, arch: process.arch };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkgDir = resolve(__dirname, "..");
const distDir = join(pkgDir, "dist");

const args = process.argv.slice(2);
const buildAll = args.includes("--all");
const targets = buildAll ? ALL_TARGETS : [getHostTarget()];

mkdirSync(distDir, { recursive: true });

console.log(`Building Bruce CLI${buildAll ? " (all platforms)" : ""}...`);

let successCount = 0;
let failCount = 0;

for (const { platform, arch } of targets) {
  const exeName = platform === "windows" ? "bruce.exe" : "bruce";
  const outfile = join(distDir, `${platform}-${arch}`, exeName);

  mkdirSync(dirname(outfile), { recursive: true });

  console.log(`Building for ${platform}-${arch}...`);

  try {
    const result = await Bun.build({
      entrypoints: [join(pkgDir, "src", "cli.ts")],
      sourcemap: "external",
      plugins: [createSolidTransformPlugin()],
      compile: {
        target: `bun-${platform}-${arch}` as any,
        outfile,
        execArgv: [
          `--config=${platform === "windows" ? "NUL" : "/dev/null"}`,
          `--env-file=""`,
          `--`,
        ],
        windows: {},
      },
    });

    if (result.logs.length > 0) {
      for (const log of result.logs) {
        if (log.level === "error") console.error("  ERROR:", log.message);
        else if (log.level === "warning") console.warn("  WARNING:", log.message);
        else console.log("  INFO:", log.message);
      }
    }

    if (!result.success) {
      console.error(`  Build failed for ${platform}-${arch}`);
      failCount++;
      continue;
    }

    if (platform !== "windows") chmodSync(outfile, 0o755);

    // Create a "current" symlink pointing to the host platform build
    if (!buildAll) {
      const currentLink = join(distDir, "bruce");
      if (existsSync(currentLink)) unlinkSync(currentLink);
      symlinkSync(outfile, currentLink);
    }

    console.log(`  Built: ${outfile}`);
    successCount++;
  } catch (error) {
    console.error(`  Build error for ${platform}-${arch}:`, error);
    failCount++;
  }
}

console.log();
console.log(`Build complete: ${successCount} succeeded, ${failCount} failed`);

if (failCount > 0) process.exit(1);
