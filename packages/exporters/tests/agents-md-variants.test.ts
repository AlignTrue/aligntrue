/**
 * Test for AGENTS.md-based exporter variants
 * All these exporters use the agents-md handler
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ExporterRegistry } from "../src/registry.js";
import { dirname, join, basename } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, rmSync } from "fs";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// All exporters that use agents-md format
const AGENTS_MD_VARIANTS = [
  "copilot",
  "gemini-cli",
  "aider-md",
  "jules",
  "openai-codex",
  "amp",
  "opencode-md",
  "qwen-code",
  "roocode-md",
  "windsurf-md",
  "zed-md",
];

describe("AGENTS.md-based exporter variants", () => {
  let registry: ExporterRegistry;
  const testRoot = join(__dirname, "../.test-output");

  beforeEach(() => {
    registry = new ExporterRegistry();
    // Clean test output
    rmSync(testRoot, { recursive: true, force: true });
    mkdirSync(testRoot, { recursive: true });
  });

  it("should discover all AGENTS.md variant manifests", () => {
    const srcPath = join(__dirname, "../src");
    const manifests = registry.discoverAdapters(srcPath);

    // Check that all variants are discovered
    // Use path.basename() to get directory name (works cross-platform)
    const manifestNames = manifests.map((p) => {
      return basename(dirname(p)); // Get directory name before manifest.json
    });

    for (const variant of AGENTS_MD_VARIANTS) {
      expect(
        manifestNames.includes(variant),
        `${variant} manifest should be discovered`,
      ).toBe(true);
    }
  });

  it("should load manifests for all AGENTS.md variants", async () => {
    const srcPath = join(__dirname, "../src");

    for (const variant of AGENTS_MD_VARIANTS) {
      const manifestPath = join(srcPath, variant, "manifest.json");
      const manifest = registry.loadManifest(manifestPath);

      expect(manifest.name).toBe(variant);
      expect(manifest.version).toBe("1.0.0");
      expect(manifest.outputs).toContain("AGENTS.md");
      expect(manifest.handler).toBe("./index.ts");
    }
  });

  it("should register and export using all AGENTS.md variants", async () => {
    const srcPath = join(__dirname, "../src");

    // Test a few representative variants
    const testVariants = ["copilot", "gemini-cli", "aider-md"];

    for (const variant of testVariants) {
      const manifestPath = join(srcPath, variant, "manifest.json");
      await registry.registerFromManifest(manifestPath);

      const exporter = registry.get(variant);
      expect(exporter, `${variant} should be registered`).toBeDefined();

      // Test export
      const outputPath = join(testRoot, variant);
      mkdirSync(outputPath, { recursive: true });

      const rules = [
        {
          id: "test-rule",
          severity: "MUST",
          guidance: "Test rule for " + variant,
        },
      ];
      const result = await exporter!.export(
        {
          scope: { root: ".", applies_to: ["**/*.ts"] },
          rules,
          pack: {
            id: "test-pack",
            version: "1.0.0",
            spec_version: "1",
            rules,
          },
        },
        {
          outputDir: outputPath,
          dryRun: false,
        },
      );

      expect(result.success).toBe(true);
      expect(result.filesWritten).toHaveLength(1);
      expect(result.filesWritten[0]).toContain("AGENTS.md");

      // Verify file content
      const content = readFileSync(result.filesWritten[0], "utf-8");
      // AGENTS.md format uses different headers
      expect(content.length).toBeGreaterThan(0);
      expect(content).toContain("Test rule for " + variant);
      expect(content).toContain("Content Hash:"); // Note: no hyphen in "Content Hash"
    }
  });

  it("should include appropriate fidelity notes for AGENTS.md format", async () => {
    const srcPath = join(__dirname, "../src");

    // Test with rules that have unsupported fields
    const manifestPath = join(srcPath, "copilot", "manifest.json");
    await registry.registerFromManifest(manifestPath);

    const exporter = registry.get("copilot");
    const outputPath = join(testRoot, "copilot-fidelity");
    mkdirSync(outputPath, { recursive: true });

    const rules = [
      {
        id: "test-rule",
        severity: "MUST",
        guidance: "Test rule with check",
        check: {
          type: "regex",
          pattern: "test",
        },
        autofix: {
          description: "Auto-fix hint",
        },
      },
    ];
    const result = await exporter!.export(
      {
        scope: { root: ".", applies_to: ["**/*.ts"] },
        rules,
        pack: {
          id: "test-pack",
          version: "1.0.0",
          spec_version: "1",
          rules,
        },
      },
      {
        outputDir: outputPath,
        dryRun: false,
      },
    );

    expect(result.success).toBe(true);
    expect(result.fidelityNotes).toBeDefined();
    expect(result.fidelityNotes!.length).toBeGreaterThan(0);

    // Check fidelity notes mention unsupported fields (case-insensitive)
    const notes = result.fidelityNotes!.join(" ").toLowerCase();
    expect(notes).toContain("check");
    expect(notes).toContain("autofix");
  });
});
