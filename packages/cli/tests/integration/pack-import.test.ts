/**
 * Integration tests for pack import workflow
 *
 * Tests the CLI's ability to use packs as sources.
 * Uses mocked fetch to avoid hitting GitHub API.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import * as yaml from "yaml";
import {
  setupTestProject,
  type TestProjectContext,
} from "../helpers/test-setup.js";
import { sync } from "../../src/commands/sync/index.js";
import type { ResolvedPack } from "@aligntrue/sources";

let TEST_DIR: string;
let testProjectContext: TestProjectContext;
let originalCwd: string;

// Skip on Windows due to file locking issues
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

describeSkipWindows("Pack Import Integration", () => {
  beforeEach(async () => {
    testProjectContext = await setupTestProject({ skipFiles: true });
    TEST_DIR = testProjectContext.projectDir;
    originalCwd = process.cwd();
    process.chdir(TEST_DIR);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await testProjectContext.cleanup();
    vi.restoreAllMocks();
  });

  describe("local pack source", () => {
    it("syncs rules from local pack directory", async () => {
      // Create a local pack structure (simulating what would come from git)
      const packDir = join(TEST_DIR, "external-pack");
      mkdirSync(join(packDir, "rules"), { recursive: true });

      // Create manifest
      writeFileSync(
        join(packDir, ".align.yaml"),
        yaml.stringify({
          id: "test/local-pack",
          version: "1.0.0",
          summary: "Test pack",
          includes: {
            rules: ["rules/*.md"],
          },
        }),
      );

      // Create rule files
      writeFileSync(
        join(packDir, "rules", "testing.md"),
        `---
title: Testing Guidelines
---

# Testing Guidelines

Write tests for all features.
`,
      );

      writeFileSync(
        join(packDir, "rules", "security.md"),
        `---
title: Security Best Practices
---

# Security Best Practices

Never commit secrets.
`,
      );

      // Configure aligntrue to use local source pointing to pack rules
      const config = {
        mode: "solo",
        sources: [{ type: "local", path: "external-pack/rules" }],
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
      );

      // Run sync
      await sync([]);

      // Verify rules were exported
      const cursorDir = join(TEST_DIR, ".cursor", "rules");
      expect(existsSync(cursorDir)).toBe(true);

      const exportedFiles = [
        join(cursorDir, "testing.mdc"),
        join(cursorDir, "security.mdc"),
      ];

      for (const file of exportedFiles) {
        expect(existsSync(file)).toBe(true);
      }

      // Verify content
      const testingContent = readFileSync(
        join(cursorDir, "testing.mdc"),
        "utf-8",
      );
      expect(testingContent).toContain("Testing Guidelines");
      expect(testingContent).toContain("Write tests for all features");
    });

    it("preserves rule frontmatter during sync", async () => {
      // Create pack with frontmatter
      const packDir = join(TEST_DIR, "pack-with-meta");
      mkdirSync(join(packDir, "rules"), { recursive: true });

      writeFileSync(
        join(packDir, ".align.yaml"),
        yaml.stringify({
          id: "test/meta-pack",
          version: "1.0.0",
          includes: { rules: ["rules/*.md"] },
        }),
      );

      writeFileSync(
        join(packDir, "rules", "global.md"),
        `---
title: Global Rules
description: "Universal guidelines for all projects"
alwaysApply: true
---

# Global Rules

## Code Quality

Keep code clean and readable.
`,
      );

      // Configure and sync
      const config = {
        mode: "solo",
        sources: [{ type: "local", path: "pack-with-meta/rules" }],
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
      );

      await sync([]);

      // Verify exported file has description
      const exported = readFileSync(
        join(TEST_DIR, ".cursor", "rules", "global.mdc"),
        "utf-8",
      );
      expect(exported).toContain("Universal guidelines for all projects");
      expect(exported).toContain("Code Quality");
    });
  });

  describe("example pack validation", () => {
    it("validates example-pack .align.yaml structure", () => {
      // This test validates that our example pack manifest can be parsed
      const exampleManifest = `id: aligntrue/example-starter
version: 1.0.0
summary: "Example starter pack with global, testing, and TypeScript rules"
author: "@aligntrue"
license: MIT
includes:
  rules:
    - "rules/*.md"
`;
      const parsed = yaml.parse(exampleManifest);

      expect(parsed.id).toBe("aligntrue/example-starter");
      expect(parsed.version).toBe("1.0.0");
      expect(parsed.includes.rules).toEqual(["rules/*.md"]);
    });
  });

  describe("mocked GitHub pack import", () => {
    it("importRules uses pack resolution for GitHub sources", async () => {
      // Mock the resolvePackFromGithub function
      const mockPack: ResolvedPack = {
        manifest: {
          id: "test/github-pack",
          version: "1.0.0",
          summary: "Mocked GitHub pack",
        },
        manifestPath: ".align.yaml",
        files: [
          {
            path: "rules/mocked-rule.md",
            size: 100,
            content: `---
title: Mocked Rule
---

# Mocked Rule

This rule was fetched from a mocked GitHub source.
`,
          },
        ],
        ref: "main",
        repo: { host: "github.com", org: "test", repo: "pack-repo" },
      };

      // Use dynamic import to mock the module
      const sourcesModule = await import("@aligntrue/sources");
      const resolvePackSpy = vi
        .spyOn(sourcesModule, "resolvePackFromGithub")
        .mockResolvedValue(mockPack);

      // Import the importRules function
      const { importRules } = await import(
        "../../src/utils/source-resolver.js"
      );

      // Call importRules with a GitHub source
      const result = await importRules({
        source: "https://github.com/test/pack-repo",
        targetDir: join(TEST_DIR, ".aligntrue", "rules"),
        cwd: TEST_DIR,
      });

      // Verify the mock was called
      expect(resolvePackSpy).toHaveBeenCalled();

      // Verify rules were returned
      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].frontmatter.title).toBe("Mocked Rule");
      expect(result.rules[0].content).toContain("mocked GitHub source");
      expect(result.sourceType).toBe("git");

      resolvePackSpy.mockRestore();
    });

    it("importRules falls back when pack not found", async () => {
      // Mock resolvePackFromGithub to throw "no manifest" error
      const sourcesModule = await import("@aligntrue/sources");
      const resolvePackSpy = vi
        .spyOn(sourcesModule, "resolvePackFromGithub")
        .mockRejectedValue(new Error("No .align.yaml found"));

      // Verify the spy is set up
      expect(resolvePackSpy).toBeDefined();

      // Import the importRules function
      const { importRules } = await import(
        "../../src/utils/source-resolver.js"
      );

      // Call importRules - it should try pack first, then fall back to git
      // Since we don't have a real git repo, it will error
      const result = await importRules({
        source: "https://github.com/test/no-pack-repo",
        targetDir: join(TEST_DIR, ".aligntrue", "rules"),
        cwd: TEST_DIR,
      });

      // Pack resolution was attempted
      expect(resolvePackSpy).toHaveBeenCalled();

      // Falls back to git, which fails because repo doesn't exist
      expect(result.error).toBeDefined();
      expect(result.sourceType).toBe("git");

      resolvePackSpy.mockRestore();
    });
  });
});
