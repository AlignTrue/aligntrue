/**
 * Tests for config merging in two-file config system
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  isTeamModeActive,
  hasTeamModeOffMarker,
  loadMergedConfig,
  mergeConfigs,
  TEAM_MODE_OFF_MARKER,
} from "../../src/config/merge.js";

describe("Mode detection", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "aligntrue-merge-"));
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
});

describe("Config merging", () => {
  describe("mergeConfigs", () => {
    it("merges sources additively (team first, then personal)", () => {
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

    it("deduplicates sources with same path/url", () => {
      const personal = {
        sources: [
          { type: "local" as const, path: ".aligntrue/rules" },
          { type: "git" as const, url: "https://example.com/repo" },
        ],
      };
      const team = {
        sources: [
          { type: "local" as const, path: ".aligntrue/rules" }, // duplicate
          { type: "local" as const, path: "team-rules" },
        ],
      };

      const { config } = mergeConfigs(personal, team);
      // Should have 3 sources, not 4 (deduplicated local .aligntrue/rules)
      expect(config.sources).toHaveLength(3);
      expect(config.sources).toEqual([
        { type: "local", path: ".aligntrue/rules" }, // from team
        { type: "local", path: "team-rules" }, // from team
        { type: "git", url: "https://example.com/repo" }, // from personal
      ]);
    });

    it("treats git sources with different refs as distinct", () => {
      const personal = {
        sources: [
          { type: "git" as const, url: "https://example.com/repo", ref: "v2" },
        ],
      };
      const team = {
        sources: [
          { type: "git" as const, url: "https://example.com/repo", ref: "v1" },
        ],
      };

      const { config } = mergeConfigs(personal, team);
      // Different refs = different sources
      expect(config.sources).toHaveLength(2);
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

    it("remotes are merged correctly", () => {
      const personal = {
        remotes: { personal: "https://personal.example.com" },
      };
      const team = { remotes: { shared: "https://team.example.com" } };

      const { config } = mergeConfigs(personal, team);
      expect(config.remotes?.personal).toBe("https://personal.example.com");
      expect(config.remotes?.shared).toBe("https://team.example.com");
    });
  });

  describe("loadMergedConfig", () => {
    let testDir: string;

    beforeEach(() => {
      testDir = mkdtempSync(join(tmpdir(), "aligntrue-merge-load-"));
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
  });
});
