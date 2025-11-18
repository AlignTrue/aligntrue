/**
 * Tests for agent detection utilities
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  detectAgents,
  detectNewAgents,
  getAgentDisplayName,
  getAllAgents,
} from "../../src/utils/detect-agents.js";

describe("detectAgents", () => {
  let testDir: string;

  beforeEach(() => {
    // Create unique temp directory for each test
    testDir = mkdtempSync(join(tmpdir(), "aligntrue-test-"));
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("detects cursor when .cursor directory exists", () => {
    mkdirSync(join(testDir, ".cursor", "rules"), { recursive: true });

    const result = detectAgents(testDir);

    expect(result.detected).toContain("cursor");
    expect(result.displayNames.get("cursor")).toBe("Cursor");
  });

  it("detects agents when AGENTS.md exists", () => {
    writeFileSync(join(testDir, "AGENTS.md"), "# Test rules");

    const result = detectAgents(testDir);

    expect(result.detected).toContain("agents");
  });

  it("detects multiple agents simultaneously", () => {
    mkdirSync(join(testDir, ".cursor", "rules"), { recursive: true });
    writeFileSync(join(testDir, "AGENTS.md"), "# Test rules");
    mkdirSync(join(testDir, ".vscode"), { recursive: true });
    writeFileSync(join(testDir, ".vscode", "mcp.json"), "{}");

    const result = detectAgents(testDir);

    expect(result.detected).toContain("cursor");
    expect(result.detected).toContain("agents");
    expect(result.detected).toContain("vscode-mcp");
  });

  it("returns empty array when no agents detected", () => {
    const result = detectAgents(testDir);

    expect(result.detected).toEqual([]);
  });

  it("provides display names for all detected agents", () => {
    mkdirSync(join(testDir, ".cursor", "rules"), { recursive: true });
    mkdirSync(join(testDir, ".windsurf"), { recursive: true });
    writeFileSync(join(testDir, ".windsurf", "mcp_config.json"), "{}");

    const result = detectAgents(testDir);

    expect(result.displayNames.get("cursor")).toBe("Cursor");
    expect(result.displayNames.get("windsurf-mcp")).toBe("Windsurf MCP");
  });
});

describe("detectNewAgents", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "aligntrue-test-"));
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("returns only agents not in config", () => {
    mkdirSync(join(testDir, ".cursor", "rules"), { recursive: true });
    writeFileSync(join(testDir, "AGENTS.md"), "# Test");

    const newAgents = detectNewAgents(testDir, ["cursor"], []);

    expect(newAgents).toHaveLength(1);
    expect(newAgents[0].name).toBe("agents");
    expect(newAgents[0].displayName).toBe("Universal AGENTS.md");
  });

  it("excludes ignored agents", () => {
    mkdirSync(join(testDir, ".cursor", "rules"), { recursive: true });
    writeFileSync(join(testDir, "AGENTS.md"), "# Test");

    const newAgents = detectNewAgents(testDir, [], ["cursor"]);

    expect(newAgents).toHaveLength(1);
    expect(newAgents[0].name).toBe("agents");
  });

  it("returns empty array when all detected agents are enabled", () => {
    mkdirSync(join(testDir, ".cursor", "rules"), { recursive: true });
    writeFileSync(join(testDir, "AGENTS.md"), "# Test");

    const newAgents = detectNewAgents(testDir, ["cursor", "agents"], []);

    expect(newAgents).toEqual([]);
  });

  it("returns empty array when all detected agents are ignored", () => {
    mkdirSync(join(testDir, ".cursor", "rules"), { recursive: true });
    writeFileSync(join(testDir, "AGENTS.md"), "# Test");

    const newAgents = detectNewAgents(testDir, [], ["cursor", "agents"]);

    expect(newAgents).toEqual([]);
  });

  it("includes file paths for display", () => {
    mkdirSync(join(testDir, ".cursor", "rules"), { recursive: true });

    const newAgents = detectNewAgents(testDir, [], []);

    expect(newAgents).toHaveLength(1);
    expect(newAgents[0].filePath).toBeTruthy();
    expect(newAgents[0].filePath).toBe(".cursor/rules/");
  });

  it("filters both config and ignored list", () => {
    mkdirSync(join(testDir, ".cursor", "rules"), { recursive: true });
    writeFileSync(join(testDir, "AGENTS.md"), "# Test");
    mkdirSync(join(testDir, ".vscode"), { recursive: true });
    writeFileSync(join(testDir, ".vscode", "mcp.json"), "{}");

    const newAgents = detectNewAgents(testDir, ["cursor"], ["agents"]);

    expect(newAgents).toHaveLength(1);
    expect(newAgents[0].name).toBe("vscode-mcp");
  });

  it("handles empty current exporters and ignored agents", () => {
    mkdirSync(join(testDir, ".cursor", "rules"), { recursive: true });

    const newAgents = detectNewAgents(testDir, [], []);

    expect(newAgents.length).toBeGreaterThan(0);
    expect(newAgents[0].name).toBe("cursor");
  });

  it("provides display name for each new agent", () => {
    mkdirSync(join(testDir, ".cursor", "rules"), { recursive: true });

    const newAgents = detectNewAgents(testDir, [], []);

    expect(newAgents[0].displayName).toBe("Cursor");
  });
});

describe("getAgentDisplayName", () => {
  it("returns display name for known agent", () => {
    expect(getAgentDisplayName("cursor")).toBe("Cursor");
    expect(getAgentDisplayName("agents")).toBe("Universal AGENTS.md");
    expect(getAgentDisplayName("windsurf-mcp")).toBe("Windsurf MCP");
  });

  it("returns agent name if display name not found", () => {
    expect(getAgentDisplayName("unknown-agent")).toBe("unknown-agent");
  });
});

describe("getAllAgents", () => {
  it("returns array of all available agent names", () => {
    const agents = getAllAgents();

    expect(agents).toBeInstanceOf(Array);
    expect(agents.length).toBeGreaterThan(0);
    expect(agents).toContain("cursor");
    expect(agents).toContain("agents");
    expect(agents).toContain("vscode-mcp");
  });

  it("returns consistent list across calls", () => {
    const agents1 = getAllAgents();
    const agents2 = getAllAgents();

    expect(agents1).toEqual(agents2);
  });
});
