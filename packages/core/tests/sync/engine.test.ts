/**
 * Tests for sync engine
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join, dirname } from "path";
import { SyncEngine } from "../../src/sync/engine.js";
import { MockExporter } from "../mocks/mock-exporter.js";
import { FailingExporter } from "../mocks/failing-exporter.js";

const TEST_DIR = join(process.cwd(), "packages/core/tests/sync/temp-engine");
const CONFIG_DIR = join(TEST_DIR, ".aligntrue");

describe("SyncEngine", () => {
  let engine: SyncEngine;

  beforeEach(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }

    engine = new SyncEngine();
  });

  afterEach(() => {
    engine.clear();

    // Clean up test files
    if (existsSync(TEST_DIR)) {
      try {
        rmSync(TEST_DIR, { recursive: true, force: true });
      } catch {
        // Ignore errors
      }
    }
  });

  describe("registerExporter", () => {
    it("registers an exporter plugin", () => {
      const exporter = new MockExporter("test-exporter");

      engine.registerExporter(exporter);

      // Exporter should be available for sync operations
      expect(() => engine.registerExporter(exporter)).not.toThrow();
    });

    it("allows multiple exporters", () => {
      const exporter1 = new MockExporter("exporter1");
      const exporter2 = new MockExporter("exporter2");

      engine.registerExporter(exporter1);
      engine.registerExporter(exporter2);

      // Both should be registered
      expect(() => engine.registerExporter(exporter1)).not.toThrow();
      expect(() => engine.registerExporter(exporter2)).not.toThrow();
    });
  });

  describe("loadConfiguration", () => {
    it("loads config from default path", async () => {
      const config = `version: "1"
mode: solo
exporters:
  - cursor
`;
      const configPath = join(CONFIG_DIR, "config.yaml");
      writeFileSync(configPath, config, "utf8");

      await expect(engine.loadConfiguration(configPath)).resolves.not.toThrow();
    });

    it("fails on missing config", async () => {
      const configPath = join(CONFIG_DIR, "nonexistent.yaml");

      await expect(engine.loadConfiguration(configPath)).rejects.toThrow(
        /not found/,
      );
    });

    it("fails on invalid config", async () => {
      const config = `version: "1"
mode: invalid_mode
`;
      const configPath = join(CONFIG_DIR, "config.yaml");
      writeFileSync(configPath, config, "utf8");

      await expect(engine.loadConfiguration(configPath)).rejects.toThrow();
    });
  });

  describe("loadIRFromSource", () => {
    it("loads IR from markdown", async () => {
      // Setup config first
      const config = `version: "1"
mode: solo
exporters:
  - cursor
`;
      const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
      mkdirSync(dirname(configPath), { recursive: true });
      writeFileSync(configPath, config, "utf8");

      await engine.loadConfiguration(configPath);

      const yaml = `id: test-pack
version: 1.0.0
spec_version: "1"
sections:
  - heading: Example Rule
    level: 2
    content: This is a test rule for TypeScript files.
    fingerprint: example-rule
`;
      const irPath = join(TEST_DIR, "rules.yaml");
      writeFileSync(irPath, yaml, "utf8");

      await expect(engine.loadIRFromSource(irPath)).resolves.not.toThrow();
    });

    it("loads IR from YAML", async () => {
      // Setup config first
      const config = `version: "1"
mode: solo
exporters:
  - cursor
`;
      const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
      mkdirSync(dirname(configPath), { recursive: true });
      writeFileSync(configPath, config, "utf8");

      await engine.loadConfiguration(configPath);

      const yaml = `id: test-pack
version: 1.0.0
spec_version: "1"
sections:
  - heading: Example Rule
    level: 2
    content: This is a test rule for TypeScript files.
    fingerprint: example-rule
`;
      const irPath = join(TEST_DIR, "rules.yaml");
      writeFileSync(irPath, yaml, "utf8");

      await expect(engine.loadIRFromSource(irPath)).resolves.not.toThrow();
    });

    it("does not warn about plugs filled in config", async () => {
      // Setup config with plug fills
      const config = `version: "1"
mode: solo
exporters:
  - test-exporter
plugs:
  fills:
    test.cmd: npm test
`;
      const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
      mkdirSync(dirname(configPath), { recursive: true });
      writeFileSync(configPath, config, "utf8");

      await engine.loadConfiguration(configPath);

      // Setup IR with plug slots
      const yaml = `id: test-pack
version: 1.0.0
spec_version: "1"
plugs:
  slots:
    test.cmd:
      description: "Command to run tests"
      format: command
      required: true
      example: "pytest -q"
sections:
  - heading: Testing Guidelines
    level: 2
    content: "Run tests with: [[plug:test.cmd]]"
    fingerprint: testing-guidelines
`;
      const irPath = join(TEST_DIR, "rules.yaml");
      writeFileSync(irPath, yaml, "utf8");

      // Pass config fills when loading IR
      const result = await engine.loadIRFromSource(irPath, false, false, {
        "test.cmd": "npm test",
      });

      expect(result.success).toBe(true);
      // Should not warn about unresolved plugs since they're filled
      expect(result.warnings).toEqual(undefined);
    });
  });

  describe("syncToAgents", () => {
    it("syncs IR to agents successfully", async () => {
      // Setup
      const config = `version: "1"
mode: solo
exporters:
  - test-exporter
`;
      const yaml = `id: test-pack
version: 1.0.0
spec_version: "1"
sections:
  - heading: Example Rule
    level: 2
    content: This is a test rule for TypeScript files.
    fingerprint: example-rule
`;
      const configPath = join(CONFIG_DIR, "config.yaml");
      const irPath = join(TEST_DIR, "rules.yaml");
      writeFileSync(configPath, config, "utf8");
      writeFileSync(irPath, yaml, "utf8");

      const mockExporter = new MockExporter("test-exporter").setFilesToWrite([
        join(TEST_DIR, "output.txt"),
      ]);
      engine.registerExporter(mockExporter);

      // Execute
      const result = await engine.syncToAgents(irPath, {
        configPath,
        dryRun: true, // Don't actually write files
      });

      // Verify
      expect(result.success).toBe(true);
      expect(mockExporter.getCallCount()).toBe(1);
      expect(mockExporter.lastRequest).toBeDefined();
    });

    it("supports dry-run mode", async () => {
      // Setup
      const config = `version: "1"
mode: solo
exporters:
  - test-exporter
`;
      const yaml = `id: test-pack
version: 1.0.0
spec_version: "1"
sections:
  - heading: Example Rule
    level: 2
    content: This is a test rule for TypeScript files.
    fingerprint: example-rule
`;
      const configPath = join(CONFIG_DIR, "config.yaml");
      const irPath = join(TEST_DIR, "rules.yaml");
      writeFileSync(configPath, config, "utf8");
      writeFileSync(irPath, yaml, "utf8");

      const mockExporter = new MockExporter("test-exporter").setFilesToWrite([
        join(TEST_DIR, "output.txt"),
      ]);
      engine.registerExporter(mockExporter);

      // Execute with dry-run
      const result = await engine.syncToAgents(irPath, {
        configPath,
        dryRun: true,
      });

      // Verify exporter was called with dryRun option
      expect(result.success).toBe(true);
      expect(mockExporter.lastOptions?.dryRun).toBe(true);
    });

    it("calls multiple exporters", async () => {
      // Setup
      const config = `version: "1"
mode: solo
exporters:
  - exporter1
  - exporter2
`;
      const yaml = `id: test-pack
version: 1.0.0
spec_version: "1"
sections:
  - heading: Example Rule
    level: 2
    content: This is a test rule for TypeScript files.
    fingerprint: example-rule
`;
      const configPath = join(CONFIG_DIR, "config.yaml");
      const irPath = join(TEST_DIR, "rules.yaml");
      writeFileSync(configPath, config, "utf8");
      writeFileSync(irPath, yaml, "utf8");

      const exporter1 = new MockExporter("exporter1");
      const exporter2 = new MockExporter("exporter2");
      engine.registerExporter(exporter1);
      engine.registerExporter(exporter2);

      // Execute
      const result = await engine.syncToAgents(irPath, {
        configPath,
        dryRun: true,
      });

      // Verify both were called
      expect(result.success).toBe(true);
      expect(exporter1.getCallCount()).toBe(1);
      expect(exporter2.getCallCount()).toBe(1);
    });

    it("applies scope resolution", async () => {
      // Setup with scopes
      const config = `version: "1"
mode: solo
exporters:
  - test-exporter
scopes:
  - path: apps/web
    include:
      - "**/*.ts"
`;
      const yaml = `id: test-pack
version: 1.0.0
spec_version: "1"
sections:
  - heading: Example Rule
    level: 2
    content: This is a test rule for TypeScript files.
    fingerprint: example-rule
`;
      const configPath = join(CONFIG_DIR, "config.yaml");
      const irPath = join(TEST_DIR, "rules.yaml");
      writeFileSync(configPath, config, "utf8");
      writeFileSync(irPath, yaml, "utf8");

      const mockExporter = new MockExporter("test-exporter");
      engine.registerExporter(mockExporter);

      // Execute
      const result = await engine.syncToAgents(irPath, {
        configPath,
        dryRun: true,
      });

      // Verify scope was passed to exporter
      expect(result.success).toBe(true);
      expect(mockExporter.lastRequest?.scope.path).toBe("apps/web");
    });

    it("warns when exporter not found", async () => {
      // Setup
      const config = `version: "1"
mode: solo
exporters:
  - missing-exporter
  - test-exporter
`;
      const yaml = `id: test-pack
version: 1.0.0
spec_version: "1"
sections:
  - heading: Example Rule
    level: 2
    content: This is a test rule for TypeScript files.
    fingerprint: example-rule
`;
      const configPath = join(CONFIG_DIR, "config.yaml");
      const irPath = join(TEST_DIR, "rules.yaml");
      writeFileSync(configPath, config, "utf8");
      writeFileSync(irPath, yaml, "utf8");

      const mockExporter = new MockExporter("test-exporter");
      engine.registerExporter(mockExporter);

      // Execute
      const result = await engine.syncToAgents(irPath, {
        configPath,
        dryRun: true,
      });

      // Verify warning was issued
      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((w) => w.includes("missing-exporter"))).toBe(
        true,
      );
    });

    it("collects fidelity notes as warnings", async () => {
      // Setup
      const config = `version: "1"
mode: solo
exporters:
  - test-exporter
`;
      const yaml = `id: test-pack
version: 1.0.0
spec_version: "1"
sections:
  - heading: Example Rule
    level: 2
    content: This is a test rule for TypeScript files.
    fingerprint: example-rule
`;
      const configPath = join(CONFIG_DIR, "config.yaml");
      const irPath = join(TEST_DIR, "rules.yaml");
      writeFileSync(configPath, config, "utf8");
      writeFileSync(irPath, yaml, "utf8");

      const mockExporter = new MockExporter("test-exporter").setFidelityNotes([
        "Feature X not supported",
        "Using fallback for Y",
      ]);
      engine.registerExporter(mockExporter);

      // Execute
      const result = await engine.syncToAgents(irPath, {
        configPath,
        dryRun: true,
      });

      // Verify fidelity notes in warnings
      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.length).toBeGreaterThan(0);
      expect(result.warnings?.some((w) => w.includes("Feature X"))).toBe(true);
    });

    it("fails when all exporters are missing", async () => {
      // Setup
      const config = `version: "1"
mode: solo
exporters:
  - missing-exporter
`;
      const yaml = `id: test-pack
version: 1.0.0
spec_version: "1"
sections:
  - heading: Example Rule
    level: 2
    content: This is a test rule for TypeScript files.
    fingerprint: example-rule
`;
      const configPath = join(CONFIG_DIR, "config.yaml");
      const irPath = join(TEST_DIR, "rules.yaml");
      writeFileSync(configPath, config, "utf8");
      writeFileSync(irPath, yaml, "utf8");

      // Execute
      const result = await engine.syncToAgents(irPath, {
        configPath,
        dryRun: true,
      });

      // Verify failure
      expect(result.success).toBe(false);
      expect(
        result.warnings?.some((w) => w.includes("No active exporters")),
      ).toBe(true);
    });

    it("handles exporter errors gracefully", async () => {
      // Setup
      const config = `version: "1"
mode: solo
exporters:
  - failing-exporter
`;
      const yaml = `id: test-pack
version: 1.0.0
spec_version: "1"
sections:
  - heading: Example Rule
    level: 2
    content: This is a test rule for TypeScript files.
    fingerprint: example-rule
`;
      const configPath = join(CONFIG_DIR, "config.yaml");
      const irPath = join(TEST_DIR, "rules.yaml");
      writeFileSync(configPath, config, "utf8");
      writeFileSync(irPath, yaml, "utf8");

      const failingExporter = new FailingExporter("failing-exporter", true);
      engine.registerExporter(failingExporter);

      // Execute
      const result = await engine.syncToAgents(irPath, {
        configPath,
        dryRun: true,
      });

      // Verify failure
      expect(result.success).toBe(false);
      expect(result.warnings?.[0]).toContain("Export failed");
    });
  });

  // Note: syncFromAgent was removed in the Ruler-style architecture refactor
  // Agent pullback is no longer supported - .aligntrue/rules/*.md is the single source of truth

  describe("clear", () => {
    it("clears internal state", async () => {
      // Setup config first
      const config = `version: "1"
mode: solo
exporters:
  - cursor
`;
      const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
      mkdirSync(dirname(configPath), { recursive: true });
      writeFileSync(configPath, config, "utf8");

      await engine.loadConfiguration(configPath);

      const yaml = `id: test-pack
version: 1.0.0
spec_version: "1"
sections:
  - heading: Example Rule
    level: 2
    content: This is a test rule for TypeScript files.
    fingerprint: example-rule
`;
      const irPath = join(TEST_DIR, "rules.yaml");
      writeFileSync(irPath, yaml, "utf8");

      await engine.loadIRFromSource(irPath);
      engine.clear();

      // Need to reload configuration after clear since it clears config too
      await engine.loadConfiguration(configPath);

      // Should be able to load again without issues
      await expect(engine.loadIRFromSource(irPath)).resolves.not.toThrow();
    });
  });
});
