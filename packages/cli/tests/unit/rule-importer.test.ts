/**
 * Unit tests for rule-importer.ts
 *
 * Tests the extractNestedLocation helper function that determines
 * where to export imported rules based on their original path.
 */

import { describe, it, expect } from "vitest";
import { extractNestedLocation } from "../../src/commands/init/rule-importer.js";

describe("extractNestedLocation", () => {
  describe("cursor type", () => {
    it("extracts nested location from apps/docs/.cursor/rules/ path", () => {
      const result = extractNestedLocation(
        "apps/docs/.cursor/rules/web_stack.mdc",
        "cursor",
      );
      expect(result).toBe("apps/docs");
    });

    it("extracts nested location from packages/cli/.cursor/rules/ path", () => {
      const result = extractNestedLocation(
        "packages/cli/.cursor/rules/testing.mdc",
        "cursor",
      );
      expect(result).toBe("packages/cli");
    });

    it("extracts nested location from deeply nested path", () => {
      const result = extractNestedLocation(
        "apps/frontend/packages/ui/.cursor/rules/components.mdc",
        "cursor",
      );
      expect(result).toBe("apps/frontend/packages/ui");
    });

    it("returns undefined for root level .cursor/rules/", () => {
      const result = extractNestedLocation(
        ".cursor/rules/global.mdc",
        "cursor",
      );
      expect(result).toBeUndefined();
    });

    it("handles .cursor directory without /rules suffix", () => {
      // This case shouldn't normally occur but tests the fallback
      const result = extractNestedLocation(
        "apps/docs/.cursor/config.json",
        "cursor",
      );
      // dirname returns "apps/docs/.cursor", which ends with ".cursor"
      expect(result).toBe("apps/docs");
    });
  });

  describe("agents type", () => {
    it("extracts nested location from packages/cli/AGENTS.md", () => {
      const result = extractNestedLocation("packages/cli/AGENTS.md", "agents");
      expect(result).toBe("packages/cli");
    });

    it("extracts nested location from apps/web/AGENTS.md", () => {
      const result = extractNestedLocation("apps/web/AGENTS.md", "agents");
      expect(result).toBe("apps/web");
    });

    it("returns undefined for root level AGENTS.md", () => {
      const result = extractNestedLocation("AGENTS.md", "agents");
      expect(result).toBeUndefined();
    });
  });

  describe("claude type", () => {
    it("extracts nested location from packages/core/CLAUDE.md", () => {
      const result = extractNestedLocation("packages/core/CLAUDE.md", "claude");
      expect(result).toBe("packages/core");
    });

    it("returns undefined for root level CLAUDE.md", () => {
      const result = extractNestedLocation("CLAUDE.md", "claude");
      expect(result).toBeUndefined();
    });
  });

  describe("other type", () => {
    it("returns undefined for unknown types at root", () => {
      const result = extractNestedLocation("some-file.md", "other");
      expect(result).toBeUndefined();
    });

    it("returns undefined for unknown types in subdirectory", () => {
      const result = extractNestedLocation("apps/docs/some-file.md", "other");
      expect(result).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("handles paths with trailing slashes correctly", () => {
      // dirname of "apps/docs/.cursor/rules/file.mdc" is "apps/docs/.cursor/rules"
      const result = extractNestedLocation(
        "apps/docs/.cursor/rules/file.mdc",
        "cursor",
      );
      expect(result).toBe("apps/docs");
    });

    it("handles single directory depth", () => {
      const result = extractNestedLocation(
        "monorepo/.cursor/rules/test.mdc",
        "cursor",
      );
      expect(result).toBe("monorepo");
    });

    it("handles unknown agent type gracefully", () => {
      const result = extractNestedLocation(
        "apps/docs/.cursor/rules/file.mdc",
        "unknown",
      );
      expect(result).toBeUndefined();
    });
  });
});
