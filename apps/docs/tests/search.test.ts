/**
 * Tests for search index generation
 *
 * Ensures Pagefind search index is properly configured and generated.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Search Index", () => {
  it("should generate pagefind search index", () => {
    // Resolve to the docs directory (tests/ -> ..)
    const pagefindDir = path.join(__dirname, "..", "public/_pagefind");

    expect(fs.existsSync(pagefindDir)).toBe(
      true,
      "Pagefind directory should exist after build",
    );

    // Verify essential files exist
    expect(fs.existsSync(path.join(pagefindDir, "pagefind.js"))).toBe(
      true,
      "pagefind.js should be generated",
    );
    expect(fs.existsSync(path.join(pagefindDir, "pagefind-entry.json"))).toBe(
      true,
      "pagefind-entry.json should be generated",
    );

    // Check that fragments were indexed
    const fragmentDir = path.join(pagefindDir, "fragment");
    expect(fs.existsSync(fragmentDir)).toBe(
      true,
      "fragment directory should exist",
    );
    const fragments = fs.readdirSync(fragmentDir);
    expect(fragments.length).toBeGreaterThan(
      0,
      "should have indexed page fragments",
    );
  });

  it("should have pagefind dev dependencies", () => {
    const pkgPath = path.join(__dirname, "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

    expect(pkg.devDependencies?.pagefind).toBeDefined(
      "pagefind should be in devDependencies",
    );
    expect(pkg.devDependencies?.["@pagefind/default-ui"]).toBeDefined(
      "@pagefind/default-ui should be in devDependencies",
    );
  });

  it("should have postbuild script configured", () => {
    const pkgPath = path.join(__dirname, "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

    expect(pkg.scripts.postbuild).toBeDefined(
      "postbuild script should be defined",
    );
    expect(pkg.scripts.postbuild).toContain(
      "pagefind",
      "postbuild script should run pagefind",
    );
  });

  it("should have valid pagefind entry configuration", () => {
    const entryPath = path.join(
      __dirname,
      "..",
      "public/_pagefind/pagefind-entry.json",
    );

    const entry = JSON.parse(fs.readFileSync(entryPath, "utf-8"));

    expect(entry.version).toBeDefined("pagefind version should be set");
    expect(entry.languages).toBeDefined("languages should be configured");
    expect(entry.languages.en).toBeDefined(
      "English language should be indexed",
    );
    expect(entry.languages.en.page_count).toBeGreaterThan(
      0,
      "should have indexed pages",
    );
  });
});
