/**
 * Gemini exporter tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ExporterRegistry } from "../src/registry.js";
import type { AlignPack, AlignSection } from "@aligntrue/schema";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, rmSync, readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper to create request with pack
function createTestRequest(sections: AlignSection[], scope: any): any {
  const pack: AlignPack = {
    id: "test-pack",
    version: "1.0.0",
    spec_version: "1",
    sections,
  };
  return { scope, sections, pack };
}

describe("GeminiExporter", () => {
  let registry: ExporterRegistry;
  const testRoot = join(__dirname, "../.test-output-gemini");

  beforeEach(() => {
    registry = new ExporterRegistry();
    // Clean test output
    rmSync(testRoot, { recursive: true, force: true });
    mkdirSync(testRoot, { recursive: true });
  });

  it("should discover gemini manifest", () => {
    const srcPath = join(__dirname, "../src");
    const manifests = registry.discoverAdapters(srcPath);

    const hasGemini = manifests.some((p) => p.includes("gemini"));
    expect(hasGemini).toBe(true);
  });

  it("should load gemini manifest", () => {
    const manifestPath = join(__dirname, "../src/gemini/manifest.json");
    const manifest = registry.loadManifest(manifestPath);

    expect(manifest.name).toBe("gemini");
    expect(manifest.version).toBe("1.0.0");
    expect(manifest.outputs).toContain("GEMINI.md");
    expect(manifest.handler).toBe("./index.js");
  });

  it("should register and export GEMINI.md", async () => {
    const manifestPath = join(__dirname, "../src/gemini/manifest.json");
    await registry.registerFromManifest(manifestPath);

    const exporter = registry.get("gemini");
    expect(exporter).toBeDefined();
    expect(exporter?.name).toBe("gemini");
    expect(exporter?.version).toBe("1.0.0");

    // Test export
    const sections: AlignSection[] = [
      {
        heading: "test-rule",
        level: 2,
        content: "This is a test rule for Gemini",
        fingerprint: "",
      },
    ];

    const result = await exporter!.export(
      createTestRequest(sections, { root: ".", applies_to: ["**/*.ts"] }),
      { outputDir: testRoot, dryRun: false },
    );

    expect(result.success).toBe(true);
    expect(result.filesWritten).toHaveLength(1);
    expect(result.filesWritten[0]).toMatch(/GEMINI\.md$/);
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);

    const content = readFileSync(result.filesWritten[0], "utf-8");
    // No header - files are clean and editable (see bd83ece)
    expect(content).toContain("## test-rule");
  });

  it("should produce deterministic output", async () => {
    const manifestPath = join(__dirname, "../src/gemini/manifest.json");
    await registry.registerFromManifest(manifestPath);
    const exporter = registry.get("gemini");

    const sections: AlignSection[] = [
      {
        heading: "rule-a",
        level: 2,
        content: "First rule",
        fingerprint: "",
      },
      {
        heading: "rule-b",
        level: 2,
        content: "Second rule",
        fingerprint: "",
      },
    ];

    const scope = { root: ".", applies_to: ["**/*.ts"] };

    // Export twice, resetting state between exports
    const result1 = await exporter!.export(
      {
        scope,
        sections,
        pack: {
          id: "test-pack",
          version: "1.0.0",
          spec_version: "1",
          sections,
        },
      },
      { outputDir: join(testRoot, "run1"), dryRun: false },
    );
    if (exporter && "resetState" in exporter) {
      (exporter as any).resetState();
    }

    const result2 = await exporter!.export(
      {
        scope,
        sections,
        pack: {
          id: "test-pack",
          version: "1.0.0",
          spec_version: "1",
          sections,
        },
      },
      { outputDir: join(testRoot, "run2"), dryRun: false },
    );

    // Content hashes should match
    expect(result1.contentHash).toBe(result2.contentHash);

    // File contents should match if both exports succeeded
    if (result1.filesWritten.length > 0 && result2.filesWritten.length > 0) {
      const content1 = readFileSync(result1.filesWritten[0], "utf-8");
      const content2 = readFileSync(result2.filesWritten[0], "utf-8");
      expect(content1).toBe(content2);
    }
  });

  it("should handle empty sections gracefully", async () => {
    const manifestPath = join(__dirname, "../src/gemini/manifest.json");
    await registry.registerFromManifest(manifestPath);
    const exporter = registry.get("gemini");

    const sections: AlignSection[] = [];
    const result = await exporter!.export(
      {
        scope: { root: ".", applies_to: ["**/*.ts"] },
        sections,
        pack: {
          id: "test-pack",
          version: "1.0.0",
          spec_version: "1",
          sections,
        },
      },
      { outputDir: testRoot, dryRun: false },
    );

    expect(result.success).toBe(true);
    expect(result.filesWritten).toHaveLength(0);
  });

  it("should include unresolved plugs count when provided", async () => {
    const manifestPath = join(__dirname, "../src/gemini/manifest.json");
    await registry.registerFromManifest(manifestPath);
    const exporter = registry.get("gemini");

    const sections: AlignSection[] = [
      {
        heading: "test-rule",
        level: 2,
        content: "Test",
        fingerprint: "",
      },
    ];
    const result = await exporter!.export(
      {
        scope: { root: ".", applies_to: ["**/*.ts"] },
        sections,
        pack: {
          id: "test-pack",
          version: "1.0.0",
          spec_version: "1",
          sections,
        },
      },
      { outputDir: testRoot, dryRun: false, unresolvedPlugsCount: 3 },
    );

    expect(result.success).toBe(true);
    // DEPRECATED: Footer check removed - footers no longer included
    // if (result.filesWritten.length > 0) {
    //   const content = readFileSync(result.filesWritten[0], "utf-8");
    //   expect(content).toContain("Unresolved Plugs: 3");
    // }
  });
});
