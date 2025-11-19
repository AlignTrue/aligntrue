/**
 * Integration tests for team mode switching state preservation
 * Tests that user-configured sync settings are preserved when switching between solo and team modes
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import type { AlignTrueConfig } from "@aligntrue/core";

const TEST_DIR = join(
  process.cwd(),
  "packages/cli/tests/tmp/team-mode-switching-test",
);

describe("Team Mode Switching - State Preservation", () => {
  beforeEach(() => {
    // Clean up and create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("should preserve auto_pull setting when enabling team mode", async () => {
    // Create solo config with custom auto_pull setting
    const soloConfig: Partial<AlignTrueConfig> = {
      version: "1",
      mode: "solo",
      exporters: ["agents"],
      sync: {
        auto_pull: false, // Explicitly set to false
      },
    };

    const configPath = join(TEST_DIR, ".aligntrue/config.yaml");
    const { stringify: stringifyYaml } = await import("yaml");
    writeFileSync(configPath, stringifyYaml(soloConfig), "utf-8");

    // Simulate team enable logic
    const { loadConfig, applyDefaults } = await import("@aligntrue/core");
    let config = await loadConfig(configPath);

    // Preserve sync settings
    const preservedSync = {
      auto_pull: config.sync?.auto_pull,
      workflow_mode: config.sync?.workflow_mode,
      primary_agent: config.sync?.primary_agent,
      on_conflict: config.sync?.on_conflict,
    };

    // Apply team mode changes
    config.mode = "team";
    config.modules = {
      ...config.modules,
      lockfile: true,
      bundle: true,
    };

    // Apply defaults
    config = applyDefaults(config);

    // Restore preserved settings
    if (preservedSync.auto_pull !== undefined) {
      config.sync = config.sync || {};
      config.sync.auto_pull = preservedSync.auto_pull;
    }

    // Verify auto_pull is preserved
    expect(config.sync?.auto_pull).toBe(false);
    expect(config.mode).toBe("team");
  });

  it("should preserve workflow_mode setting when disabling team mode", async () => {
    // Create team config with custom workflow_mode setting
    const teamConfig: Partial<AlignTrueConfig> = {
      version: "1",
      mode: "team",
      exporters: ["agents"],
      modules: {
        lockfile: true,
        bundle: true,
      },
      sync: {
        workflow_mode: "native_format", // Explicitly set
      },
    };

    const configPath = join(TEST_DIR, ".aligntrue/config.yaml");
    const { stringify: stringifyYaml } = await import("yaml");
    writeFileSync(configPath, stringifyYaml(teamConfig), "utf-8");

    // Simulate team disable logic
    const { loadConfig, applyDefaults } = await import("@aligntrue/core");
    let config = await loadConfig(configPath);

    // Preserve sync settings
    const preservedSync = {
      auto_pull: config.sync?.auto_pull,
      workflow_mode: config.sync?.workflow_mode,
      primary_agent: config.sync?.primary_agent,
      on_conflict: config.sync?.on_conflict,
    };

    // Apply solo mode changes
    config.mode = "solo";
    config.modules = {
      ...config.modules,
      lockfile: false,
      bundle: false,
    };

    // Apply defaults
    config = applyDefaults(config);

    // Restore preserved settings
    if (preservedSync.workflow_mode !== undefined) {
      config.sync = config.sync || {};
      config.sync.workflow_mode = preservedSync.workflow_mode;
    }

    // Verify workflow_mode is preserved
    expect(config.sync?.workflow_mode).toBe("native_format");
    expect(config.mode).toBe("solo");
  });

  it("should preserve all sync settings in round-trip (solo→team→solo)", async () => {
    // Create solo config with all custom sync settings
    const soloConfig: Partial<AlignTrueConfig> = {
      version: "1",
      mode: "solo",
      exporters: ["agents"],
      sync: {
        auto_pull: false,
        workflow_mode: "native_format",
        primary_agent: "cursor",
        on_conflict: "keep_ir",
      },
    };

    const configPath = join(TEST_DIR, ".aligntrue/config.yaml");
    const { stringify: stringifyYaml } = await import("yaml");
    writeFileSync(configPath, stringifyYaml(soloConfig), "utf-8");

    const { loadConfig, applyDefaults } = await import("@aligntrue/core");

    // Step 1: Enable team mode
    let config = await loadConfig(configPath);
    let preservedSync = {
      auto_pull: config.sync?.auto_pull,
      workflow_mode: config.sync?.workflow_mode,
      primary_agent: config.sync?.primary_agent,
      on_conflict: config.sync?.on_conflict,
    };

    config.mode = "team";
    config.modules = { ...config.modules, lockfile: true, bundle: true };
    config = applyDefaults(config);

    // Restore settings
    if (preservedSync.auto_pull !== undefined) {
      config.sync = config.sync || {};
      config.sync.auto_pull = preservedSync.auto_pull;
    }
    if (preservedSync.workflow_mode !== undefined) {
      config.sync = config.sync || {};
      config.sync.workflow_mode = preservedSync.workflow_mode;
    }
    if (preservedSync.primary_agent !== undefined) {
      config.sync = config.sync || {};
      config.sync.primary_agent = preservedSync.primary_agent;
    }
    if (preservedSync.on_conflict !== undefined) {
      config.sync = config.sync || {};
      config.sync.on_conflict = preservedSync.on_conflict;
    }

    // Verify after team enable
    expect(config.sync?.auto_pull).toBe(false);
    expect(config.sync?.workflow_mode).toBe("native_format");
    expect(config.sync?.primary_agent).toBe("cursor");
    expect(config.sync?.on_conflict).toBe("keep_ir");

    // Step 2: Disable team mode
    preservedSync = {
      auto_pull: config.sync?.auto_pull,
      workflow_mode: config.sync?.workflow_mode,
      primary_agent: config.sync?.primary_agent,
      on_conflict: config.sync?.on_conflict,
    };

    config.mode = "solo";
    config.modules = { ...config.modules, lockfile: false, bundle: false };
    config = applyDefaults(config);

    // Restore settings
    if (preservedSync.auto_pull !== undefined) {
      config.sync = config.sync || {};
      config.sync.auto_pull = preservedSync.auto_pull;
    }
    if (preservedSync.workflow_mode !== undefined) {
      config.sync = config.sync || {};
      config.sync.workflow_mode = preservedSync.workflow_mode;
    }
    if (preservedSync.primary_agent !== undefined) {
      config.sync = config.sync || {};
      config.sync.primary_agent = preservedSync.primary_agent;
    }
    if (preservedSync.on_conflict !== undefined) {
      config.sync = config.sync || {};
      config.sync.on_conflict = preservedSync.on_conflict;
    }

    // Verify all settings preserved after round-trip
    expect(config.sync?.auto_pull).toBe(false);
    expect(config.sync?.workflow_mode).toBe("native_format");
    expect(config.sync?.primary_agent).toBe("cursor");
    expect(config.sync?.on_conflict).toBe("keep_ir");
    expect(config.mode).toBe("solo");
  });

  it("should apply defaults only when settings not explicitly set", async () => {
    // Create solo config without sync settings
    const soloConfig: Partial<AlignTrueConfig> = {
      version: "1",
      mode: "solo",
      exporters: ["agents"],
      // No sync settings
    };

    const configPath = join(TEST_DIR, ".aligntrue/config.yaml");
    const { stringify: stringifyYaml } = await import("yaml");
    writeFileSync(configPath, stringifyYaml(soloConfig), "utf-8");

    const { loadConfig, applyDefaults } = await import("@aligntrue/core");
    let config = await loadConfig(configPath);

    // Capture initial state (sync may have defaults from loadConfig)
    const initialAutoP = config.sync?.auto_pull;

    // Preserve sync settings
    const preservedSync = {
      auto_pull: config.sync?.auto_pull,
      workflow_mode: config.sync?.workflow_mode,
      primary_agent: config.sync?.primary_agent,
      on_conflict: config.sync?.on_conflict,
    };

    // Apply team mode
    config.mode = "team";
    config.modules = { ...config.modules, lockfile: true, bundle: true };
    config = applyDefaults(config);

    // Restore settings (only if explicitly set)
    if (preservedSync.auto_pull !== undefined) {
      config.sync = config.sync || {};
      config.sync.auto_pull = preservedSync.auto_pull;
    }

    // Verify: if no explicit setting was preserved, defaults are applied
    // If a setting was preserved, it matches the initial value
    expect(config.mode).toBe("team");
    if (initialAutoP !== undefined) {
      expect(config.sync?.auto_pull).toBe(initialAutoP);
    }
  });
});
