#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const packagesDir = join(root, "packages");
const sections = ["dependencies", "devDependencies", "peerDependencies"];

const packages = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const packageJsonPath = join(packagesDir, entry.name, "package.json");
    const data = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    return {
      name: data.name,
      dir: join(packagesDir, entry.name),
      packageJsonPath,
      manifest: data,
    };
  });

const workspaceNames = new Set(packages.map((pkg) => pkg.name));
const violations = [];

for (const pkg of packages) {
  for (const section of sections) {
    const deps = pkg.manifest[section];
    if (!deps) continue;

    for (const [depName] of Object.entries(deps)) {
      if (!workspaceNames.has(depName) || depName === pkg.name) continue;

      const [, shortName] = depName.split("/");
      const modulePath = join(
        pkg.dir,
        "node_modules",
        depName.split("/")[0],
        shortName,
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

      const expectedSegment = `/packages/${shortName}`;
      if (
        !resolvedPath.includes(`${expectedSegment}/`) &&
        !resolvedPath.endsWith(expectedSegment)
      ) {
        violations.push(
          `${pkg.name}: ${depName} resolves to ${resolvedPath}, expected workspace package under /packages/${shortName}`,
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
