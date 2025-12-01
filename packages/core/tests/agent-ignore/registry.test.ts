/**
 * Tests for agent-ignore registry
 */

import { describe, it, expect } from "vitest";
import {
  AGENT_IGNORE_REGISTRY,
  getAgentIgnoreSpec,
  getConsumableExporters,
} from "../../src/agent-ignore/registry.js";

describe("Agent Ignore Registry", () => {
  describe("Cursor agent", () => {
    it("supports cursor, agents, and claude formats", () => {
      const spec = getAgentIgnoreSpec("cursor");
      expect(spec).toBeDefined();
      expect(spec?.consumableFormats).toContain("cursor");
      expect(spec?.consumableFormats).toContain("agents");
      expect(spec?.consumableFormats).toContain("claude");
    });

    it("uses .cursorignore as ignore file", () => {
      const spec = getAgentIgnoreSpec("cursor");
      expect(spec?.ignoreFile).toBe(".cursorignore");
    });

    it("supports nested ignore files", () => {
      const spec = getAgentIgnoreSpec("cursor");
      expect(spec?.supportsNested).toBe(true);
    });
  });

  describe("Consumable exporters", () => {
    it("returns cursor and agents exporters when both are enabled", () => {
      const exporters = getConsumableExporters("cursor", ["cursor", "agents"]);
      expect(exporters).toContain("cursor");
      expect(exporters).toContain("agents");
    });

    it("includes claude when cursor and claude exporters are enabled", () => {
      const exporters = getConsumableExporters("cursor", ["cursor", "claude"]);
      expect(exporters).toContain("cursor");
      expect(exporters).toContain("claude");
    });

    it("handles all three cursor consumable formats", () => {
      const exporters = getConsumableExporters("cursor", [
        "cursor",
        "agents",
        "claude",
      ]);
      expect(exporters).toHaveLength(3);
      expect(exporters).toContain("cursor");
      expect(exporters).toContain("agents");
      expect(exporters).toContain("claude");
    });
  });

  describe("Registry integrity", () => {
    it("has valid entries with required fields", () => {
      for (const entry of AGENT_IGNORE_REGISTRY) {
        expect(entry.agent).toBeDefined();
        expect(entry.ignoreFile).toBeDefined();
        expect(entry.consumableFormats).toBeDefined();
        expect(entry.nativeFormat).toBeDefined();
        expect(Array.isArray(entry.consumableFormats)).toBe(true);
        expect(entry.consumableFormats.length).toBeGreaterThan(0);
      }
    });

    it("has unique agent names", () => {
      const agents = AGENT_IGNORE_REGISTRY.map((e) => e.agent);
      const uniqueAgents = new Set(agents);
      expect(uniqueAgents.size).toBe(agents.length);
    });

    it("has native format in consumable formats", () => {
      for (const entry of AGENT_IGNORE_REGISTRY) {
        expect(entry.consumableFormats).toContain(entry.nativeFormat);
      }
    });
  });
});
