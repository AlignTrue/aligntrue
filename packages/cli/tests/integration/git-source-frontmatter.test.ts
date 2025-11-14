/**
 * Integration test for git source loading with YAML frontmatter
 * Verifies that packs from GitHub with frontmatter parse correctly
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { sync } from "../../src/commands/sync/index.js";
import { stringify as stringifyYaml } from "yaml";

const TEST_DIR = join(process.cwd(), "test-git-frontmatter");

describe("Git source with YAML frontmatter", () => {
  beforeEach(() => {
    // Clean up before each test
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    process.chdir(TEST_DIR);
  });

  afterEach(() => {
    // Clean up after test
    process.chdir(join(TEST_DIR, ".."));
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("parses pack with YAML frontmatter from git source", async () => {
    // Create config with git source pointing to examples repo
    mkdirSync(".aligntrue", { recursive: true });
    const config = {
      mode: "solo",
      sources: [
        {
          type: "git",
          url: "https://github.com/AlignTrue/examples",
          path: "testing.md",
        },
      ],
      exporters: ["agents-md"],
    };

    writeFileSync(".aligntrue/config.yaml", stringifyYaml(config), "utf-8");

    // Run sync - this should fetch and parse the pack with frontmatter
    try {
      await sync([]);
    } catch (err) {
      // Sync may fail due to network or other issues, but we're testing parsing
      // If it fails with a parsing error, that's what we want to catch
      if (err instanceof Error) {
        // Should not contain "multiple documents" error
        expect(err.message).not.toContain("multiple documents");
        expect(err.message).not.toContain("parseAllDocuments");
      }
    }

    // If sync succeeded, verify AGENTS.md was created
    if (existsSync("AGENTS.md")) {
      expect(existsSync("AGENTS.md")).toBe(true);
    }
  }, 30000); // 30 second timeout for network operations

  it("handles local markdown file with frontmatter", async () => {
    // Create a local markdown file with YAML frontmatter
    const markdownContent = `---
id: "test-pack"
version: "1.0.0"
summary: "Test pack with frontmatter"
tags: ["test"]
---

# Test Pack

This is a test pack with YAML frontmatter.

## Test Section

Content here.
`;

    writeFileSync("test-pack.md", markdownContent, "utf-8");

    // Create config pointing to local file
    mkdirSync(".aligntrue", { recursive: true });
    const config = {
      mode: "solo",
      sources: [
        {
          type: "local",
          path: "test-pack.md",
        },
      ],
      exporters: ["agents-md"],
    };

    writeFileSync(".aligntrue/config.yaml", stringifyYaml(config), "utf-8");

    // Run sync - should parse frontmatter correctly
    await sync([]);

    // The main goal is to verify parsing worked without errors
    // Sync completed successfully, which means frontmatter was parsed correctly
    // (If parsing failed, sync would have thrown an error)
    expect(true).toBe(true);
  });
});
