#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const sections = ["dependencies", "devDependencies", "peerDependencies"];

const workspacePatterns = [
  "packages/*",
  "apps/*",
  "core",
  "host",
  "cli",
  "packs/*",
  "connectors/*",
  "ui/*",
];

function fileExists(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function dirExists(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function collectPackageJsons() {
  const entries = [];

  // root package
  const rootPkg = join(root, "package.json");
  if (fileExists(rootPkg)) {
    const manifest = JSON.parse(readFileSync(rootPkg, "utf8"));
    entries.push({
      name: manifest.name || "root",
      dir: root,
      packageJsonPath: rootPkg,
      manifest,
    });
  }

  for (const pattern of workspacePatterns) {
    const parts = pattern.split("/");
    const base = join(root, parts[0]);
    const hasGlob = parts.includes("*");

    if (hasGlob) {
      if (!dirExists(base)) continue;
      const children = readdirSync(base, { withFileTypes: true });
      for (const entry of children) {
        if (!entry.isDirectory()) continue;
        const dir = join(base, entry.name);
        const packageJsonPath = join(dir, "package.json");
        if (!fileExists(packageJsonPath)) continue;
        const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8"));
        entries.push({ name: manifest.name, dir, packageJsonPath, manifest });
      }
    } else {
      const dir = join(root, pattern);
      const packageJsonPath = join(dir, "package.json");
      if (!fileExists(packageJsonPath)) continue;
      const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8"));
      entries.push({ name: manifest.name, dir, packageJsonPath, manifest });
    }
  }

  return entries;
}

const packages = collectPackageJsons();
const packageMap = new Map(packages.map((pkg) => [pkg.name, pkg]));
const violations = [];

for (const pkg of packages) {
  for (const section of sections) {
    const deps = pkg.manifest[section];
    if (!deps) continue;

    for (const [depName] of Object.entries(deps)) {
      const targetPkg = packageMap.get(depName);
      if (!targetPkg || depName === pkg.name) continue;

      const [, shortName] = depName.split("/");
      const modulePath = join(
        pkg.dir,
        "node_modules",
        depName.split("/")[0],
        shortName || "",
      );

      if (!existsSync(modulePath)) {
        violations.push(
          `${pkg.name}: missing node_modules entry for ${depName} (expected at ${modulePath})`,
        );
        continue;
      }

      let resolvedPath;
      try {
        resolvedPath = realpathSync(modulePath).replace(/\\/g, "/");
      } catch (error) {
        violations.push(
          `${pkg.name}: failed to resolve ${depName} (${error.message})`,
        );
        continue;
      }

      const expectedPath = targetPkg.dir.replace(/\\/g, "/");
      if (resolvedPath !== expectedPath) {
        violations.push(
          `${pkg.name}: ${depName} resolves to ${resolvedPath}, expected workspace package at ${expectedPath}`,
        );
      }
    }
  }
}

if (violations.length > 0) {
  console.error("🚫 Workspace link verification failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error(
    "\nRun `pnpm install` to relink workspace packages or ensure dependencies use workspace:* protocol.",
  );
  process.exit(1);
}

console.log("✅ Workspace link verification passed.");
