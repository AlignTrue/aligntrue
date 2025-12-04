/**
 * Tests for remotes file resolver
 *
 * Tests pattern-based routing and legacy config conversion.
 * Note: Scope-based routing tests require full frontmatter parsing
 * which is tested via integration tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import {
  resolveFileAssignments,
  getRemotesStatus,
  convertLegacyConfig,
} from "../../src/remotes/file-resolver.js";
import type { RemotesConfig } from "../../src/config/types.js";

// Use a path relative to package root for temp test directories
const TEST_DIR = join(__dirname, "../../temp-test-remotes-resolver");

describe("resolveFileAssignments", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, "rules"), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("should not assign team-scope files (they stay in main repo)", () => {
    // Create test file with team scope (default - no frontmatter)
    writeFileSync(join(TEST_DIR, "rules/team-rules.md"), "# Team Rules");

    const config: RemotesConfig = {
      personal: {
        url: "git@github.com:user/personal.git",
      },
    };

    const result = resolveFileAssignments(config, join(TEST_DIR, "rules"));

    // Team files should not be assigned to any remote
    expect(result.assignments).toHaveLength(0);
  });

  it("should support pattern-based routing via custom remotes", () => {
    // Files without scope frontmatter default to "team"
    writeFileSync(join(TEST_DIR, "rules/typescript.md"), "# TypeScript");
    writeFileSync(join(TEST_DIR, "rules/testing.md"), "# Testing");

    const config: RemotesConfig = {
      custom: [
        {
          id: "public-rules",
          url: "git@github.com:org/public-rules.git",
          include: ["typescript.md"],
        },
      ],
    };

    const result = resolveFileAssignments(config, join(TEST_DIR, "rules"));

    expect(result.assignments).toHaveLength(1);
    const publicRules = result.assignments.find(
      (a) => a.remoteId === "public-rules",
    );
    expect(publicRules?.files).toContain("typescript.md");
    expect(publicRules?.files).not.toContain("testing.md");
  });
});

describe("getRemotesStatus", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, "rules"), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("should return status for all configured remotes", () => {
    // Create test files
    writeFileSync(join(TEST_DIR, "rules/rules.md"), "# Rules");

    const config: RemotesConfig = {
      personal: {
        url: "git@github.com:user/personal.git",
        branch: "main",
      },
      shared: {
        url: "git@github.com:org/shared.git",
      },
    };

    const { remotes, warnings } = getRemotesStatus(
      config,
      join(TEST_DIR, "rules"),
    );

    expect(remotes).toHaveLength(2);
    expect(remotes.find((r) => r.id === "personal")).toBeDefined();
    expect(remotes.find((r) => r.id === "shared")).toBeDefined();
    expect(warnings).toHaveLength(0);
  });
});

describe("convertLegacyConfig", () => {
  it("should convert legacy remote_backup config to remotes format", () => {
    const legacyConfig = {
      default: {
        url: "git@github.com:user/all-rules.git",
        branch: "main",
      },
      additional: [
        {
          id: "public",
          url: "git@github.com:org/public.git",
          include: ["typescript.md", "testing.md"],
        },
      ],
    };

    const result = convertLegacyConfig(legacyConfig);

    expect(result.custom).toHaveLength(2);
    // Default becomes a custom with **/*.md pattern
    expect(result.custom![0]!.id).toBe("default");
    expect(result.custom![0]!.include).toEqual(["**/*.md"]);
    // Additional preserved
    expect(result.custom![1]!.id).toBe("public");
    expect(result.custom![1]!.include).toEqual(["typescript.md", "testing.md"]);
  });
});
