import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import {
  loadNamespaceRegistry,
  matchesNamespace,
  findNamespaceOwner,
  validateNamespace,
  extractOrgFromPackId,
  type NamespaceRegistry,
} from "./validate-namespace.js";

const TEST_DIR = ".test-namespace";

describe("Namespace Validation", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("loadNamespaceRegistry", () => {
    it("loads valid registry", () => {
      const registryPath = join(TEST_DIR, "namespaces.yaml");
      const content = `
version: "1.0.0"
updated_at: "2025-10-31T00:00:00.000Z"
namespaces:
  - namespace: "packs/test/*"
    owner: "testorg"
`;
      writeFileSync(registryPath, content);
      const registry = loadNamespaceRegistry(registryPath);
      expect(registry.version).toBe("1.0.0");
      expect(registry.namespaces).toHaveLength(1);
      expect(registry.namespaces[0].namespace).toBe("packs/test/*");
      expect(registry.namespaces[0].owner).toBe("testorg");
    });

    it("returns empty registry for missing file", () => {
      const registryPath = join(TEST_DIR, "nonexistent.yaml");
      const registry = loadNamespaceRegistry(registryPath);
      expect(registry.version).toBe("1.0.0");
      expect(registry.namespaces).toHaveLength(0);
    });

    it("throws error for invalid YAML", () => {
      const registryPath = join(TEST_DIR, "invalid.yaml");
      writeFileSync(registryPath, "not: [valid: yaml");
      expect(() => loadNamespaceRegistry(registryPath)).toThrow(
        "Failed to load namespace registry",
      );
    });

    it("throws error for invalid structure", () => {
      const registryPath = join(TEST_DIR, "invalid-struct.yaml");
      writeFileSync(registryPath, "version: 1.0.0\nnamespaces: not-an-array");
      expect(() => loadNamespaceRegistry(registryPath)).toThrow(
        "Invalid namespace registry structure",
      );
    });

    it("loads registry with notes", () => {
      const registryPath = join(TEST_DIR, "with-notes.yaml");
      const content = `
version: "1.0.0"
updated_at: "2025-10-31T00:00:00.000Z"
namespaces:
  - namespace: "packs/test/*"
    owner: "testorg"
    notes: "Test organization packs"
`;
      writeFileSync(registryPath, content);
      const registry = loadNamespaceRegistry(registryPath);
      expect(registry.namespaces[0].notes).toBe("Test organization packs");
    });
  });

  describe("matchesNamespace", () => {
    it("matches exact pack ID", () => {
      expect(matchesNamespace("packs/test/exact", "packs/test/exact")).toBe(
        true,
      );
    });

    it("matches wildcard pattern", () => {
      expect(matchesNamespace("packs/test/anything", "packs/test/*")).toBe(
        true,
      );
      expect(
        matchesNamespace("packs/test/something-else", "packs/test/*"),
      ).toBe(true);
    });

    it("matches nested wildcard", () => {
      expect(matchesNamespace("packs/test/sub/pack", "packs/test/sub/*")).toBe(
        true,
      );
    });

    it("does not match different namespace", () => {
      expect(matchesNamespace("packs/other/pack", "packs/test/*")).toBe(false);
    });

    it("does not match prefix without wildcard", () => {
      expect(matchesNamespace("packs/test/pack", "packs/test")).toBe(false);
    });

    it("does not match parent namespace", () => {
      expect(matchesNamespace("packs/test", "packs/test/*")).toBe(false);
    });

    it("wildcard does not match across slashes", () => {
      expect(matchesNamespace("packs/other/pack", "packs/*")).toBe(true);
      expect(matchesNamespace("packs/test/sub/pack", "packs/test/*")).toBe(
        true,
      );
    });
  });

  describe("findNamespaceOwner", () => {
    const registry: NamespaceRegistry = {
      version: "1.0.0",
      updated_at: "2025-10-31T00:00:00.000Z",
      namespaces: [
        { namespace: "packs/aligntrue/*", owner: "AlignTrue" },
        { namespace: "packs/test/*", owner: "testorg" },
        { namespace: "packs/test/sub/*", owner: "subowner" },
      ],
    };

    it("finds owner for matching namespace", () => {
      const owner = findNamespaceOwner("packs/aligntrue/base", registry);
      expect(owner).toBe("AlignTrue");
    });

    it("finds owner for different namespace", () => {
      const owner = findNamespaceOwner("packs/test/pack", registry);
      expect(owner).toBe("testorg");
    });

    it("prefers more specific namespace", () => {
      // packs/test/sub/* is more specific than packs/test/*
      const owner = findNamespaceOwner("packs/test/sub/pack", registry);
      expect(owner).toBe("subowner");
    });

    it("returns undefined for unregistered namespace", () => {
      const owner = findNamespaceOwner("packs/unknown/pack", registry);
      expect(owner).toBeUndefined();
    });

    it("handles empty registry", () => {
      const emptyRegistry: NamespaceRegistry = {
        version: "1.0.0",
        updated_at: "2025-10-31T00:00:00.000Z",
        namespaces: [],
      };
      const owner = findNamespaceOwner("packs/test/pack", emptyRegistry);
      expect(owner).toBeUndefined();
    });
  });

  describe("validateNamespace", () => {
    const registry: NamespaceRegistry = {
      version: "1.0.0",
      updated_at: "2025-10-31T00:00:00.000Z",
      namespaces: [
        { namespace: "packs/aligntrue/*", owner: "AlignTrue" },
        { namespace: "packs/test/*", owner: "testorg" },
      ],
    };

    it("validates pack with matching claimed owner", () => {
      const result = validateNamespace(
        "packs/aligntrue/base",
        "AlignTrue",
        registry,
      );
      expect(result.valid).toBe(true);
      expect(result.owner).toBe("AlignTrue");
      expect(result.error).toBeUndefined();
    });

    it("fails for pack with mismatched owner", () => {
      const result = validateNamespace(
        "packs/aligntrue/base",
        "wrongowner",
        registry,
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("owner mismatch");
      expect(result.error).toContain("AlignTrue");
    });

    it("fails for registered namespace without owner", () => {
      const result = validateNamespace(
        "packs/aligntrue/base",
        undefined,
        registry,
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("no owner specified");
    });

    it("allows unregistered namespace with owner", () => {
      const result = validateNamespace("packs/neworg/pack", "neworg", registry);
      expect(result.valid).toBe(true);
      expect(result.owner).toBe("neworg");
    });

    it("requires owner for unregistered namespace", () => {
      const result = validateNamespace(
        "packs/neworg/pack",
        undefined,
        registry,
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("requires namespace_owner field");
    });

    it("fails for invalid pack ID format", () => {
      const result = validateNamespace("invalid-id", "owner", registry);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid pack ID format");
    });

    it("fails for pack ID without org", () => {
      const result = validateNamespace("packs", "owner", registry);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid pack ID format");
    });

    it("validates pack ID with multiple slashes", () => {
      const result = validateNamespace(
        "packs/test/sub/pack",
        "testorg",
        registry,
      );
      expect(result.valid).toBe(true);
    });

    it("handles empty registry gracefully", () => {
      const emptyRegistry: NamespaceRegistry = {
        version: "1.0.0",
        updated_at: "2025-10-31T00:00:00.000Z",
        namespaces: [],
      };
      const result = validateNamespace(
        "packs/test/pack",
        "testorg",
        emptyRegistry,
      );
      expect(result.valid).toBe(true);
      expect(result.owner).toBe("testorg");
    });
  });

  describe("extractOrgFromPackId", () => {
    it("extracts org from valid pack ID", () => {
      const org = extractOrgFromPackId("packs/aligntrue/base-global");
      expect(org).toBe("aligntrue");
    });

    it("extracts org from nested pack ID", () => {
      const org = extractOrgFromPackId("packs/test/sub/pack");
      expect(org).toBe("test");
    });

    it("returns undefined for invalid pack ID", () => {
      const org = extractOrgFromPackId("invalid-id");
      expect(org).toBeUndefined();
    });

    it("returns undefined for pack ID without org", () => {
      const org = extractOrgFromPackId("packs");
      expect(org).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
      const org = extractOrgFromPackId("");
      expect(org).toBeUndefined();
    });
  });

  describe("Integration", () => {
    it("full workflow: load registry, validate pack, extract org", () => {
      const registryPath = join(TEST_DIR, "registry.yaml");
      const content = `
version: "1.0.0"
updated_at: "2025-10-31T00:00:00.000Z"
namespaces:
  - namespace: "packs/aligntrue/*"
    owner: "AlignTrue"
`;
      writeFileSync(registryPath, content);

      const registry = loadNamespaceRegistry(registryPath);
      const packId = "packs/aligntrue/base-global";
      const claimedOwner = "AlignTrue";

      const validation = validateNamespace(packId, claimedOwner, registry);
      expect(validation.valid).toBe(true);

      const org = extractOrgFromPackId(packId);
      expect(org).toBe("aligntrue");

      const owner = findNamespaceOwner(packId, registry);
      expect(owner).toBe("AlignTrue");
    });
  });
});
