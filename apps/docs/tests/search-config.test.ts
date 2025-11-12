/**
 * Tests for pagefind search configuration
 *
 * Validates that pagefind dependencies and scripts are properly configured.
 * These tests do not require a build and always run.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Search Configuration", () => {
  it("should have pagefind dev dependencies", () => {
    const pkgPath = path.join(__dirname, "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

    expect(pkg.devDependencies?.pagefind).toBeDefined();
    expect(pkg.devDependencies?.["@pagefind/default-ui"]).toBeDefined();
  });

  it("should have postbuild script configured", () => {
    const pkgPath = path.join(__dirname, "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

    expect(pkg.scripts.postbuild).toBeDefined();
    expect(pkg.scripts.postbuild).toContain("pagefind");
  });
});
