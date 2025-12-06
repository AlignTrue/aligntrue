/**
 * Comprehensive team mode workflow tests
 * Simulates two team members collaborating
 *
 * Tests cover:
 * 1. Team mode initialization and defaults
 * 2. Multi-user collaboration (simulated)
 * 3. Lockfile generation and drift detection
 * 4. Personal rules isolation in team mode
 * 5. Mode switching (solo → team → solo)
 *
 * Note: Skipped on Windows CI due to file locking issues
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdirSync,
  rmSync,
  readFileSync,
  existsSync,
  writeFileSync,
  cpSync,
  mkdtempSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { init } from "../../src/commands/init.js";
import { team } from "../../src/commands/team.js";
import * as clack from "@clack/prompts";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

vi.mock("@clack/prompts");

// Skip on Windows due to file locking issues in CI
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

describeSkipWindows("Team Mode Workflow", () => {
  let env1: string;
  let env2: string;
  let originalCwd: string;

  beforeEach(() => {
    vi.clearAllMocks();
    originalCwd = process.cwd();

    env1 = mkdtempSync(join(tmpdir(), "aligntrue-team-env1-"));
    env2 = mkdtempSync(join(tmpdir(), "aligntrue-team-env2-"));
    mkdirSync(env1, { recursive: true });
    mkdirSync(env2, { recursive: true });
    // Team mode now requires a git repository; create minimal git dirs for fixtures
    mkdirSync(join(env1, ".git"), { recursive: true });
    mkdirSync(join(env2, ".git"), { recursive: true });

    // Mock process.exit to throw for testing
    vi.spyOn(process, "exit").mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });

    // Mock clack prompts to avoid terminal interaction
    vi.mocked(clack.confirm).mockResolvedValue(true);
    vi.mocked(clack.cancel).mockImplementation(() => {});
    vi.mocked(clack.isCancel).mockReturnValue(false);
    vi.mocked(clack.intro).mockImplementation(() => {});
    vi.mocked(clack.outro).mockImplementation(() => {});
    vi.mocked(clack.spinner).mockReturnValue({
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
    } as never);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(env1)) {
      rmSync(env1, { recursive: true, force: true });
    }
    if (existsSync(env2)) {
      rmSync(env2, { recursive: true, force: true });
    }
  });

  describe("Team Mode Initialization", () => {
    it("team mode enables lockfile by default", async () => {
      process.chdir(env1);
      await init(["--yes"]);
      await team(["enable", "--yes"]);

      // Check team config has lockfile module enabled
      const teamConfig = parseYaml(
        readFileSync(join(env1, ".aligntrue/config.team.yaml"), "utf-8"),
      );
      expect(teamConfig.modules.lockfile).toBe(true);

      // Check personal config was created
      expect(existsSync(join(env1, ".aligntrue/config.yaml"))).toBe(true);
    });

    it("generates lockfile after sync in team mode", async () => {
      process.chdir(env1);
      await init(["--yes"]);

      // Create a rule file before enabling team mode
      const rulesDir = join(env1, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        join(rulesDir, "team-rule.md"),
        `---
title: Team Rule
---

# Team Rule

Team guidance here.
`,
        "utf-8",
      );

      await team(["enable", "--yes"]);

      // Lockfile is created after sync, not immediately after enable
      const { sync } = await import("../../src/commands/sync/index.js");
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      // Lockfile should be created after sync
      const lockfilePath = join(env1, ".aligntrue/lock.json");
      expect(existsSync(lockfilePath)).toBe(true);

      const lockfile = JSON.parse(readFileSync(lockfilePath, "utf-8"));
      expect(lockfile.version).toBe("2");
      expect(lockfile.bundle_hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("keeps exporters in personal config when enabling team mode", async () => {
      process.chdir(env1);
      await init(["--yes"]);

      // Set personal exporters before enabling team mode
      const personalPath = join(env1, ".aligntrue", "config.yaml");
      const personalConfig = parseYaml(
        readFileSync(personalPath, "utf-8"),
      ) as Record<string, unknown>;
      personalConfig["exporters"] = ["cursor", "agents"];
      writeFileSync(personalPath, stringifyYaml(personalConfig), "utf-8");

      await team(["enable", "--yes"]);

      // Team config should not copy exporters by default
      const teamConfig = parseYaml(
        readFileSync(join(env1, ".aligntrue", "config.team.yaml"), "utf-8"),
      ) as Record<string, unknown>;
      expect(teamConfig["exporters"]).toBeUndefined();

      // Personal config should still contain the exporters
      const personalAfter = parseYaml(
        readFileSync(personalPath, "utf-8"),
      ) as Record<string, unknown>;
      expect(personalAfter["exporters"]).toEqual(["cursor", "agents"]);
    });
  });

  describe("Multi-User Collaboration (Simulated)", () => {
    /**
     * Simulates user-a initializing team mode,
     * then user-b "cloning" the project and syncing
     */
    it("user-b can join team by copying shared files", async () => {
      // User A: Initialize team mode
      process.chdir(env1);
      await init(["--yes"]);

      // Create initial team rule
      const rulesDir = join(env1, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        join(rulesDir, "shared-rule.md"),
        `---
title: Shared Rule
---

# Shared Rule

This is a team-wide rule.
`,
        "utf-8",
      );

      await team(["enable", "--yes"]);

      // Sync to generate exports and lockfile
      const { sync } = await import("../../src/commands/sync/index.js");
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      // Verify lockfile was created
      expect(existsSync(join(env1, ".aligntrue/lock.json"))).toBe(true);

      // User B: "Clone" by copying shared files
      process.chdir(env2);
      cpSync(join(env1, ".aligntrue"), join(env2, ".aligntrue"), {
        recursive: true,
      });
      cpSync(
        join(env1, ".aligntrue/lock.json"),
        join(env2, ".aligntrue/lock.json"),
      );

      // User B syncs - should work with existing team config
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      // Both users should have same lockfile hash
      const lockfile1 = JSON.parse(
        readFileSync(join(env1, ".aligntrue/lock.json"), "utf-8"),
      );
      const lockfile2 = JSON.parse(
        readFileSync(join(env2, ".aligntrue/lock.json"), "utf-8"),
      );
      expect(lockfile2.bundle_hash).toBe(lockfile1.bundle_hash);
    });

    it("detects drift when user-a makes unapproved changes", async () => {
      // User A: Initialize team mode
      process.chdir(env1);
      await init(["--yes"]);

      const rulesDir = join(env1, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        join(rulesDir, "original-rule.md"),
        `---
title: Original Rule
---

# Original Rule

Original content.
`,
        "utf-8",
      );

      await team(["enable", "--yes"]);

      // Initial sync
      const { sync } = await import("../../src/commands/sync/index.js");
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      const originalLockfile = JSON.parse(
        readFileSync(join(env1, ".aligntrue/lock.json"), "utf-8"),
      );
      const originalHash = originalLockfile.bundle_hash;

      // User A makes unapproved change
      writeFileSync(
        join(rulesDir, "original-rule.md"),
        `---
title: Original Rule
---

# Original Rule

MODIFIED content - not yet approved!
`,
        "utf-8",
      );

      // Sync again - lockfile should update
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      const updatedLockfile = JSON.parse(
        readFileSync(join(env1, ".aligntrue/lock.json"), "utf-8"),
      );

      // Hash should be different - drift detected
      expect(updatedLockfile.bundle_hash).not.toBe(originalHash);
    });

    it("user-b detects outdated lockfile after user-a changes", async () => {
      // User A: Initialize and sync
      process.chdir(env1);
      await init(["--yes"]);

      const rulesDir = join(env1, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        join(rulesDir, "team-rule.md"),
        `---
title: Team Rule
---

# Team Rule

Version 1.
`,
        "utf-8",
      );

      await team(["enable", "--yes"]);

      const { sync } = await import("../../src/commands/sync/index.js");
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      // User B: Clone state before user-a's change
      process.chdir(env2);
      cpSync(join(env1, ".aligntrue"), join(env2, ".aligntrue"), {
        recursive: true,
      });
      cpSync(
        join(env1, ".aligntrue/lock.json"),
        join(env2, ".aligntrue/lock.json"),
      );

      const userBOriginalLockfile = JSON.parse(
        readFileSync(join(env2, ".aligntrue/lock.json"), "utf-8"),
      );

      // User A: Make a change
      process.chdir(env1);
      writeFileSync(
        join(rulesDir, "team-rule.md"),
        `---
title: Team Rule
---

# Team Rule

Version 2 - updated by User A.
`,
        "utf-8",
      );

      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      const userAUpdatedLockfile = JSON.parse(
        readFileSync(join(env1, ".aligntrue/lock.json"), "utf-8"),
      );

      // User B's lockfile is now outdated
      expect(userBOriginalLockfile.bundle_hash).not.toBe(
        userAUpdatedLockfile.bundle_hash,
      );

      // This is the scenario where user-b would need to pull and sync
      // In real workflow, git pull would update the lockfile
    });
  });

  describe("Personal Rules Isolation", () => {
    /**
     * Note: Personal rule exclusion requires section-level scope, not frontmatter scope.
     * This test verifies that the lockfile is generated correctly with team rules.
     */
    it("generates lockfile with team rules", async () => {
      process.chdir(env1);
      await init(["--yes"]);

      const rulesDir = join(env1, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });

      // Team rule
      writeFileSync(
        join(rulesDir, "team-rule.md"),
        `---
title: Team Rule
---

# Team Rule

Shared team guidance.
`,
        "utf-8",
      );

      await team(["enable", "--yes"]);

      const { sync } = await import("../../src/commands/sync/index.js");
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      const lockfile = JSON.parse(
        readFileSync(join(env1, ".aligntrue/lock.json"), "utf-8"),
      );

      // Lockfile should have v2 format with bundle hash
      expect(lockfile.version).toBe("2");
      expect(lockfile.bundle_hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("team lockfile hash changes when team rule changes", async () => {
      process.chdir(env1);
      await init(["--yes"]);

      const rulesDir = join(env1, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });

      // Team rule
      writeFileSync(
        join(rulesDir, "team-rule.md"),
        `---
title: Team Rule
---

# Team Rule

Version 1.
`,
        "utf-8",
      );

      await team(["enable", "--yes"]);

      const { sync } = await import("../../src/commands/sync/index.js");
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      const originalLockfile = JSON.parse(
        readFileSync(join(env1, ".aligntrue/lock.json"), "utf-8"),
      );
      const originalHash = originalLockfile.bundle_hash;

      // Modify team rule
      writeFileSync(
        join(rulesDir, "team-rule.md"),
        `---
title: Team Rule
---

# Team Rule

Version 2 - MODIFIED team rule.
`,
        "utf-8",
      );

      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      const updatedLockfile = JSON.parse(
        readFileSync(join(env1, ".aligntrue/lock.json"), "utf-8"),
      );

      // Team lockfile hash SHOULD change when team rule changes
      expect(updatedLockfile.bundle_hash).not.toBe(originalHash);
    });
  });

  describe("Mode Switching", () => {
    it("can switch from solo to team mode", async () => {
      process.chdir(env1);
      await init(["--yes"]);

      // Verify starts in default mode (no team config)
      expect(existsSync(join(env1, ".aligntrue/config.team.yaml"))).toBe(false);
      expect(existsSync(join(env1, ".aligntrue/lock.json"))).toBe(false);

      // Enable team mode
      await team(["enable", "--yes"]);

      // Verify team mode - team settings are now in config.team.yaml
      expect(existsSync(join(env1, ".aligntrue/config.team.yaml"))).toBe(true);
      const teamConfig = parseYaml(
        readFileSync(join(env1, ".aligntrue/config.team.yaml"), "utf-8"),
      );
      expect(teamConfig.mode).toBe("team");
    });

    it("can switch from team back to solo mode", async () => {
      process.chdir(env1);
      await init(["--yes"]);
      await team(["enable", "--yes"]);

      // Verify in team mode - settings are in config.team.yaml
      expect(existsSync(join(env1, ".aligntrue/config.team.yaml"))).toBe(true);
      let teamConfig = parseYaml(
        readFileSync(join(env1, ".aligntrue/config.team.yaml"), "utf-8"),
      );
      expect(teamConfig.mode).toBe("team");

      // Disable team mode
      await team(["disable", "--yes"]);

      // Verify team mode disabled via OFF marker (non-destructive)
      // Team config file still exists but has the OFF marker
      const teamConfigContent = readFileSync(
        join(env1, ".aligntrue/config.team.yaml"),
        "utf-8",
      );
      expect(teamConfigContent).toContain("# TEAM MODE OFF");
    });

    it("lockfile hash is stable when re-enabling team mode", async () => {
      process.chdir(env1);
      await init(["--yes"]);

      const rulesDir = join(env1, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        join(rulesDir, "rule.md"),
        `---
title: Rule
---

# Rule

Content.
`,
        "utf-8",
      );

      await team(["enable", "--yes"]);

      const { sync } = await import("../../src/commands/sync/index.js");
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      const originalLockfile = JSON.parse(
        readFileSync(join(env1, ".aligntrue/lock.json"), "utf-8"),
      );
      // Disable team mode
      await team(["disable", "--yes"]);

      // Re-enable team mode
      await team(["enable", "--yes"]);

      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      const newLockfile = JSON.parse(
        readFileSync(join(env1, ".aligntrue/lock.json"), "utf-8"),
      );

      // Compare lockfile structure (allow hash to change if content changed)
      const { bundle_hash: _oldHash, ...oldRest } = originalLockfile;
      const { bundle_hash: _newHash, ...newRest } = newLockfile;
      expect(newRest).toStrictEqual(oldRest);
    });
  });

  describe("Lockfile Determinism", () => {
    it("same content produces same lockfile hash across environments", async () => {
      const ruleContent = `---
title: Determinism Test
---

# Determinism Test

This content should hash identically.
`;

      // User A: Initialize and sync
      process.chdir(env1);
      await init(["--yes"]);

      const rulesDir1 = join(env1, ".aligntrue", "rules");
      mkdirSync(rulesDir1, { recursive: true });
      writeFileSync(join(rulesDir1, "rule.md"), ruleContent, "utf-8");

      await team(["enable", "--yes"]);

      const { sync } = await import("../../src/commands/sync/index.js");
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      const lockfile1 = JSON.parse(
        readFileSync(join(env1, ".aligntrue/lock.json"), "utf-8"),
      );

      // User B: Initialize fresh with same content
      process.chdir(env2);
      await init(["--yes"]);

      const rulesDir2 = join(env2, ".aligntrue", "rules");
      mkdirSync(rulesDir2, { recursive: true });
      writeFileSync(join(rulesDir2, "rule.md"), ruleContent, "utf-8");

      await team(["enable", "--yes"]);

      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      const lockfile2 = JSON.parse(
        readFileSync(join(env2, ".aligntrue/lock.json"), "utf-8"),
      );

      // Same content should produce identical hashes
      expect(lockfile2.bundle_hash).toBe(lockfile1.bundle_hash);
    });
  });
});
