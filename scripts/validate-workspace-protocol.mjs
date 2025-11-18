#!/usr/bin/env node

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const packagesDir = join(root, "packages");
const allowedProtocols = new Set(["workspace:*"]);

const sections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

const violations = [];

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

const packageJsonPaths = [
  join(root, "package.json"),
  ...readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(packagesDir, entry.name, "package.json")),
];

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
    "\nFix: set the dependency value to \"workspace:*\" in the listed package.json files.",
  );
  process.exit(1);
}

console.log("✅ Workspace protocol validation passed.");

