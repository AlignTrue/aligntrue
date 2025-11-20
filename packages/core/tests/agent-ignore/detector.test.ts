/**
 * Tests for conflict detection
 */

import { describe, it, expect } from "vitest";
import {
  detectConflicts,
  getIgnorePatterns,
  getNestedIgnorePatterns,
  formatConflictMessage,
  formatWarningMessage,
} from "../../src/agent-ignore/detector.js";

describe("Conflict Detection", () => {
  describe("detectConflicts", () => {
    it("should detect no conflicts with single exporter", () => {
      const result = detectConflicts(["cursor"]);
      expect(result.conflicts).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.hasIssues).toBe(false);
    });

    it("should detect conflict when cursor and agents both enabled", () => {
      const result = detectConflicts(["cursor", "agents"]);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].agent).toBe("cursor");
      expect(result.conflicts[0].conflictingExporters).toContain("cursor");
      expect(result.conflicts[0].conflictingExporters).toContain("agents");
    });

    it("should prioritize native format by default", () => {
      const result = detectConflicts(["cursor", "agents"]);
      expect(result.conflicts[0].nativeFormat).toBe("cursor");
      expect(result.conflicts[0].formatsToIgnore).toContain("agents");
    });

    it("should respect custom priority", () => {
      const result = detectConflicts(["cursor", "agents"], {
        cursor: "agents",
      });
      expect(result.conflicts[0].nativeFormat).toBe("agents");
      expect(result.conflicts[0].formatsToIgnore).toContain("cursor");
    });

    it("should detect multiple conflicts", () => {
      const result = detectConflicts(["cursor", "agents", "aider"]);
      expect(result.conflicts.length).toBeGreaterThanOrEqual(2);
    });

    it("should detect warnings for agents without ignore support", () => {
      const result = detectConflicts(["claude", "agents"]);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].agent).toBe("claude");
    });

    it("should not warn for single format on agent without ignore", () => {
      const result = detectConflicts(["claude"]);
      expect(result.warnings).toHaveLength(0);
    });

    it("should handle mix of conflicts and warnings", () => {
      const result = detectConflicts(["cursor", "agents", "claude"]);
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.hasIssues).toBe(true);
    });
  });

  describe("getIgnorePatterns", () => {
    it("should return AGENTS.md pattern for agents format", () => {
      const conflict = {
        agent: "cursor",
        conflictingExporters: ["cursor", "agents"],
        nativeFormat: "cursor",
        formatsToIgnore: ["agents"],
        ignoreFile: ".cursorignore",
        supportsNested: true,
      };
      const patterns = getIgnorePatterns(conflict);
      expect(patterns).toContain("AGENTS.md");
    });

    it("should return .mdc pattern for cursor format", () => {
      const conflict = {
        agent: "aider",
        conflictingExporters: ["cursor", "aider"],
        nativeFormat: "aider",
        formatsToIgnore: ["cursor"],
        ignoreFile: ".aiderignore",
        supportsNested: true,
      };
      const patterns = getIgnorePatterns(conflict);
      expect(patterns).toContain(".cursor/rules/*.mdc");
    });

    it("should return multiple patterns for multiple formats", () => {
      const conflict = {
        agent: "cursor",
        conflictingExporters: ["cursor", "agents", "claude"],
        nativeFormat: "cursor",
        formatsToIgnore: ["agents", "claude"],
        ignoreFile: ".cursorignore",
        supportsNested: true,
      };
      const patterns = getIgnorePatterns(conflict);
      expect(patterns).toContain("AGENTS.md");
      expect(patterns).toContain("CLAUDE.md");
    });

    it("should skip MCP exporters", () => {
      const conflict = {
        agent: "cursor",
        conflictingExporters: ["cursor", "cursor-mcp"],
        nativeFormat: "cursor",
        formatsToIgnore: ["cursor-mcp"],
        ignoreFile: ".cursorignore",
        supportsNested: true,
      };
      const patterns = getIgnorePatterns(conflict);
      expect(patterns).toHaveLength(0);
    });
  });

  describe("getNestedIgnorePatterns", () => {
    it("should return relative patterns for nested scopes", () => {
      const conflict = {
        agent: "cursor",
        conflictingExporters: ["cursor", "agents"],
        nativeFormat: "cursor",
        formatsToIgnore: ["agents"],
        ignoreFile: ".cursorignore",
        supportsNested: true,
      };
      const patterns = getNestedIgnorePatterns(conflict, "apps/web");
      expect(patterns).toContain("AGENTS.md");
    });

    it("should return empty for formats without nested support", () => {
      const conflict = {
        agent: "cursor",
        conflictingExporters: ["cursor", "amazonq"],
        nativeFormat: "cursor",
        formatsToIgnore: ["amazonq"],
        ignoreFile: ".cursorignore",
        supportsNested: true,
      };
      const patterns = getNestedIgnorePatterns(conflict, "apps/web");
      expect(patterns).toHaveLength(0);
    });
  });

  describe("formatConflictMessage", () => {
    it("should format message with agent name and formats", () => {
      const conflict = {
        agent: "cursor",
        conflictingExporters: ["cursor", "agents"],
        nativeFormat: "cursor",
        formatsToIgnore: ["agents"],
        ignoreFile: ".cursorignore",
        supportsNested: true,
      };
      const message = formatConflictMessage(conflict);
      expect(message).toContain("Cursor");
      expect(message).toContain("cursor, agents");
      expect(message).toContain(".cursorignore");
    });
  });

  describe("formatWarningMessage", () => {
    it("should format warning with agent name and reason", () => {
      const warning = {
        agent: "claude",
        conflictingExporters: ["claude", "agents"],
        reason: "No known ignore mechanism",
      };
      const message = formatWarningMessage(warning);
      expect(message).toContain("Claude");
      expect(message).toContain("claude, agents");
      expect(message).toContain("No known ignore mechanism");
    });
  });
});
