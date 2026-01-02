#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const allowedProtocols = new Set(["workspace:*"]);

const sections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

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

const violations = [];

function collectPackageJsonPaths() {
  const paths = [join(root, "package.json")];

  for (const pattern of workspacePatterns) {
    const parts = pattern.split("/");
    const base = join(root, parts[0]);
    const hasGlob = parts.includes("*");

    if (hasGlob) {
      if (!existsDir(base)) continue;
      const entries = safeReadDir(base);
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const pkgPath = join(base, entry.name, "package.json");
        if (fileExists(pkgPath)) paths.push(pkgPath);
      }
    } else {
      const pkgPath = join(root, pattern, "package.json");
      if (fileExists(pkgPath)) paths.push(pkgPath);
    }
  }

  return paths;
}

function existsDir(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function fileExists(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function safeReadDir(path) {
  try {
    return readdirSync(path, { withFileTypes: true });
  } catch {
    return [];
  }
}

function validatePackage(packageJsonPath) {
  const relativePath = packageJsonPath.replace(`${root}/`, "");
  let data;

  try {
    data = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  } catch (error) {
    violations.push({
      file: relativePath,
      message: `Failed to parse JSON: ${error.message}`,
    });
    return;
  }

  for (const section of sections) {
    const deps = data[section];
    if (!deps) continue;

    for (const [name, version] of Object.entries(deps)) {
      if (!name.startsWith("@aligntrue/")) continue;
      if (allowedProtocols.has(version)) continue;

      violations.push({
        file: relativePath,
        dependency: name,
        section,
        value: version,
      });
    }
  }
}

const packageJsonPaths = collectPackageJsonPaths();

for (const packageJsonPath of packageJsonPaths) {
  validatePackage(packageJsonPath);
}

if (violations.length > 0) {
  console.error("🚫 Workspace protocol validation failed:");
  for (const violation of violations) {
    if (violation.message) {
      console.error(`- ${violation.file}: ${violation.message}`);
      continue;
    }

    console.error(
      `- ${violation.file}: ${violation.section}.${violation.dependency} = "${violation.value}" (expected workspace:*)`,
    );
  }

  console.error(
    '\nFix: set the dependency value to "workspace:*" in the listed package.json files.',
  );
  process.exit(1);
}

console.log("✅ Workspace protocol validation passed.");
