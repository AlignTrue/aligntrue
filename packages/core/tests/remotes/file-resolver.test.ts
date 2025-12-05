/**
 * Tests for remotes file resolver
 *
 * Tests pattern-based routing and mode-aware routing.
 * Note: Scope-based routing tests require full frontmatter parsing
 * which is tested via integration tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import {
  resolveFileAssignments,
  getRemotesStatus,
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

  it("should not assign team-scope files in team mode (they stay in main repo)", () => {
    // Create test file with team scope (default - no frontmatter)
    writeFileSync(join(TEST_DIR, "rules/team-rules.md"), "# Team Rules");

    const config: RemotesConfig = {
      personal: {
        url: "git@github.com:user/personal.git",
      },
    };

    // Team mode: only scope: personal files go to personal remote
    const result = resolveFileAssignments(config, join(TEST_DIR, "rules"), [], {
      mode: "team",
    });

    // Team files should not be assigned to any remote in team mode
    expect(result.assignments).toHaveLength(0);
    expect(result.diagnostics?.mode).toBe("team");
    expect(result.diagnostics?.totalFiles).toBe(1);
    expect(result.diagnostics?.routedFiles).toBe(0);
  });

  it("should assign ALL files to personal in solo mode (default)", () => {
    // Create test files without scope frontmatter (defaults to team)
    writeFileSync(join(TEST_DIR, "rules/global.md"), "# Global Rules");
    writeFileSync(join(TEST_DIR, "rules/testing.md"), "# Testing Rules");
    writeFileSync(join(TEST_DIR, "rules/security.md"), "# Security Rules");

    const config: RemotesConfig = {
      personal: {
        url: "git@github.com:user/personal.git",
      },
    };

    // Solo mode: ALL files go to personal remote regardless of scope
    const result = resolveFileAssignments(config, join(TEST_DIR, "rules"), [], {
      mode: "solo",
    });

    // All files should be assigned to personal in solo mode
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].remoteId).toBe("personal");
    expect(result.assignments[0].files).toHaveLength(3);
    expect(result.assignments[0].files).toContain("global.md");
    expect(result.assignments[0].files).toContain("testing.md");
    expect(result.assignments[0].files).toContain("security.md");

    // Diagnostics should reflect solo mode
    expect(result.diagnostics?.mode).toBe("solo");
    expect(result.diagnostics?.totalFiles).toBe(3);
    expect(result.diagnostics?.routedFiles).toBe(3);
    expect(result.diagnostics?.unroutedFiles).toHaveLength(0);
  });

  it("should default to solo mode when no mode specified", () => {
    writeFileSync(join(TEST_DIR, "rules/rules.md"), "# Rules");

    const config: RemotesConfig = {
      personal: {
        url: "git@github.com:user/personal.git",
      },
    };

    // No mode option = defaults to solo
    const result = resolveFileAssignments(config, join(TEST_DIR, "rules"));

    // Solo is default, so file should be routed
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].files).toContain("rules.md");
    expect(result.diagnostics?.mode).toBe("solo");
  });

  it("should route explicitly shared files to shared remote in solo mode", () => {
    // Create file with scope: shared frontmatter
    writeFileSync(
      join(TEST_DIR, "rules/shared-rules.md"),
      `---
scope: shared
---
# Shared Rules`,
    );
    writeFileSync(join(TEST_DIR, "rules/other.md"), "# Other Rules");

    const config: RemotesConfig = {
      personal: {
        url: "git@github.com:user/personal.git",
      },
      shared: {
        url: "git@github.com:org/shared.git",
      },
    };

    const result = resolveFileAssignments(config, join(TEST_DIR, "rules"), [], {
      mode: "solo",
    });

    // Shared file goes to shared, other goes to personal
    expect(result.assignments).toHaveLength(2);

    const sharedAssignment = result.assignments.find(
      (a) => a.remoteId === "shared",
    );
    const personalAssignment = result.assignments.find(
      (a) => a.remoteId === "personal",
    );

    expect(sharedAssignment?.files).toContain("shared-rules.md");
    expect(personalAssignment?.files).toContain("other.md");
    expect(personalAssignment?.files).not.toContain("shared-rules.md");
  });

  it("should provide diagnostics when no files route in team mode", () => {
    // Create files without personal scope
    writeFileSync(join(TEST_DIR, "rules/team1.md"), "# Team 1");
    writeFileSync(join(TEST_DIR, "rules/team2.md"), "# Team 2");

    const config: RemotesConfig = {
      personal: {
        url: "git@github.com:user/personal.git",
      },
    };

    const result = resolveFileAssignments(config, join(TEST_DIR, "rules"), [], {
      mode: "team",
    });

    expect(result.assignments).toHaveLength(0);
    expect(result.diagnostics?.mode).toBe("team");
    expect(result.diagnostics?.totalFiles).toBe(2);
    expect(result.diagnostics?.routedFiles).toBe(0);
    expect(result.diagnostics?.unroutedFiles).toHaveLength(2);

    // Unrouted files should have clear reasons
    for (const unrouted of result.diagnostics!.unroutedFiles) {
      expect(unrouted.scope).toBe("team");
      expect(unrouted.reason).toContain("stays in main repo");
    }
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

  it("should include diagnostics in status when mode is provided", () => {
    writeFileSync(join(TEST_DIR, "rules/rules.md"), "# Rules");

    const config: RemotesConfig = {
      personal: {
        url: "git@github.com:user/personal.git",
      },
    };

    const { diagnostics } = getRemotesStatus(
      config,
      join(TEST_DIR, "rules"),
      [],
      { mode: "solo" },
    );

    expect(diagnostics).toBeDefined();
    expect(diagnostics?.mode).toBe("solo");
    expect(diagnostics?.totalFiles).toBe(1);
  });
});
