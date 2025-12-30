/**
 * Cross-package import conformance test
 * Validates that all @aligntrue/* imports resolve to actual exports
 * Prevents dangling imports from incomplete deprecations
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

type WorkspacePackage = { name: string; dir: string };

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
  packageMap: Map<string, string>,
  importPath: string,
): { exists: boolean; reason?: string } {
  // Parse: @aligntrue/package-name/path/to/module.js
  const parts = importPath.split("/");
  if (parts[0] !== "@aligntrue" || parts.length < 2) {
    return { exists: false, reason: "Invalid @aligntrue import format" };
  }

  const packageName = `@aligntrue/${parts[1]}`; // e.g., "@aligntrue/core"
  const subPath = parts.slice(2).join("/"); // e.g., "team/allow.js"

  const packageDir = packageMap.get(packageName);

  // Check if package exists
  if (!packageDir || !existsSync(packageDir)) {
    return {
      exists: false,
      reason: `Package ${packageName} does not exist`,
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

/**
 * Discover all workspace packages under the provided roots.
 * Includes platform packages so imports like @aligntrue/ops-core resolve.
 */
function discoverWorkspacePackages(roots: string[]): WorkspacePackage[] {
  const packages: WorkspacePackage[] = [];

  for (const root of roots) {
    if (!existsSync(root)) continue;

    const entries = readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      const dir = join(root, entry.name);
      const packageJson = join(dir, "package.json");
      if (!existsSync(packageJson)) continue;

      try {
        const pkg = JSON.parse(readFileSync(packageJson, "utf-8"));
        if (typeof pkg.name === "string") {
          packages.push({ name: pkg.name, dir });
        }
      } catch {
        // Ignore invalid package.json
      }
    }
  }

  return packages;
}

describe("cross-package imports", () => {
  it("should not have dangling imports across workspace packages", () => {
    // Get packages directory relative to this test file
    const testDir = __dirname;
    const workspaceRoot = join(testDir, "../../..");
    const packageRoots = [
      join(workspaceRoot, "packages"),
      join(workspaceRoot, "platform"),
      join(workspaceRoot, "platform/packs"),
      join(workspaceRoot, "platform/ops-shared"),
    ];
    const workspacePackages = discoverWorkspacePackages(packageRoots);
    const packageMap = new Map(
      workspacePackages.map((pkg) => [pkg.name, pkg.dir]),
    );

    expect(workspacePackages.length).toBeGreaterThan(0);

    const errors: string[] = [];

    // Check each package
    for (const pkg of workspacePackages) {
      const pkgDir = pkg.dir;
      const srcDir = join(pkgDir, "src");
      if (!existsSync(srcDir)) continue;

      const imports = extractImports(srcDir);

      for (const [file, importPaths] of imports.entries()) {
        const relativeFile = file.replace(workspaceRoot + "/", "");

        for (const imp of importPaths) {
          const result = resolveImport(packageMap, imp);

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
