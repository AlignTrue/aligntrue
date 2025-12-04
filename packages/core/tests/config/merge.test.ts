/**
 * Tests for config merging in two-file config system
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  isTeamModeActive,
  hasTeamModeOffMarker,
  isLegacyTeamConfig,
  loadMergedConfig,
  mergeConfigs,
  TEAM_MODE_OFF_MARKER,
} from "../../src/config/merge.js";

describe("Mode detection", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `merge-test-${Date.now()}`);
    mkdirSync(join(testDir, ".aligntrue"), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("isTeamModeActive", () => {
    it("returns false when no team config exists", () => {
      expect(isTeamModeActive(testDir)).toBe(false);
    });

    it("returns true when team config exists", () => {
      writeFileSync(
        join(testDir, ".aligntrue", "config.team.yaml"),
        "mode: team\n",
        "utf-8",
      );
      expect(isTeamModeActive(testDir)).toBe(true);
    });

    it("returns false when team config has OFF marker", () => {
      writeFileSync(
        join(testDir, ".aligntrue", "config.team.yaml"),
        `${TEAM_MODE_OFF_MARKER}\nmode: team\n`,
        "utf-8",
      );
      expect(isTeamModeActive(testDir)).toBe(false);
    });
  });

  describe("hasTeamModeOffMarker", () => {
    it("returns false when team config does not exist", () => {
      expect(hasTeamModeOffMarker(testDir)).toBe(false);
    });

    it("returns true when team config has OFF marker", () => {
      writeFileSync(
        join(testDir, ".aligntrue", "config.team.yaml"),
        `${TEAM_MODE_OFF_MARKER}\nmode: team\n`,
        "utf-8",
      );
      expect(hasTeamModeOffMarker(testDir)).toBe(true);
    });

    it("returns false when team config exists without OFF marker", () => {
      writeFileSync(
        join(testDir, ".aligntrue", "config.team.yaml"),
        "mode: team\n",
        "utf-8",
      );
      expect(hasTeamModeOffMarker(testDir)).toBe(false);
    });
  });

  describe("isLegacyTeamConfig", () => {
    it("returns false in solo mode", () => {
      writeFileSync(
        join(testDir, ".aligntrue", "config.yaml"),
        "mode: solo\n",
        "utf-8",
      );
      expect(isLegacyTeamConfig(testDir)).toBe(false);
    });

    it("returns true when mode: team in config.yaml with no team config", () => {
      writeFileSync(
        join(testDir, ".aligntrue", "config.yaml"),
        "mode: team\n",
        "utf-8",
      );
      expect(isLegacyTeamConfig(testDir)).toBe(true);
    });

    it("returns false when config.team.yaml exists (new two-file system)", () => {
      writeFileSync(
        join(testDir, ".aligntrue", "config.yaml"),
        "mode: team\n",
        "utf-8",
      );
      writeFileSync(
        join(testDir, ".aligntrue", "config.team.yaml"),
        "mode: team\n",
        "utf-8",
      );
      expect(isLegacyTeamConfig(testDir)).toBe(false);
    });
  });
});

describe("Config merging", () => {
  describe("mergeConfigs", () => {
    it("merges sources additively", () => {
      const personal = {
        sources: [{ type: "local" as const, path: "personal" }],
      };
      const team = {
        sources: [{ type: "local" as const, path: "team" }],
      };

      const { config } = mergeConfigs(personal, team);
      expect(config.sources).toEqual([
        { type: "local", path: "team" },
        { type: "local", path: "personal" },
      ]);
    });

    it("merges exporters additively", () => {
      const personal = { exporters: ["agents"] };
      const team = { exporters: ["cursor"] };

      const { config } = mergeConfigs(personal, team);
      expect((config.exporters as string[]).sort()).toEqual(
        ["agents", "cursor"].sort(),
      );
    });

    it("personal scalars override team scalars", () => {
      const personal = { git: { mode: "ignore" as const } };
      const team = { git: { mode: "commit" as const } };

      const { config } = mergeConfigs(personal, team);
      expect(config.git?.mode).toBe("ignore");
    });

    it("team-only fields from team config only", () => {
      const personal = { mode: "solo" as const };
      const team = { mode: "team" as const };

      const { config } = mergeConfigs(personal, team);
      expect(config.mode).toBe("team");
    });

    it("emits warning for team-only field in personal config", () => {
      const personal = { lockfile: { mode: "soft" as const } };
      const team = { mode: "team" as const };

      const { warnings } = mergeConfigs(personal, team);
      const hasWarning = warnings.some(
        (w) => w.field.includes("lockfile") && w.level === "warn",
      );
      expect(hasWarning).toBe(true);
    });

    it("emits warning for personal-only field in team config", () => {
      const personal = { mode: "solo" as const };
      const team = {
        mode: "team" as const,
        remotes: { personal: "https://example.com" },
      };

      const { warnings } = mergeConfigs(personal, team);
      const hasWarning = warnings.some(
        (w) => w.field.includes("remotes.personal") && w.level === "warn",
      );
      expect(hasWarning).toBe(true);
    });
  });

  describe("loadMergedConfig", () => {
    let testDir: string;

    beforeEach(() => {
      testDir = join(tmpdir(), `merge-load-test-${Date.now()}`);
      mkdirSync(join(testDir, ".aligntrue"), { recursive: true });
    });

    afterEach(() => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it("solo mode: loads only personal config", async () => {
      writeFileSync(
        join(testDir, ".aligntrue", "config.yaml"),
        `version: "1"
mode: solo
exporters:
  - cursor
`,
        "utf-8",
      );

      const { config, isTeamMode } = await loadMergedConfig(testDir);
      expect(isTeamMode).toBe(false);
      expect(config.mode).toBe("solo");
    });

    it("team mode: merges both configs", async () => {
      writeFileSync(
        join(testDir, ".aligntrue", "config.yaml"),
        `version: "1"
exporters:
  - agents
git:
  mode: ignore
`,
        "utf-8",
      );
      writeFileSync(
        join(testDir, ".aligntrue", "config.team.yaml"),
        `mode: team
modules:
  lockfile: true
exporters:
  - cursor
`,
        "utf-8",
      );

      const { config, isTeamMode } = await loadMergedConfig(testDir);
      expect(isTeamMode).toBe(true);
      expect(config.mode).toBe("team");
      // Exporters should be merged
      expect(config.exporters).toBeDefined();
      // Git mode from personal should override
      expect(config.git?.mode).toBe("ignore");
    });

    it("team mode with missing personal config: still works", async () => {
      writeFileSync(
        join(testDir, ".aligntrue", "config.team.yaml"),
        `mode: team
modules:
  lockfile: true
exporters:
  - cursor
`,
        "utf-8",
      );

      const { config, isTeamMode } = await loadMergedConfig(testDir);
      expect(isTeamMode).toBe(true);
      expect(config.mode).toBe("team");
    });

    it("legacy team config: emits deprecation warning", async () => {
      writeFileSync(
        join(testDir, ".aligntrue", "config.yaml"),
        `version: "1"
mode: team
exporters:
  - cursor
`,
        "utf-8",
      );

      const { warnings, isLegacyTeamConfig } = await loadMergedConfig(testDir);
      expect(isLegacyTeamConfig).toBe(true);
      const hasLegacyWarning = warnings.some((w) =>
        w.message.includes("migrate"),
      );
      expect(hasLegacyWarning).toBe(true);
    });
  });
});
