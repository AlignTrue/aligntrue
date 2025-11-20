/**
 * Tests for agent ignore registry
 */

import { describe, it, expect } from "vitest";
import {
  AGENT_IGNORE_REGISTRY,
  AGENTS_WITHOUT_IGNORE,
  getAgentIgnoreSpec,
  hasIgnoreSupport,
  needsIgnoreWarning,
  getAgentsForFormat,
  getConsumableExporters,
} from "../../src/agent-ignore/registry.js";

describe("Agent Ignore Registry", () => {
  describe("AGENT_IGNORE_REGISTRY", () => {
    it("should contain expected agents", () => {
      const agentNames = AGENT_IGNORE_REGISTRY.map((spec) => spec.agent);
      expect(agentNames).toContain("cursor");
      expect(agentNames).toContain("aider");
      expect(agentNames).toContain("gemini");
    });

    it("should have valid ignore file names", () => {
      AGENT_IGNORE_REGISTRY.forEach((spec) => {
        expect(spec.ignoreFile).toMatch(/^\./);
        expect(spec.ignoreFile.length).toBeGreaterThan(1);
      });
    });

    it("should have at least one consumable format per agent", () => {
      AGENT_IGNORE_REGISTRY.forEach((spec) => {
        expect(spec.consumableFormats.length).toBeGreaterThan(0);
      });
    });

    it("should have native format in consumable formats", () => {
      AGENT_IGNORE_REGISTRY.forEach((spec) => {
        expect(spec.consumableFormats).toContain(spec.nativeFormat);
      });
    });
  });

  describe("getAgentIgnoreSpec", () => {
    it("should return spec for known agent", () => {
      const spec = getAgentIgnoreSpec("cursor");
      expect(spec).toBeDefined();
      expect(spec?.agent).toBe("cursor");
      expect(spec?.ignoreFile).toBe(".cursorignore");
    });

    it("should return undefined for unknown agent", () => {
      const spec = getAgentIgnoreSpec("unknown-agent");
      expect(spec).toBeUndefined();
    });

    it("should return correct spec for aider", () => {
      const spec = getAgentIgnoreSpec("aider");
      expect(spec).toBeDefined();
      expect(spec?.ignoreFile).toBe(".aiderignore");
      expect(spec?.supportsNested).toBe(true);
    });
  });

  describe("hasIgnoreSupport", () => {
    it("should return true for agents with ignore support", () => {
      expect(hasIgnoreSupport("cursor")).toBe(true);
      expect(hasIgnoreSupport("aider")).toBe(true);
      expect(hasIgnoreSupport("gemini")).toBe(true);
    });

    it("should return false for agents without ignore support", () => {
      expect(hasIgnoreSupport("claude")).toBe(false);
      expect(hasIgnoreSupport("unknown-agent")).toBe(false);
    });
  });

  describe("needsIgnoreWarning", () => {
    it("should return true when agent without ignore has multiple formats", () => {
      expect(needsIgnoreWarning("claude", ["claude", "agents"])).toBe(true);
    });

    it("should return false when agent without ignore has single format", () => {
      expect(needsIgnoreWarning("claude", ["claude"])).toBe(false);
    });

    it("should return false for agents with ignore support", () => {
      expect(needsIgnoreWarning("cursor", ["cursor", "agents"])).toBe(false);
    });
  });

  describe("getAgentsForFormat", () => {
    it("should return agents that can consume agents format", () => {
      const agents = getAgentsForFormat("agents");
      expect(agents).toContain("cursor");
      expect(agents).toContain("aider");
      expect(agents.length).toBeGreaterThan(2);
    });

    it("should return agents that can consume cursor format", () => {
      const agents = getAgentsForFormat("cursor");
      expect(agents).toContain("cursor");
    });

    it("should return empty array for unknown format", () => {
      const agents = getAgentsForFormat("unknown-format");
      expect(agents).toEqual([]);
    });
  });

  describe("getConsumableExporters", () => {
    it("should return exporters consumable by cursor", () => {
      const exporters = getConsumableExporters("cursor", [
        "cursor",
        "agents",
        "claude",
      ]);
      expect(exporters).toContain("cursor");
      expect(exporters).toContain("agents");
      expect(exporters).not.toContain("claude");
    });

    it("should return empty array for agent without spec", () => {
      const exporters = getConsumableExporters("unknown-agent", [
        "cursor",
        "agents",
      ]);
      expect(exporters).toEqual([]);
    });

    it("should filter exporters correctly", () => {
      const exporters = getConsumableExporters("aider", [
        "aider",
        "agents",
        "cursor",
      ]);
      expect(exporters).toContain("aider");
      expect(exporters).toContain("agents");
      expect(exporters).not.toContain("cursor");
    });
  });

  describe("AGENTS_WITHOUT_IGNORE", () => {
    it("should contain expected agents", () => {
      expect(AGENTS_WITHOUT_IGNORE).toContain("claude");
      expect(AGENTS_WITHOUT_IGNORE).toContain("amazonq");
      expect(AGENTS_WITHOUT_IGNORE).toContain("zed");
    });

    it("should not overlap with agents that have ignore support", () => {
      const withSupport = AGENT_IGNORE_REGISTRY.map((spec) => spec.agent);
      const overlap = AGENTS_WITHOUT_IGNORE.filter((agent) =>
        withSupport.includes(agent),
      );
      expect(overlap).toEqual([]);
    });
  });
});
