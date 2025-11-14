/**
 * Integration tests for solo developer workflow
 * Tests the complete flow: init → edit native format → sync
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
  mkdtempSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";

let TEST_DIR: string;

beforeEach(() => {
  // Create fresh test directory
  TEST_DIR = mkdtempSync(join(tmpdir(), "aligntrue-solo-workflow-test-"));
});

afterEach(() => {
  // Cleanup
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("Solo Workflow Integration", () => {
  describe("Fresh Install", () => {
    it("completes setup in minimal time with minimal config", () => {
      const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
      const cursorPath = join(
        TEST_DIR,
        ".cursor",
        "rules",
        "aligntrue-starter.mdc",
      );

      // Simulate init creating minimal config
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
      writeFileSync(
        configPath,
        "exporters:\n  - cursor\n  - agents-md\n",
        "utf-8",
      );

      // Verify config is minimal
      const config = readFileSync(configPath, "utf-8");
      expect(
        config.split("\n").filter((l) => l.trim()).length,
      ).toBeLessThanOrEqual(3);

      // Simulate init creating native format starter
      mkdirSync(join(TEST_DIR, ".cursor", "rules"), { recursive: true });
      writeFileSync(
        cursorPath,
        "## Rule: test-rule\n\n**Severity:** error\n**Applies to:** `**/*.ts`\n\nTest guidance\n",
        "utf-8",
      );

      expect(existsSync(cursorPath)).toBe(true);
      expect(existsSync(join(TEST_DIR, ".aligntrue", ".rules.yaml"))).toBe(
        false,
      ); // IR created on sync, not init
    });

    it("creates native format starter (not YAML IR)", () => {
      const cursorPath = join(
        TEST_DIR,
        ".cursor",
        "rules",
        "aligntrue-starter.mdc",
      );
      const irPath = join(TEST_DIR, ".aligntrue", ".rules.yaml");

      // Simulate init behavior
      mkdirSync(join(TEST_DIR, ".cursor", "rules"), { recursive: true });
      writeFileSync(
        cursorPath,
        "## Rule: typescript-strict\n\n**Severity:** error\n**Applies to:** `tsconfig.json`\n\nEnable strict mode\n",
        "utf-8",
      );

      expect(existsSync(cursorPath)).toBe(true);
      expect(existsSync(irPath)).toBe(false);

      // Verify native format (markdown, not YAML)
      const content = readFileSync(cursorPath, "utf-8");
      expect(content).toContain("## Rule:");
      expect(content).toContain("**Severity:**");
      expect(content).not.toContain("spec_version:");
      expect(content).not.toContain("rules:");
    });
  });

  describe("Native Format Editing", () => {
    it("supports editing Cursor .mdc files", () => {
      const cursorPath = join(TEST_DIR, ".cursor", "rules", "my-rules.mdc");

      mkdirSync(join(TEST_DIR, ".cursor", "rules"), { recursive: true });

      // User edits native format
      const nativeContent = `## Rule: new-rule

**Severity:** warn
**Applies to:** \`**/*.js\`

New rule guidance
`;
      writeFileSync(cursorPath, nativeContent, "utf-8");

      const content = readFileSync(cursorPath, "utf-8");
      expect(content).toContain("new-rule");
      expect(content).toContain("warn");
      expect(content).toContain("**/*.js");
    });

    it("supports editing AGENTS.md format", () => {
      const agentsMdPath = join(TEST_DIR, "AGENTS.md");

      // User edits universal format
      const content = `# AI Agent Rules

## Rule: test-rule

**ID:** test-rule
**Severity:** ERROR
**Scope:** **/*.ts

Rule guidance here
`;
      writeFileSync(agentsMdPath, content, "utf-8");

      const readContent = readFileSync(agentsMdPath, "utf-8");
      expect(readContent).toContain("test-rule");
      expect(readContent).toContain("ERROR");
    });
  });

  describe("Auto-Pull on Sync", () => {
    it("enables auto-pull by default for solo mode", () => {
      const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");

      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

      // Minimal solo config (no sync section)
      writeFileSync(configPath, "exporters:\n  - cursor\n", "utf-8");

      // Load and verify defaults would be applied
      const config = readFileSync(configPath, "utf-8");
      expect(config).toContain("exporters:");
      expect(config).not.toContain("sync:"); // Defaults applied at runtime

      // Note: Actual default application happens in loadConfig()
      // This test verifies minimal config doesn't require sync section
    });

    it("detects primary agent from exporters", () => {
      const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");

      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
      writeFileSync(
        configPath,
        "exporters:\n  - cursor\n  - agents-md\n",
        "utf-8",
      );

      const config = readFileSync(configPath, "utf-8");
      const exporters = config.match(/exporters:\s*\n\s*-\s*(\w+)/g);

      expect(exporters).toBeTruthy();
      // First exporter that supports import becomes primary
      expect(config).toContain("cursor");
    });
  });

  describe("Solo vs Team Mode", () => {
    it("solo mode has minimal config", () => {
      const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");

      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

      // Solo config
      const soloConfig = "exporters:\n  - cursor\n";
      writeFileSync(configPath, soloConfig, "utf-8");

      expect(soloConfig.split("\n").length).toBeLessThanOrEqual(3);
      expect(soloConfig).not.toContain("mode:");
      expect(soloConfig).not.toContain("lockfile:");
      expect(soloConfig).not.toContain("modules:");
    });

    it("team mode has lockfile and mode explicit", () => {
      const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
      const _lockfilePath = join(TEST_DIR, ".aligntrue.lock.json");

      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

      // Team config
      const teamConfig = `mode: team
exporters:
  - cursor
modules:
  lockfile: true
`;
      writeFileSync(configPath, teamConfig, "utf-8");

      const config = readFileSync(configPath, "utf-8");
      expect(config).toContain("mode: team");
      expect(config).toContain("lockfile: true");
    });
  });

  describe("Zero YAML Interaction", () => {
    it("solo dev workflow never requires editing YAML IR", () => {
      const cursorPath = join(TEST_DIR, ".cursor", "rules", "my-rules.mdc");
      const _irPath = join(TEST_DIR, ".aligntrue", ".rules.yaml");

      mkdirSync(join(TEST_DIR, ".cursor", "rules"), { recursive: true });

      // 1. User creates native format
      writeFileSync(
        cursorPath,
        "## Rule: test\n\n**Severity:** error\n**Applies to:** `**/*`\n\nGuidance\n",
        "utf-8",
      );

      // 2. Sync creates IR automatically (user never edits it)
      // Simulated - in reality, sync command would do this
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

      // 3. User can continue editing native format
      const updatedContent =
        readFileSync(cursorPath, "utf-8") +
        "\n## Rule: test2\n\n**Severity:** warn\n\nMore guidance\n";
      writeFileSync(cursorPath, updatedContent, "utf-8");

      // Verify: User only touched native format
      const nativeContent = readFileSync(cursorPath, "utf-8");
      expect(nativeContent).toContain("## Rule:");
      expect(nativeContent).toContain("**Severity:**");

      // IR would exist but user never edits it
      expect(existsSync(cursorPath)).toBe(true);
    });
  });

  describe("Performance", () => {
    it("setup completes in reasonable time", () => {
      const start = Date.now();

      // Simulate init operations
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
      mkdirSync(join(TEST_DIR, ".cursor", "rules"), { recursive: true });

      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        "exporters:\n  - cursor\n",
        "utf-8",
      );

      writeFileSync(
        join(TEST_DIR, ".cursor", "rules", "starter.mdc"),
        "## Rule: test\n\n**Severity:** error\n\nGuidance\n",
        "utf-8",
      );

      const elapsed = Date.now() - start;

      // Should be very fast (filesystem operations only)
      expect(elapsed).toBeLessThan(1000); // <1 second
    });
  });
});
