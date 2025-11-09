import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { loadIR } from "../../src/sync/ir-loader.js";

describe("IR Loader - Performance Guardrails", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `aligntrue-ir-loader-perf-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  const validYaml = `
id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.example.rule
    severity: warn
    applies_to: ["**/*.ts"]
    guidance: Test rule
`;

  it("loads file under size limit successfully", async () => {
    const filePath = join(testDir, "rules.yaml");
    writeFileSync(filePath, validYaml, "utf-8");

    const ir = await loadIR(filePath, { mode: "solo", maxFileSizeMb: 10 });
    expect(ir.id).toBe("test-pack");
  });

  it("warns in solo mode when file exceeds limit", async () => {
    const filePath = join(testDir, "large.yaml");
    // Create 11MB file with valid YAML
    const largeContent = validYaml + "\n# ".repeat(11 * 1024 * 512); // ~11MB of comments
    writeFileSync(filePath, largeContent, "utf-8");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Should load successfully with warning
    await loadIR(filePath, { mode: "solo", maxFileSizeMb: 10 });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("File exceeds size limit"),
    );

    warnSpy.mockRestore();
  }, 30000); // 30s timeout for large file parsing in CI

  it("throws error in team mode when file exceeds limit", async () => {
    const filePath = join(testDir, "large.yaml");
    // Create 11MB file
    const largeContent = validYaml + "\n# ".repeat(11 * 1024 * 512);
    writeFileSync(filePath, largeContent, "utf-8");

    await expect(
      loadIR(filePath, { mode: "team", maxFileSizeMb: 10 }),
    ).rejects.toThrow("File exceeds size limit");
    await expect(
      loadIR(filePath, { mode: "team", maxFileSizeMb: 10 }),
    ).rejects.toThrow("Use --force to override");
  });

  it("bypasses size check with force flag in team mode", async () => {
    const filePath = join(testDir, "large.yaml");
    // Create 11MB file
    const largeContent = validYaml + "\n# ".repeat(11 * 1024 * 512);
    writeFileSync(filePath, largeContent, "utf-8");

    // Should load successfully with force
    const ir = await loadIR(filePath, {
      mode: "team",
      maxFileSizeMb: 10,
      force: true,
    });
    expect(ir.id).toBe("test-pack");
  }, 30000); // 30s timeout for large file parsing in CI

  it("uses default values when options not provided", async () => {
    const filePath = join(testDir, "rules.yaml");
    writeFileSync(filePath, validYaml, "utf-8");

    // Should load with defaults (solo mode, 10MB limit, force: false)
    const ir = await loadIR(filePath);
    expect(ir.id).toBe("test-pack");
  });

  it("respects custom max file size", async () => {
    const filePath = join(testDir, "medium.yaml");
    // Create 2MB file
    const mediumContent = validYaml + "\n# ".repeat(2 * 1024 * 512);
    writeFileSync(filePath, mediumContent, "utf-8");

    // Should fail with 1MB limit
    await expect(
      loadIR(filePath, { mode: "team", maxFileSizeMb: 1 }),
    ).rejects.toThrow("File exceeds size limit");

    // Should pass with 5MB limit (well above the 3MB actual size)
    const ir = await loadIR(filePath, { mode: "team", maxFileSizeMb: 5 });
    expect(ir.id).toBe("test-pack");
  });

  it("checks YAML files for size", async () => {
    const filePath = join(testDir, "rules.yaml");
    const validYaml = `id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.example.rule
    severity: warn
    applies_to: ["**/*.ts"]
    guidance: Test rule
`;
    writeFileSync(filePath, validYaml, "utf-8");

    const ir = await loadIR(filePath, { mode: "solo", maxFileSizeMb: 10 });
    expect(ir.id).toBe("test-pack");
  });

  it("checks YAML files for size limit exceeds", async () => {
    const filePath = join(testDir, "large.yaml");
    const validYaml = `id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.example.rule
    severity: warn
    applies_to: ["**/*.ts"]
    guidance: Test rule
`;
    // Create 11MB file with YAML
    const largeContent = validYaml + "\n# ".repeat(11 * 1024 * 512);
    writeFileSync(filePath, largeContent, "utf-8");

    await expect(
      loadIR(filePath, { mode: "team", maxFileSizeMb: 10 }),
    ).rejects.toThrow("File exceeds size limit");
  });
});
