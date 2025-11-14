/**
 * Cross-package import conformance test
 * Validates that all @aligntrue/* imports resolve to actual exports
 * Prevents dangling imports from incomplete deprecations
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Extract all import statements from TypeScript files
 */
function extractImports(dir: string): Map<string, string[]> {
  const imports = new Map<string, string[]>();

  function walk(currentDir: string) {
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist") continue;
        walk(fullPath);
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        const content = readFileSync(fullPath, "utf-8");
        const fileImports: string[] = [];

        // Match: import ... from "@aligntrue/..."
        const importRegex =
          /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([@\w/-]+(?:\.js)?)['"]/g;
        let match;

        while ((match = importRegex.exec(content)) !== null) {
          const importPath = match[1];
          if (importPath.startsWith("@aligntrue/")) {
            fileImports.push(importPath);
          }
        }

        if (fileImports.length > 0) {
          imports.set(fullPath, fileImports);
        }
      }
    }
  }

  walk(dir);
  return imports;
}

/**
 * Resolve an import path to check if it exists
 * Handles both deep imports and package root imports
 */
function resolveImport(
  packagesDir: string,
  importPath: string,
): { exists: boolean; reason?: string } {
  // Parse: @aligntrue/package-name/path/to/module.js
  const parts = importPath.split("/");
  if (parts[0] !== "@aligntrue" || parts.length < 2) {
    return { exists: false, reason: "Invalid @aligntrue import format" };
  }

  const packageName = parts[1]; // e.g., "core"
  const subPath = parts.slice(2).join("/"); // e.g., "team/allow.js"

  const packageDir = join(packagesDir, packageName);

  // Check if package exists
  if (!existsSync(packageDir)) {
    return {
      exists: false,
      reason: `Package @aligntrue/${packageName} does not exist`,
    };
  }

  // If importing from package root (no subpath), check package.json exports
  if (!subPath) {
    const packageJson = join(packageDir, "package.json");
    if (existsSync(packageJson)) {
      return { exists: true };
    }
    return { exists: false, reason: "No package.json found" };
  }

  // For subpath imports, check if the file exists in src/
  // Remove .js extension if present (imports use .js, source uses .ts)
  const cleanSubPath = subPath.replace(/\.js$/, "");
  const possiblePaths = [
    join(packageDir, "src", `${cleanSubPath}.ts`),
    join(packageDir, "src", `${cleanSubPath}.tsx`),
    join(packageDir, "src", cleanSubPath, "index.ts"),
    join(packageDir, "src", cleanSubPath, "index.tsx"),
  ];

  // Check if any of the possible paths exist
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return { exists: true };
    }
  }

  // Check package.json exports field
  const packageJson = join(packageDir, "package.json");
  if (existsSync(packageJson)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJson, "utf-8"));
      if (pkg.exports) {
        // Check if the subpath is explicitly exported
        const exportKey = `./${cleanSubPath}`;
        if (pkg.exports[exportKey]) {
          return { exists: true };
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  return {
    exists: false,
    reason: `Module not found in src/ or package.json exports: ${cleanSubPath}`,
  };
}

describe("cross-package imports", () => {
  it("should not have dangling imports across workspace packages", () => {
    // Get packages directory relative to this test file
    // This test is in packages/testkit/tests/
    // So: tests -> testkit -> packages (../../)
    const testDir = __dirname;
    const packagesDir = join(testDir, "../..");

    // Verify packages directory exists
    expect(existsSync(packagesDir)).toBe(true);

    // Get all package directories
    const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => join(packagesDir, d.name))
      .filter((dir) => existsSync(join(dir, "package.json")));

    expect(packageDirs.length).toBeGreaterThan(0);

    const errors: string[] = [];

    // Check each package
    for (const pkgDir of packageDirs) {
      const srcDir = join(pkgDir, "src");
      if (!existsSync(srcDir)) continue;

      const imports = extractImports(srcDir);

      for (const [file, importPaths] of imports.entries()) {
        const relativeFile = file.replace(packagesDir + "/", "");

        for (const imp of importPaths) {
          const result = resolveImport(packagesDir, imp);

          if (!result.exists) {
            errors.push(
              `${relativeFile}:\n  Cannot resolve '${imp}'\n  ${result.reason || "Unknown reason"}`,
            );
          }
        }
      }
    }

    // If there are errors, format them nicely
    if (errors.length > 0) {
      const message = [
        `Found ${errors.length} dangling import(s):`,
        "",
        ...errors,
        "",
        "These imports reference non-existent modules or exports.",
        "This usually happens from incomplete deprecations.",
      ].join("\n");

      expect(errors).toEqual([]);
      throw new Error(message); // Fallback if expect doesn't throw
    }
  });
});
