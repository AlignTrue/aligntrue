/**
 * Tests for pagefind search index build output
 *
 * Validates that the pagefind search index is properly generated during build.
 * These tests require the docs app to be built first and will skip if not built.
 *
 * To run these tests: pnpm --filter @aligntrue/docs build
 */

import { describe, it, expect, test } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pagefindDir = path.join(__dirname, "..", "public/_pagefind");

describe("Search Index Build", () => {
  test.skipIf(!fs.existsSync(pagefindDir))(
    "should generate pagefind search index",
    () => {
      // Verify essential files exist
      expect(fs.existsSync(path.join(pagefindDir, "pagefind.js"))).toBe(true);
      expect(fs.existsSync(path.join(pagefindDir, "pagefind-entry.json"))).toBe(
        true,
      );

      // Check that fragments were indexed
      const fragmentDir = path.join(pagefindDir, "fragment");
      expect(fs.existsSync(fragmentDir)).toBe(true);
      const fragments = fs.readdirSync(fragmentDir);
      expect(fragments.length).toBeGreaterThan(0);
    },
  );

  test.skipIf(!fs.existsSync(pagefindDir))(
    "should have valid pagefind entry configuration",
    () => {
      const entryPath = path.join(pagefindDir, "pagefind-entry.json");
      const entry = JSON.parse(fs.readFileSync(entryPath, "utf-8"));

      expect(entry.version).toBeDefined();
      expect(entry.languages).toBeDefined();
      expect(entry.languages.en).toBeDefined();
      expect(entry.languages.en.page_count).toBeGreaterThan(0);
    },
  );

  // Show helpful message when tests are skipped
  if (!fs.existsSync(pagefindDir)) {
    it("pagefind index not built", () => {
      console.log(
        "\n⚠️  Pagefind index not built. Run: pnpm --filter @aligntrue/docs build\n",
      );
    });
  }
});
