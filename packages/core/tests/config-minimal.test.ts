import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import * as yaml from "yaml";
import {
  loadConfig,
  applyDefaults,
  saveConfig,
  saveMinimalConfig,
  type AlignTrueConfig,
} from "../src/config/index.js";

const TEST_DIR = join(process.cwd(), "temp-minimal-config-test");

beforeEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

function writeConfig(filename: string, content: string): string {
  const path = join(TEST_DIR, filename);
  mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
  const fullPath = join(TEST_DIR, ".aligntrue", filename);
  writeFileSync(fullPath, content, "utf8");
  return fullPath;
}

describe("saveMinimalConfig", () => {
  it("saves only exporters for minimal solo config", async () => {
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    const config: AlignTrueConfig = {
      version: "1",
      mode: "solo",
      exporters: ["cursor", "agents-md"],
      modules: {
        lockfile: false,
        bundle: false,
        checks: true,
        mcp: false,
      },
      lockfile: {
        mode: "off",
      },
      git: {},
      sync: {
        auto_pull: true,
        on_conflict: "accept_agent",
      },
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
      performance: {
        max_file_size_mb: 10,
        max_directory_depth: 10,
        ignore_patterns: [],
      },
      backup: {
        auto_backup: false,
        keep_count: 10,
        backup_on: ["sync"],
      },
    };

    await saveMinimalConfig(config, configPath, TEST_DIR);

    // Read back and verify only exporters are written
    const written = readFileSync(configPath, "utf8");
    const parsed = yaml.parse(written);

    expect(parsed).toEqual({
      exporters: ["cursor", "agents-md"],
    });

    // Verify no other fields present
    expect(parsed.mode).toBeUndefined();
    expect(parsed.version).toBeUndefined();
    expect(parsed.modules).toBeUndefined();
    expect(parsed.lockfile).toBeUndefined();
    expect(parsed.git).toBeUndefined();
    expect(parsed.sync).toBeUndefined();
    expect(parsed.sources).toBeUndefined();
    expect(parsed.performance).toBeUndefined();
    expect(parsed.backup).toBeUndefined();
  });

  it("preserves non-default mode in minimal save", async () => {
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    const config: AlignTrueConfig = {
      version: "1",
      mode: "team",
      exporters: ["cursor", "agents-md"],
      modules: {
        lockfile: true,
        bundle: true,
        checks: true,
        mcp: false,
      },
      lockfile: {
        mode: "soft",
      },
      git: {},
      sync: {
        auto_pull: false,
        on_conflict: "prompt",
      },
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
      performance: {
        max_file_size_mb: 10,
        max_directory_depth: 10,
        ignore_patterns: [],
      },
      backup: {
        auto_backup: false,
        keep_count: 10,
        backup_on: ["sync"],
      },
    };

    await saveMinimalConfig(config, configPath, TEST_DIR);

    const written = readFileSync(configPath, "utf8");
    const parsed = yaml.parse(written);

    // Team mode should be preserved (not default)
    expect(parsed.mode).toBe("team");
    expect(parsed.exporters).toEqual(["cursor", "agents-md"]);
  });

  it("preserves non-default module values", async () => {
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    const config: AlignTrueConfig = {
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      modules: {
        lockfile: true, // Non-default for solo
        bundle: false,
        checks: false, // Non-default
        mcp: true, // Non-default
      },
      lockfile: {
        mode: "off",
      },
      git: {},
      sync: {
        auto_pull: true,
        on_conflict: "accept_agent",
      },
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
      performance: {
        max_file_size_mb: 10,
        max_directory_depth: 10,
        ignore_patterns: [],
      },
      backup: {
        auto_backup: false,
        keep_count: 10,
        backup_on: ["sync"],
      },
    };

    await saveMinimalConfig(config, configPath, TEST_DIR);

    const written = readFileSync(configPath, "utf8");
    const parsed = yaml.parse(written);

    expect(parsed.exporters).toEqual(["cursor"]);
    expect(parsed.modules).toEqual({
      lockfile: true,
      checks: false,
      mcp: true,
    });
    // bundle: false is default for solo, so omitted
  });

  it("preserves scopes and overlays when present", async () => {
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    const config: AlignTrueConfig = {
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      modules: {
        lockfile: false,
        bundle: false,
        checks: true,
        mcp: false,
      },
      lockfile: {
        mode: "off",
      },
      git: {},
      sync: {
        auto_pull: true,
        on_conflict: "accept_agent",
      },
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
      scopes: [
        {
          path: "packages/frontend",
          include: ["*.ts", "*.tsx"],
          exclude: ["**/*.test.ts"],
        },
      ],
      overlays: [
        {
          selector: "rule[id=test-rule]",
          operations: [{ set: { severity: "error" } }],
        },
      ],
      performance: {
        max_file_size_mb: 10,
        max_directory_depth: 10,
        ignore_patterns: [],
      },
      backup: {
        auto_backup: false,
        keep_count: 10,
        backup_on: ["sync"],
      },
    };

    await saveMinimalConfig(config, configPath, TEST_DIR);

    const written = readFileSync(configPath, "utf8");
    const parsed = yaml.parse(written);

    expect(parsed.exporters).toEqual(["cursor"]);
    expect(parsed.scopes).toEqual([
      {
        path: "packages/frontend",
        include: ["*.ts", "*.tsx"],
        exclude: ["**/*.test.ts"],
      },
    ]);
    expect(parsed.overlays).toEqual([
      {
        selector: "rule[id=test-rule]",
        operations: [{ set: { severity: "error" } }],
      },
    ]);
  });

  it("roundtrip: load(saveMinimal(config)) preserves semantics", async () => {
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    // Start with a config that has some non-default values
    const originalConfig: AlignTrueConfig = {
      version: "1",
      mode: "solo",
      exporters: ["cursor", "agents-md", "claude-md"],
      modules: {
        lockfile: false,
        bundle: false,
        checks: false, // Non-default
        mcp: false,
      },
      lockfile: {
        mode: "off",
      },
      git: {},
      sync: {
        auto_pull: true, // Default for solo
        on_conflict: "prompt", // Non-default for solo
      },
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
      performance: {
        max_file_size_mb: 10,
        max_directory_depth: 10,
        ignore_patterns: [],
      },
      backup: {
        auto_backup: false,
        keep_count: 10,
        backup_on: ["sync"],
      },
    };

    // Save with minimal
    await saveMinimalConfig(originalConfig, configPath, TEST_DIR);

    // Load back and apply defaults
    const loaded = await loadConfig(configPath, TEST_DIR);

    // Should be semantically equivalent after applying defaults
    expect(loaded.exporters).toEqual(originalConfig.exporters);
    expect(loaded.mode).toBe(originalConfig.mode);
    expect(loaded.version).toBe(originalConfig.version);
    expect(loaded.modules).toEqual(originalConfig.modules);
    expect(loaded.lockfile?.mode).toBe(originalConfig.lockfile?.mode);
    expect(loaded.sync?.auto_pull).toBe(originalConfig.sync?.auto_pull);
    expect(loaded.sync?.on_conflict).toBe(originalConfig.sync?.on_conflict);
  });

  it("saveConfig writes all fields (team mode behavior)", async () => {
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    const config: AlignTrueConfig = {
      version: "1",
      mode: "team",
      exporters: ["cursor", "agents-md"],
      modules: {
        lockfile: true,
        bundle: true,
        checks: true,
        mcp: false,
      },
      lockfile: {
        mode: "soft",
      },
      git: {},
      sync: {
        auto_pull: false,
        on_conflict: "prompt",
      },
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
      performance: {
        max_file_size_mb: 10,
        max_directory_depth: 10,
        ignore_patterns: [],
      },
      backup: {
        auto_backup: false,
        keep_count: 10,
        backup_on: ["sync"],
      },
    };

    await saveConfig(config, configPath, TEST_DIR);

    const written = readFileSync(configPath, "utf8");
    const parsed = yaml.parse(written);

    // All fields should be present in full save
    expect(parsed.version).toBe("1");
    expect(parsed.mode).toBe("team");
    expect(parsed.exporters).toEqual(["cursor", "agents-md"]);
    expect(parsed.modules).toEqual({
      lockfile: true,
      bundle: true,
      checks: true,
      mcp: false,
    });
    expect(parsed.lockfile).toEqual({ mode: "soft" });
    expect(parsed.sync).toEqual({
      auto_pull: false,
      on_conflict: "prompt",
    });
    expect(parsed.sources).toEqual([
      { type: "local", path: ".aligntrue/rules.md" },
    ]);
  });

  it("handles non-default sync settings", async () => {
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    const config: AlignTrueConfig = {
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      modules: {
        lockfile: false,
        bundle: false,
        checks: true,
        mcp: false,
      },
      lockfile: {
        mode: "off",
      },
      git: {},
      sync: {
        auto_pull: false, // Non-default for solo
        on_conflict: "prompt", // Non-default for solo
      },
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
      performance: {
        max_file_size_mb: 10,
        max_directory_depth: 10,
        ignore_patterns: [],
      },
      backup: {
        auto_backup: false,
        keep_count: 10,
        backup_on: ["sync"],
      },
    };

    await saveMinimalConfig(config, configPath, TEST_DIR);

    const written = readFileSync(configPath, "utf8");
    const parsed = yaml.parse(written);

    expect(parsed.exporters).toEqual(["cursor"]);
    expect(parsed.sync).toEqual({
      auto_pull: false,
      on_conflict: "prompt",
    });
  });
});
