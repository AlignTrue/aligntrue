import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import * as yaml from "yaml";
import {
  loadConfig,
  saveConfig,
  saveMinimalConfig,
  saveConfigAuto,
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

function _writeConfig(filename: string, content: string): string {
  const _path = join(TEST_DIR, filename);
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
      exporters: ["cursor", "agents"],
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
      sync: {},
      sources: [{ type: "local", path: ".aligntrue/rules" }],
      performance: {
        max_file_size_mb: 10,
        max_directory_depth: 10,
        ignore_patterns: [],
      },
      backup: {
        auto_backup: false,
        backup_on: ["sync"],
      },
    };

    await saveMinimalConfig(config, configPath, TEST_DIR);

    // Read back and verify only exporters are written
    const written = readFileSync(configPath, "utf8");
    const parsed = yaml.parse(written);

    expect(parsed).toEqual({
      exporters: ["cursor", "agents"],
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
      exporters: ["cursor", "agents"],
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
      sync: {},
      sources: [{ type: "local", path: ".aligntrue/rules" }],
      performance: {
        max_file_size_mb: 10,
        max_directory_depth: 10,
        ignore_patterns: [],
      },
      backup: {
        auto_backup: false,
        backup_on: ["sync"],
      },
    };

    await saveMinimalConfig(config, configPath, TEST_DIR);

    const written = readFileSync(configPath, "utf8");
    const parsed = yaml.parse(written);

    // Team mode should be preserved (not default)
    expect(parsed.mode).toBe("team");
    expect(parsed.exporters).toEqual(["cursor", "agents"]);
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
      sync: {},
      sources: [{ type: "local", path: ".aligntrue/rules" }],
      performance: {
        max_file_size_mb: 10,
        max_directory_depth: 10,
        ignore_patterns: [],
      },
      backup: {
        auto_backup: false,
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
      sync: {},
      sources: [{ type: "local", path: ".aligntrue/rules" }],
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
      exporters: ["cursor", "agents", "claude"],
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
      sync: {},
      sources: [{ type: "local", path: ".aligntrue/rules/*.md" }],
      performance: {
        max_file_size_mb: 10,
        max_directory_depth: 10,
        ignore_patterns: [],
      },
      backup: {
        auto_backup: false,
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
  });

  it("saveConfig writes all fields (team mode behavior)", async () => {
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    const config: AlignTrueConfig = {
      version: "1",
      mode: "team",
      exporters: ["cursor", "agents"],
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
        scope_prefixing: "auto",
      },
      sources: [{ type: "local", path: ".aligntrue/rules" }],
      performance: {
        max_file_size_mb: 10,
        max_directory_depth: 10,
        ignore_patterns: [],
      },
      backup: {
        auto_backup: false,
        backup_on: ["sync"],
      },
    };

    await saveConfig(config, configPath, TEST_DIR);

    const written = readFileSync(configPath, "utf8");
    const parsed = yaml.parse(written);

    // All fields should be present in full save
    expect(parsed.version).toBe("1");
    expect(parsed.mode).toBe("team");
    expect(parsed.exporters).toEqual(["cursor", "agents"]);
    expect(parsed.modules).toEqual({
      lockfile: true,
      bundle: true,
      checks: true,
      mcp: false,
    });
    expect(parsed.lockfile).toEqual({ mode: "soft" });
    expect(parsed.sync).toEqual({
      scope_prefixing: "auto",
    });
    expect(parsed.sources).toEqual([
      { type: "local", path: ".aligntrue/rules" },
    ]);
  });

  it("handles empty sync settings", async () => {
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
      sync: {},
      sources: [{ type: "local", path: ".aligntrue/rules" }],
      performance: {
        max_file_size_mb: 10,
        max_directory_depth: 10,
        ignore_patterns: [],
      },
      backup: {
        auto_backup: false,
        backup_on: ["sync"],
      },
    };

    await saveMinimalConfig(config, configPath, TEST_DIR);

    const written = readFileSync(configPath, "utf8");
    const parsed = yaml.parse(written);

    expect(parsed.exporters).toEqual(["cursor"]);
    // Empty sync object should be omitted
    expect(parsed.sync).toBeUndefined();
  });

  it("preserves non-default sync settings", async () => {
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
        source_markers: "always",
        content_mode: "inline",
        auto_manage_ignore_files: true,
        ignore_file_priority: "custom",
        custom_format_priority: { cursor: "mdc" },
        cleanup: "auto",
      },
      sources: [{ type: "local", path: ".aligntrue/rules" }],
      performance: {
        max_file_size_mb: 10,
        max_directory_depth: 10,
        ignore_patterns: [],
      },
      backup: {
        auto_backup: false,
        backup_on: ["sync"],
      },
    };

    await saveMinimalConfig(config, configPath, TEST_DIR);

    const written = readFileSync(configPath, "utf8");
    const parsed = yaml.parse(written);

    expect(parsed.exporters).toEqual(["cursor"]);
    // Sync section should preserve all non-default values
    expect(parsed.sync).toEqual({
      source_markers: "always",
      content_mode: "inline",
      auto_manage_ignore_files: true,
      ignore_file_priority: "custom",
      custom_format_priority: { cursor: "mdc" },
      cleanup: "auto",
    });
  });

  it("preserves remotes when present", async () => {
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    const config: AlignTrueConfig = {
      version: "1",
      mode: "solo",
      exporters: ["cursor", "agents"],
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
      sync: {},
      sources: [{ type: "local", path: ".aligntrue/rules" }],
      remotes: {
        personal: "https://github.com/user/rules-backup",
      },
      performance: {
        max_file_size_mb: 10,
        max_directory_depth: 10,
        ignore_patterns: [],
      },
      backup: {
        retention_days: 30,
        minimum_keep: 3,
      },
    };

    await saveMinimalConfig(config, configPath, TEST_DIR);

    const written = readFileSync(configPath, "utf8");
    const parsed = yaml.parse(written);

    expect(parsed.exporters).toEqual(["cursor", "agents"]);
    expect(parsed.remotes).toEqual({
      personal: "https://github.com/user/rules-backup",
    });
    // Default values should be omitted
    expect(parsed.mode).toBeUndefined();
    expect(parsed.version).toBeUndefined();
  });

  it("preserves plugs fills when present", async () => {
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
      sync: {},
      sources: [{ type: "local", path: ".aligntrue/rules" }],
      plugs: {
        fills: {
          "testing.framework": "vitest",
          "linter.command": "eslint",
        },
      },
      performance: {
        max_file_size_mb: 10,
        max_directory_depth: 10,
        ignore_patterns: [],
      },
      backup: {
        retention_days: 30,
        minimum_keep: 3,
      },
    };

    await saveMinimalConfig(config, configPath, TEST_DIR);

    const written = readFileSync(configPath, "utf8");
    const parsed = yaml.parse(written);

    expect(parsed.exporters).toEqual(["cursor"]);
    expect(parsed.plugs).toEqual({
      fills: {
        "testing.framework": "vitest",
        "linter.command": "eslint",
      },
    });
  });

  it("preserves mcp servers when present", async () => {
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
      sync: {},
      sources: [{ type: "local", path: ".aligntrue/rules" }],
      mcp: {
        servers: [
          {
            name: "test-server",
            command: "node",
            args: ["server.js"],
          },
        ],
      },
      performance: {
        max_file_size_mb: 10,
        max_directory_depth: 10,
        ignore_patterns: [],
      },
      backup: {
        retention_days: 30,
        minimum_keep: 3,
      },
    };

    await saveMinimalConfig(config, configPath, TEST_DIR);

    const written = readFileSync(configPath, "utf8");
    const parsed = yaml.parse(written);

    expect(parsed.exporters).toEqual(["cursor"]);
    expect(parsed.mcp).toEqual({
      servers: [
        {
          name: "test-server",
          command: "node",
          args: ["server.js"],
        },
      ],
    });
  });

  it("preserves git per_exporter when present", async () => {
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    const config: AlignTrueConfig = {
      version: "1",
      mode: "solo",
      exporters: ["cursor", "agents"],
      modules: {
        lockfile: false,
        bundle: false,
        checks: true,
        mcp: false,
      },
      lockfile: {
        mode: "off",
      },
      git: {
        mode: "ignore",
        per_exporter: {
          cursor: "commit",
          agents: "ignore",
        },
      },
      sync: {},
      sources: [{ type: "local", path: ".aligntrue/rules" }],
      performance: {
        max_file_size_mb: 10,
        max_directory_depth: 10,
        ignore_patterns: [],
      },
      backup: {
        retention_days: 30,
        minimum_keep: 3,
      },
    };

    await saveMinimalConfig(config, configPath, TEST_DIR);

    const written = readFileSync(configPath, "utf8");
    const parsed = yaml.parse(written);

    expect(parsed.exporters).toEqual(["cursor", "agents"]);
    // git.mode is "ignore" (default), so omitted, but per_exporter should be preserved
    expect(parsed.git).toEqual({
      per_exporter: {
        cursor: "commit",
        agents: "ignore",
      },
    });
  });
});

describe("saveConfigAuto", () => {
  it("uses saveMinimalConfig for solo mode", async () => {
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    const config: AlignTrueConfig = {
      version: "1",
      mode: "solo",
      exporters: ["cursor", "agents"],
      modules: {
        lockfile: false,
        bundle: false,
        checks: true,
        mcp: false,
      },
      lockfile: {
        mode: "off",
      },
      git: {
        mode: "ignore",
        branch_check_interval: 86400,
        tag_check_interval: 604800,
        offline_fallback: true,
        auto_gitignore: "auto",
      },
      sync: {},
      sources: [{ type: "local", path: ".aligntrue/rules" }],
      performance: {
        max_file_size_mb: 10,
        max_directory_depth: 10,
        ignore_patterns: [],
      },
      backup: {
        retention_days: 30,
        minimum_keep: 3,
      },
      detection: {
        auto_enable: false,
        ignored_agents: [],
      },
    };

    await saveConfigAuto(config, configPath, TEST_DIR);

    const written = readFileSync(configPath, "utf8");
    const parsed = yaml.parse(written);

    // Solo mode should result in minimal config (only exporters, no defaults)
    expect(parsed).toEqual({
      exporters: ["cursor", "agents"],
    });
    expect(parsed.mode).toBeUndefined();
    expect(parsed.git).toBeUndefined();
    expect(parsed.modules).toBeUndefined();
  });

  it("uses saveConfig for team mode", async () => {
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    const config: AlignTrueConfig = {
      version: "1",
      mode: "team",
      exporters: ["cursor", "agents"],
      modules: {
        lockfile: true,
        bundle: true,
        checks: true,
        mcp: false,
      },
      lockfile: {
        mode: "soft",
      },
      git: {
        mode: "ignore",
      },
      sync: {},
      sources: [{ type: "local", path: ".aligntrue/rules" }],
      performance: {
        max_file_size_mb: 10,
        max_directory_depth: 10,
        ignore_patterns: [],
      },
      backup: {
        retention_days: 30,
        minimum_keep: 3,
      },
    };

    await saveConfigAuto(config, configPath, TEST_DIR);

    const written = readFileSync(configPath, "utf8");
    const parsed = yaml.parse(written);

    // Team mode should result in full config with all fields
    expect(parsed.mode).toBe("team");
    expect(parsed.version).toBe("1");
    expect(parsed.modules).toEqual({
      lockfile: true,
      bundle: true,
      checks: true,
      mcp: false,
    });
    expect(parsed.lockfile).toEqual({ mode: "soft" });
    expect(parsed.git).toEqual({ mode: "ignore" });
  });
});
