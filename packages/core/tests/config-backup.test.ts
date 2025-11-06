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
    expect(config.backup?.auto_backup).toBe(true);
    expect(config.backup?.keep_count).toBe(5);
    expect(config.backup?.backup_on).toEqual(["sync", "import"]);
  });

  it("should accept custom backup configuration", async () => {
    const yaml = `
mode: solo
exporters: [cursor]
backup:
  auto_backup: true
  keep_count: 5
  backup_on: [sync, restore]
`;
    writeFileSync(configPath, yaml, "utf-8");

    const config = await loadConfig(configPath);

    expect(config.backup?.auto_backup).toBe(true);
    expect(config.backup?.keep_count).toBe(5);
    expect(config.backup?.backup_on).toEqual(["sync", "restore"]);
  });

  it("should validate backup_on enum values", async () => {
    const yaml = `
mode: solo
exporters: [cursor]
backup:
  backup_on: [sync, restore, import]
`;
    writeFileSync(configPath, yaml, "utf-8");

    const config = await loadConfig(configPath);

    expect(config.backup?.backup_on).toEqual(["sync", "restore", "import"]);
  });
});
