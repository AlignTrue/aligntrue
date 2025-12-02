/**
 * Tests for manifest.schema.json validation
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ExporterRegistry } from "../src/registry.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const tempDir = join(__dirname, "temp");

describe("Manifest Schema Validation", () => {
  let registry: ExporterRegistry;

  beforeEach(() => {
    registry = new ExporterRegistry();

    // Create temp directory for test files
    try {
      rmSync(tempDir, { recursive: true });
    } catch {
      // Ignore if doesn't exist
    }
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true });
    } catch {
      // Ignore errors
    }
  });

  const writeManifest = (filename: string, manifest: object): string => {
    const path = join(tempDir, filename);
    writeFileSync(path, JSON.stringify(manifest, null, 2));
    return path;
  };

  describe("valid manifests", () => {
    it("validates minimal valid manifest", () => {
      const path = writeManifest("minimal.json", {
        name: "test",
        version: "1.0.0",
        description: "Test exporter minimal",
        outputs: [".test/*.txt"],
      });

      const manifest = registry.loadManifest(path);
      expect(manifest.name).toBe("test");
    });

    it("validates manifest with all optional fields", () => {
      const path = writeManifest("full.json", {
        name: "test-full",
        version: "2.3.4",
        description: "Test exporter with all fields",
        outputs: [".test/*.txt", ".test/*.md"],
        handler: "./handler.ts",
        license: "Apache-2.0",
        fidelityNotes: ["Note 1", "Note 2"],
      });

      const manifest = registry.loadManifest(path);
      expect(manifest.name).toBe("test-full");
      expect(manifest.handler).toBe("./handler.ts");
      expect(manifest.license).toBe("Apache-2.0");
      expect(manifest.fidelityNotes).toHaveLength(2);
    });

    it("accepts valid exporter names (lowercase alphanumeric with hyphens)", () => {
      const validNames = [
        "cursor",
        "agents",
        "vscode-mcp",
        "test123",
        "my-exporter-v2",
      ];

      for (const name of validNames) {
        const path = writeManifest(`${name}.json`, {
          name,
          version: "1.0.0",
          description: "Test exporter",
          outputs: [".test/*.txt"],
        });

        expect(() => registry.loadManifest(path)).not.toThrow();
      }
    });

    it("accepts valid semver versions", () => {
      const validVersions = [
        "0.1.0",
        "1.0.0",
        "2.3.4",
        "10.20.30",
        "999.999.999",
      ];

      for (const version of validVersions) {
        const path = writeManifest(`v-${version}.json`, {
          name: "test",
          version,
          description: "Test exporter",
          outputs: [".test/*.txt"],
        });

        expect(() => registry.loadManifest(path)).not.toThrow();
      }
    });
  });

  describe("required fields", () => {
    it("rejects manifest missing name", () => {
      const path = writeManifest("no-name.json", {
        version: "1.0.0",
        description: "Missing name",
        outputs: [".test/*.txt"],
      });

      expect(() => registry.loadManifest(path)).toThrow("Invalid manifest");
      expect(() => registry.loadManifest(path)).toThrow("name");
    });

    it("rejects manifest missing version", () => {
      const path = writeManifest("no-version.json", {
        name: "test",
        description: "Missing version",
        outputs: [".test/*.txt"],
      });

      expect(() => registry.loadManifest(path)).toThrow("Invalid manifest");
      expect(() => registry.loadManifest(path)).toThrow("version");
    });

    it("rejects manifest missing description", () => {
      const path = writeManifest("no-description.json", {
        name: "test",
        version: "1.0.0",
        outputs: [".test/*.txt"],
      });

      expect(() => registry.loadManifest(path)).toThrow("Invalid manifest");
      expect(() => registry.loadManifest(path)).toThrow("description");
    });

    it("rejects manifest missing outputs", () => {
      const path = writeManifest("no-outputs.json", {
        name: "test",
        version: "1.0.0",
        description: "Missing outputs",
      });

      expect(() => registry.loadManifest(path)).toThrow("Invalid manifest");
      expect(() => registry.loadManifest(path)).toThrow("outputs");
    });
  });

  describe("invalid field formats", () => {
    it("rejects invalid exporter name (uppercase)", () => {
      const path = writeManifest("bad-name-upper.json", {
        name: "TestExporter",
        version: "1.0.0",
        description: "Invalid name",
        outputs: [".test/*.txt"],
      });

      expect(() => registry.loadManifest(path)).toThrow("Invalid manifest");
    });

    it("rejects invalid exporter name (special chars)", () => {
      const path = writeManifest("bad-name-special.json", {
        name: "test_exporter",
        version: "1.0.0",
        description: "Invalid name",
        outputs: [".test/*.txt"],
      });

      expect(() => registry.loadManifest(path)).toThrow("Invalid manifest");
    });

    it("rejects invalid semver (missing patch)", () => {
      const path = writeManifest("bad-version-1.json", {
        name: "test",
        version: "1.0",
        description: "Invalid semver",
        outputs: [".test/*.txt"],
      });

      expect(() => registry.loadManifest(path)).toThrow("Invalid manifest");
    });

    it("rejects invalid semver (with v prefix)", () => {
      const path = writeManifest("bad-version-2.json", {
        name: "test",
        version: "v1.0.0",
        description: "Invalid semver",
        outputs: [".test/*.txt"],
      });

      expect(() => registry.loadManifest(path)).toThrow("Invalid manifest");
    });

    it("rejects short description (less than 10 chars)", () => {
      const path = writeManifest("bad-desc.json", {
        name: "test",
        version: "1.0.0",
        description: "Too short",
        outputs: [".test/*.txt"],
      });

      expect(() => registry.loadManifest(path)).toThrow("Invalid manifest");
    });

    it("rejects empty outputs array", () => {
      const path = writeManifest("empty-outputs.json", {
        name: "test",
        version: "1.0.0",
        description: "Empty outputs array",
        outputs: [],
      });

      expect(() => registry.loadManifest(path)).toThrow("Invalid manifest");
    });

    it("rejects non-string outputs", () => {
      const path = writeManifest("bad-outputs.json", {
        name: "test",
        version: "1.0.0",
        description: "Non-string outputs",
        outputs: [123, 456],
      });

      expect(() => registry.loadManifest(path)).toThrow("Invalid manifest");
    });
  });

  describe("optional fields", () => {
    it("allows manifest without handler", () => {
      const path = writeManifest("no-handler.json", {
        name: "test",
        version: "1.0.0",
        description: "No handler specified",
        outputs: [".test/*.txt"],
      });

      const manifest = registry.loadManifest(path);
      expect(manifest.handler).toBeUndefined();
    });

    it("allows manifest without license", () => {
      const path = writeManifest("no-license.json", {
        name: "test",
        version: "1.0.0",
        description: "No license specified",
        outputs: [".test/*.txt"],
      });

      const manifest = registry.loadManifest(path);
      expect(manifest.license).toBeUndefined();
    });

    it("allows manifest without fidelityNotes", () => {
      const path = writeManifest("no-fidelity.json", {
        name: "test",
        version: "1.0.0",
        description: "No fidelity notes",
        outputs: [".test/*.txt"],
      });

      const manifest = registry.loadManifest(path);
      expect(manifest.fidelityNotes).toBeUndefined();
    });

    it("allows empty fidelityNotes array", () => {
      const path = writeManifest("empty-fidelity.json", {
        name: "test",
        version: "1.0.0",
        description: "Empty fidelity notes",
        outputs: [".test/*.txt"],
        fidelityNotes: [],
      });

      const manifest = registry.loadManifest(path);
      expect(manifest.fidelityNotes).toEqual([]);
    });
  });

  describe("additional properties", () => {
    it("rejects manifests with extra fields (strict mode)", () => {
      const path = writeManifest("extra-fields.json", {
        name: "test",
        version: "1.0.0",
        description: "Has extra fields",
        outputs: [".test/*.txt"],
        extraField: "should not be here",
      });

      expect(() => registry.loadManifest(path)).toThrow("Invalid manifest");
    });
  });
});
