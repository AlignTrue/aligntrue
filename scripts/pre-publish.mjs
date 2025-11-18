#!/usr/bin/env node

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const packagesDir = join(root, "packages");

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function run(command, args, label) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    fail(`${label} failed`);
  }
}

function readPackageJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`Failed to parse ${filePath}: ${error.message}`);
  }
}

function ensureMatchingVersions() {
  console.log("\n▶ Checking package versions");
  const packageJsonPaths = readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(packagesDir, entry.name, "package.json"));

  const versions = new Map();

  for (const packageJsonPath of packageJsonPaths) {
    const data = readPackageJson(packageJsonPath);
    if (!data.version) {
      fail(`Missing version in ${packageJsonPath}`);
    }
    versions.set(packageJsonPath, data.version);
  }

  const uniqueVersions = new Set(versions.values());

  if (uniqueVersions.size !== 1) {
    console.error("Versions must match across all workspace packages.");
    for (const [file, version] of versions.entries()) {
      console.error(`- ${file.replace(`${root}/`, "")}: ${version}`);
    }
    fail("Version mismatch detected");
  }

  const version = uniqueVersions.values().next().value;
  console.log(`✓ All packages set to version ${version}`);
}

function ensureCleanGitTree() {
  console.log("\n▶ Checking git status");
  const result = spawnSync("git", ["status", "--porcelain"], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    fail("Unable to read git status");
  }
  if (result.stdout.trim().length > 0) {
    console.error(result.stdout.trim());
    fail(
      "Working tree is not clean. Commit or stash changes before releasing.",
    );
  }
  console.log("✓ Working tree is clean");
}

console.log("🔍 Running pre-publish checks");

run("pnpm", ["validate:workspace"], "Validate workspace protocol");
ensureMatchingVersions();
ensureCleanGitTree();
run("pnpm", ["build:packages"], "Build packages");
run("pnpm", ["typecheck"], "Type check");
run("pnpm", ["test"], "Run test suite");

console.log("\n✅ Pre-publish checks passed");
