import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../src/config/index";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";

describe("Config - Backup Configuration", () => {
  const testDir = join(__dirname, "..", "..", "temp-config-backup-test");
  const aligntrueDir = join(testDir, ".aligntrue");
  const configPath = join(aligntrueDir, "config.yaml");

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(aligntrueDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should apply default backup config when not specified", async () => {
    writeFileSync(configPath, "mode: solo\nexporters: [cursor]", "utf-8");

    const config = await loadConfig(configPath);

    expect(config.backup).toBeDefined();
    expect(config.backup?.retention_days).toBe(30); // New default
    expect(config.backup?.minimum_keep).toBe(3); // New default
    expect(config.backup?.keep_count).toBe(20); // Old default still applied for migration
  });

  it("should accept custom keep_count", async () => {
    const yaml = `
mode: solo
exporters: [cursor]
backup:
  keep_count: 30
`;
    writeFileSync(configPath, yaml, "utf-8");

    const config = await loadConfig(configPath);

    expect(config.backup?.keep_count).toBe(30);
  });

  it("should reject keep_count below minimum of 10", async () => {
    const yaml = `
mode: solo
exporters: [cursor]
backup:
  keep_count: 5
`;
    writeFileSync(configPath, yaml, "utf-8");

    // Schema validation should reject invalid keep_count
    await expect(loadConfig(configPath)).rejects.toThrow(
      /backup\.keep_count: must be >= 10/,
    );
  });

  it("should reject keep_count above maximum of 100", async () => {
    const yaml = `
mode: solo
exporters: [cursor]
backup:
  keep_count: 150
`;
    writeFileSync(configPath, yaml, "utf-8");

    // Schema validation should reject invalid keep_count
    await expect(loadConfig(configPath)).rejects.toThrow(
      /backup\.keep_count: must be <= 100/,
    );
  });

  it("should accept keep_count at minimum boundary (10)", async () => {
    const yaml = `
mode: solo
exporters: [cursor]
backup:
  keep_count: 10
`;
    writeFileSync(configPath, yaml, "utf-8");

    const config = await loadConfig(configPath);

    expect(config.backup?.keep_count).toBe(10);
  });

  it("should accept keep_count at maximum boundary (100)", async () => {
    const yaml = `
mode: solo
exporters: [cursor]
backup:
  keep_count: 100
`;
    writeFileSync(configPath, yaml, "utf-8");

    const config = await loadConfig(configPath);

    expect(config.backup?.keep_count).toBe(100);
  });

  it("should apply new retention_days default", async () => {
    writeFileSync(configPath, "mode: solo\nexporters: [cursor]", "utf-8");

    const config = await loadConfig(configPath);

    expect(config.backup?.retention_days).toBe(30);
  });

  it("should accept custom retention_days", async () => {
    const yaml = `
mode: solo
exporters: [cursor]
backup:
  retention_days: 60
`;
    writeFileSync(configPath, yaml, "utf-8");

    const config = await loadConfig(configPath);

    expect(config.backup?.retention_days).toBe(60);
  });

  it("should accept retention_days: 0 for manual cleanup", async () => {
    const yaml = `
mode: solo
exporters: [cursor]
backup:
  retention_days: 0
`;
    writeFileSync(configPath, yaml, "utf-8");

    const config = await loadConfig(configPath);

    expect(config.backup?.retention_days).toBe(0);
  });

  it("should apply minimum_keep default", async () => {
    writeFileSync(configPath, "mode: solo\nexporters: [cursor]", "utf-8");

    const config = await loadConfig(configPath);

    expect(config.backup?.minimum_keep).toBe(3);
  });

  it("should accept custom minimum_keep", async () => {
    const yaml = `
mode: solo
exporters: [cursor]
backup:
  minimum_keep: 5
`;
    writeFileSync(configPath, yaml, "utf-8");

    const config = await loadConfig(configPath);

    expect(config.backup?.minimum_keep).toBe(5);
  });

  it("should enforce minimum_keep minimum boundary", async () => {
    const yaml = `
mode: solo
exporters: [cursor]
backup:
  minimum_keep: 0
`;
    writeFileSync(configPath, yaml, "utf-8");

    // Schema validation should reject invalid minimum_keep (must be >= 1)
    await expect(loadConfig(configPath)).rejects.toThrow(
      /backup\.minimum_keep: must be >= 1/,
    );
  });

  it("should handle migration from keep_count to retention_days", async () => {
    const yaml = `
mode: solo
exporters: [cursor]
backup:
  keep_count: 50
`;
    writeFileSync(configPath, yaml, "utf-8");

    const config = await loadConfig(configPath);

    // New retention_days should apply even when old keep_count is set
    expect(config.backup?.retention_days).toBe(30);
    expect(config.backup?.keep_count).toBe(50); // Old value kept for compatibility
  });

  it("should prefer retention_days over keep_count if both specified", async () => {
    const yaml = `
mode: solo
exporters: [cursor]
backup:
  keep_count: 50
  retention_days: 45
`;
    writeFileSync(configPath, yaml, "utf-8");

    const config = await loadConfig(configPath);

    expect(config.backup?.retention_days).toBe(45);
    expect(config.backup?.keep_count).toBe(50);
  });
});
