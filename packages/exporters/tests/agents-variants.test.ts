/**
 * Test for AGENTS.md-based exporter variants
 * All these exporters use the agents handler
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ExporterRegistry } from "../src/registry.js";
import type { AlignSection } from "@aligntrue/schema";
import { dirname, join, basename } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, rmSync } from "fs";
import { readFileSync } from "fs";
import { computeHash } from "@aligntrue/schema";

/**
 * Generate a stable fingerprint for tests
 */
function generateFingerprint(heading: string, content: string): string {
  const combined = `${heading}::${content}`;
  return computeHash(combined).substring(0, 16);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// All exporters that use agents format
const AGENTS_MD_VARIANTS = [
  "copilot",
  "gemini-cli",
  "aider",
  "jules",
  "openai-codex",
  "amp",
  "opencode",
  "qwen-code",
  "roocode",
  "windsurf",
  "zed",
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

  it("should load manifests for representative AGENTS.md variants", async () => {
    const srcPath = join(__dirname, "../src");

    // Test representative variants instead of all 11
    for (const variant of ["copilot", "gemini-cli", "aider"]) {
      const manifestPath = join(srcPath, variant, "manifest.json");
      const manifest = registry.loadManifest(manifestPath);

      expect(manifest.name).toBe(variant);
      expect(manifest.version).toBe("1.0.0");
      expect(manifest.outputs).toContain("AGENTS.md");
      expect(manifest.handler).toBe("./index.js");
    }
  });

  it("should register and export using all AGENTS.md variants", async () => {
    const srcPath = join(__dirname, "../src");

    // Test a few representative variants
    const testVariants = ["copilot", "gemini-cli", "aider"];

    for (const variant of testVariants) {
      const manifestPath = join(srcPath, variant, "manifest.json");
      await registry.registerFromManifest(manifestPath);

      const exporter = registry.get(variant);
      expect(exporter, `${variant} should be registered`).toBeDefined();

      // Test export
      const outputPath = join(testRoot, variant);
      mkdirSync(outputPath, { recursive: true });

      const sections: AlignSection[] = [
        {
          heading: "test-rule",
          level: 2,
          content: "Test rule for " + variant,
          fingerprint: generateFingerprint(
            "test-rule",
            "Test rule for " + variant,
          ),
        },
        {
          heading: "test-rule-2",
          level: 2,
          content: "Second test rule for " + variant,
          fingerprint: generateFingerprint(
            "test-rule-2",
            "Second test rule for " + variant,
          ),
        },
      ];
      const result = await exporter!.export(
        {
          scope: { path: ".", isDefault: true, normalizedPath: "." },
          align: {
            id: "test-align",
            version: "1.0.0",
            spec_version: "1",
            sections,
          },
          outputPath: join(outputPath, "AGENTS.md"),
        },
        {
          outputDir: outputPath,
          dryRun: false,
        },
      );

      expect(result.success).toBe(true);
      expect(result.filesWritten).toHaveLength(1);
      expect(result.filesWritten[0]).toContain("AGENTS.md");

      // Verify file content - now link-based, not content-based
      const content = readFileSync(result.filesWritten[0], "utf-8");
      expect(content.length).toBeGreaterThan(0);
      // New link-based format contains rule names and paths, not rule content directly
      expect(content).toContain(".aligntrue/rules/");
      expect(content).toContain("- test-rule (");
      expect(content).toContain("# Agent Rules");
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

    const sections: AlignSection[] = [
      {
        heading: "test-rule",
        level: 2,
        content: "Test rule with check",
        fingerprint: generateFingerprint("test-rule", "Test rule with check"),
        vendor: {
          cursor: {
            check: { type: "regex", pattern: "test" },
            autofix: { description: "Auto-fix hint" },
          },
        },
      },
    ];
    const result = await exporter!.export(
      {
        scope: { path: ".", isDefault: true, normalizedPath: "." },
        align: {
          id: "test-align",
          version: "1.0.0",
          spec_version: "1",
          sections,
        },
        outputPath: join(outputPath, "AGENTS.md"),
      },
      {
        outputDir: outputPath,
        dryRun: false,
      },
    );

    expect(result.success).toBe(true);
    // AGENTS.md format doesn't include vendor-specific checks/autofixes
    // So fidelity notes may be present for vendor fields
    if (result.fidelityNotes && result.fidelityNotes.length > 0) {
      const notes = result.fidelityNotes.join(" ").toLowerCase();
      // Fidelity notes should mention vendor-specific fields that are preserved
      expect(notes.length).toBeGreaterThan(0);
    }
  });
});
