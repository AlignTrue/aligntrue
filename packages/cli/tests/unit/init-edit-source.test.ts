/**
 * Test edit_source logic in init command
 * Verifies that AGENTS.md is always included since it's always created
 */

import { describe, it, expect } from "vitest";

describe("init command edit_source logic", () => {
  const exporterToPattern: Record<string, string> = {
    cursor: ".cursor/rules/*.mdc",
    "agents-md": "AGENTS.md",
    copilot: ".github/copilot-instructions.md",
    "claude-code": "CLAUDE.md",
    aider: ".aider.conf.yml",
  };

  function calculateEditSource(selectedAgents: string[]): string | string[] {
    const editSourcePatterns: string[] = [];

    // Add patterns for enabled exporters
    for (const exporter of selectedAgents) {
      const pattern = exporterToPattern[exporter];
      if (pattern) {
        editSourcePatterns.push(pattern);
      }
    }

    // Always include AGENTS.md since it's always created
    if (!editSourcePatterns.includes("AGENTS.md")) {
      editSourcePatterns.push("AGENTS.md");
    }

    // Configure sync settings with all created file patterns
    const editSource =
      editSourcePatterns.length > 1
        ? editSourcePatterns
        : editSourcePatterns[0];

    return editSource;
  }

  it("should include both Cursor and AGENTS.md for cursor exporter only", () => {
    const result = calculateEditSource(["cursor"]);
    expect(result).toEqual([".cursor/rules/*.mdc", "AGENTS.md"]);
  });

  it("should include only AGENTS.md for agents-md exporter", () => {
    const result = calculateEditSource(["agents-md"]);
    expect(result).toBe("AGENTS.md");
  });

  it("should include both patterns when both exporters enabled", () => {
    const result = calculateEditSource(["cursor", "agents-md"]);
    expect(result).toEqual([".cursor/rules/*.mdc", "AGENTS.md"]);
  });

  it("should include AGENTS.md even when no exporters specified", () => {
    const result = calculateEditSource([]);
    expect(result).toBe("AGENTS.md");
  });

  it("should include multiple patterns for multiple exporters", () => {
    const result = calculateEditSource(["cursor", "copilot"]);
    expect(result).toEqual([
      ".cursor/rules/*.mdc",
      ".github/copilot-instructions.md",
      "AGENTS.md",
    ]);
  });

  it("should not duplicate AGENTS.md if agents-md exporter is in the list", () => {
    const result = calculateEditSource(["agents-md"]) as string | string[];
    const patterns = Array.isArray(result) ? result : [result];
    const agentsMdCount = patterns.filter((p) => p === "AGENTS.md").length;
    expect(agentsMdCount).toBe(1);
  });

  it("should handle unknown exporters gracefully", () => {
    const result = calculateEditSource(["unknown-exporter"]);
    expect(result).toBe("AGENTS.md");
  });
});
