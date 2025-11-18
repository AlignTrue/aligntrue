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
    expect(config.backup?.keep_count).toBe(20);
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
});
