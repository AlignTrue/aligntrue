import { describe, it, expect } from "vitest";

describe("init command edit_source logic", () => {
  const exporterToPattern: Record<string, string> = {
    cursor: ".cursor/rules/*.mdc",
    agents: "AGENTS.md",
    copilot: ".github/copilot-instructions.md",
    claude: "CLAUDE.md",
    aider: ".aider.conf.yml",
  };

  function calculateEditSource(
    selectedAgents: string[],
    options: { createAgentsTemplate?: boolean; importedAgents?: string[] } = {},
  ): string | string[] | undefined {
    const patterns = new Set<string>();

    selectedAgents.forEach((agent) => {
      const pattern = exporterToPattern[agent];
      if (pattern) {
        patterns.add(pattern);
      }
    });

    options.importedAgents?.forEach((agent) => {
      const pattern = exporterToPattern[agent];
      if (pattern) {
        patterns.add(pattern);
      }
    });

    if (options.createAgentsTemplate) {
      patterns.add("AGENTS.md");
    }

    const values = Array.from(patterns);
    if (values.length === 0) {
      return undefined;
    }
    return values.length === 1 ? values[0] : values;
  }

  it("includes cursor pattern when cursor exporter enabled", () => {
    const result = calculateEditSource(["cursor"]);
    expect(result).toBe(".cursor/rules/*.mdc");
  });

  it("adds AGENTS.md when starter template is created", () => {
    const result = calculateEditSource(["cursor"], {
      createAgentsTemplate: true,
    }) as string[];
    expect(result).toEqual([".cursor/rules/*.mdc", "AGENTS.md"]);
  });

  it("adds AGENTS.md when agents file is imported", () => {
    const result = calculateEditSource(["cursor"], {
      importedAgents: ["agents"],
    }) as string[];
    expect(result).toContain("AGENTS.md");
  });

  it("returns undefined when no editable sources exist", () => {
    const result = calculateEditSource(["unknown"]);
    expect(result).toBeUndefined();
  });
});
