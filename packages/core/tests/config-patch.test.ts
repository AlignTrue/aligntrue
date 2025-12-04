/**
 * Tests for patchConfig - surgical config updates
 *
 * patchConfig preserves all existing config values except those explicitly updated.
 * This prevents data loss when CLI commands update specific fields.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import { patchConfig } from "../src/config/index.js";

const TEST_DIR = join(process.cwd(), "temp-patch-config-test");

describe("patchConfig", () => {
  beforeEach(() => {
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("preserves sources when adding remotes", async () => {
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");

    // Create initial config with sources
    writeFileSync(
      configPath,
      `sources:
  - type: local
    path: .aligntrue/rules
exporters:
  - cursor
  - agents
`,
      "utf8",
    );

    // Patch to add remotes
    await patchConfig(
      {
        remotes: {
          personal: "https://github.com/user/rules",
        },
      },
      configPath,
    );

    // Verify sources are preserved
    const result = parseYaml(readFileSync(configPath, "utf8"));
    expect(result.sources).toEqual([
      { type: "local", path: ".aligntrue/rules" },
    ]);
    expect(result.exporters).toEqual(["cursor", "agents"]);
    expect(result.remotes).toEqual({
      personal: "https://github.com/user/rules",
    });
  });

  it("preserves remotes when adding sources", async () => {
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");

    // Create initial config with remotes
    writeFileSync(
      configPath,
      `exporters:
  - cursor
remotes:
  personal: https://github.com/user/private-rules
`,
      "utf8",
    );

    // Patch to add sources
    await patchConfig(
      {
        sources: [
          { type: "local", path: ".aligntrue/rules" },
          { type: "git", url: "https://github.com/org/rules" },
        ],
      },
      configPath,
    );

    // Verify remotes are preserved
    const result = parseYaml(readFileSync(configPath, "utf8"));
    expect(result.remotes).toEqual({
      personal: "https://github.com/user/private-rules",
    });
    expect(result.sources).toEqual([
      { type: "local", path: ".aligntrue/rules" },
      { type: "git", url: "https://github.com/org/rules" },
    ]);
  });

  it("preserves unrelated fields when updating exporters", async () => {
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");

    // Create config with multiple fields
    writeFileSync(
      configPath,
      `sources:
  - type: local
    path: .aligntrue/rules
exporters:
  - cursor
scopes:
  - path: packages/frontend
    include:
      - "*.tsx"
plugs:
  fills:
    test.cmd: pnpm test
`,
      "utf8",
    );

    // Patch to update exporters
    await patchConfig(
      {
        exporters: ["cursor", "claude", "agents"],
      },
      configPath,
    );

    // Verify all other fields are preserved
    const result = parseYaml(readFileSync(configPath, "utf8"));
    expect(result.sources).toEqual([
      { type: "local", path: ".aligntrue/rules" },
    ]);
    expect(result.exporters).toEqual(["cursor", "claude", "agents"]);
    expect(result.scopes).toEqual([
      { path: "packages/frontend", include: ["*.tsx"] },
    ]);
    expect(result.plugs).toEqual({ fills: { "test.cmd": "pnpm test" } });
  });

  it("deep merges nested objects", async () => {
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");

    // Create config with detection settings
    writeFileSync(
      configPath,
      `exporters:
  - cursor
detection:
  auto_enable: true
  ignored_agents:
    - windsurf
`,
      "utf8",
    );

    // Patch to add more ignored agents
    await patchConfig(
      {
        detection: {
          ignored_agents: ["windsurf", "copilot"],
        },
      },
      configPath,
    );

    // Verify detection.auto_enable is preserved
    const result = parseYaml(readFileSync(configPath, "utf8"));
    expect(result.detection.auto_enable).toBe(true);
    expect(result.detection.ignored_agents).toEqual(["windsurf", "copilot"]);
  });

  it("replaces arrays entirely (not merged)", async () => {
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");

    // Create config with sources array
    writeFileSync(
      configPath,
      `sources:
  - type: local
    path: .aligntrue/rules
  - type: git
    url: https://github.com/old/rules
exporters:
  - cursor
`,
      "utf8",
    );

    // Patch with new sources array
    await patchConfig(
      {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
      },
      configPath,
    );

    // Verify sources is replaced, not merged
    const result = parseYaml(readFileSync(configPath, "utf8"));
    expect(result.sources).toEqual([
      { type: "local", path: ".aligntrue/rules" },
    ]);
  });

  it("creates config file if it does not exist", async () => {
    const configPath = join(TEST_DIR, ".aligntrue", "new-config.yaml");

    // Patch non-existent file
    await patchConfig(
      {
        exporters: ["cursor"],
        remotes: { personal: "https://github.com/user/rules" },
      },
      configPath,
    );

    // Verify file was created with correct content
    const result = parseYaml(readFileSync(configPath, "utf8"));
    expect(result.exporters).toEqual(["cursor"]);
    expect(result.remotes).toEqual({
      personal: "https://github.com/user/rules",
    });
  });

  it("handles undefined values by not modifying those keys", async () => {
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");

    // Create initial config
    writeFileSync(
      configPath,
      `exporters:
  - cursor
sources:
  - type: local
    path: .aligntrue/rules
`,
      "utf8",
    );

    // Patch with undefined sources (should not delete)
    await patchConfig(
      {
        exporters: ["cursor", "claude"],
        sources: undefined,
      },
      configPath,
    );

    // Verify sources is preserved
    const result = parseYaml(readFileSync(configPath, "utf8"));
    expect(result.sources).toEqual([
      { type: "local", path: ".aligntrue/rules" },
    ]);
    expect(result.exporters).toEqual(["cursor", "claude"]);
  });

  it("deletes keys when value is null", async () => {
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");

    // Create config with plugs
    writeFileSync(
      configPath,
      `exporters:
  - cursor
plugs:
  fills:
    test.cmd: pnpm test
`,
      "utf8",
    );

    // Patch with null plugs (should delete)
    await patchConfig(
      {
        plugs: null as unknown as undefined,
      },
      configPath,
    );

    // Verify plugs is removed entirely
    const result = parseYaml(readFileSync(configPath, "utf8"));
    expect(result.plugs).toBeUndefined();
    expect(result.exporters).toEqual(["cursor"]);
  });

  it("deletes nested keys when value is null", async () => {
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");

    // Create config with multiple fills
    writeFileSync(
      configPath,
      `exporters:
  - cursor
plugs:
  fills:
    test.cmd: pnpm test
    other.value: keep me
`,
      "utf8",
    );

    // Delete just test.cmd by setting it to null
    await patchConfig(
      {
        plugs: {
          fills: {
            "test.cmd": null as unknown as string,
          },
        },
      },
      configPath,
    );

    // Verify only test.cmd is removed
    const result = parseYaml(readFileSync(configPath, "utf8"));
    expect(result.plugs.fills["test.cmd"]).toBeUndefined();
    expect(result.plugs.fills["other.value"]).toBe("keep me");
  });

  it("regression: add remote command preserves sources", async () => {
    // This is the exact scenario that triggered the bug
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");

    // User's original config (what they explicitly wrote)
    writeFileSync(
      configPath,
      `sources:
  - type: local
    path: .aligntrue/rules
exporters:
  - cursor
  - agents
  - claude
`,
      "utf8",
    );

    // Simulate what "aligntrue add remote" does
    await patchConfig(
      {
        remotes: {
          personal: "https://github.com/gmays/aligntrue-private-rules",
        },
      },
      configPath,
    );

    // Verify sources were NOT deleted
    const result = parseYaml(readFileSync(configPath, "utf8"));
    expect(result.sources).toEqual([
      { type: "local", path: ".aligntrue/rules" },
    ]);
    expect(result.exporters).toEqual(["cursor", "agents", "claude"]);
    expect(result.remotes).toEqual({
      personal: "https://github.com/gmays/aligntrue-private-rules",
    });
  });
});
