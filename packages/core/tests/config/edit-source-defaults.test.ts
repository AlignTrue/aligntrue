/**
 * Tests for edit_source defaults in config
 * Validates inclusive defaults based on enabled exporters
 */

import { describe, it, expect } from "vitest";
import { applyDefaults } from "../../src/config/index.js";
import type { AlignTrueConfig } from "../../src/config/index.js";

describe("edit_source defaults", () => {
  it("should default to AGENTS.md when no exporters configured", () => {
    const config: Partial<AlignTrueConfig> = {
      mode: "solo",
      exporters: [],
    };

    const result = applyDefaults(config as AlignTrueConfig);

    expect(result.sync?.edit_source).toBe("AGENTS.md");
  });

  it("should set single pattern for single exporter (cursor)", () => {
    const config: Partial<AlignTrueConfig> = {
      mode: "solo",
      exporters: ["cursor"],
    };

    const result = applyDefaults(config as AlignTrueConfig);

    expect(result.sync?.edit_source).toBe(".cursor/rules/*.mdc");
  });

  it("should set single pattern for single exporter (agents)", () => {
    const config: Partial<AlignTrueConfig> = {
      mode: "solo",
      exporters: ["agents"],
    };

    const result = applyDefaults(config as AlignTrueConfig);

    expect(result.sync?.edit_source).toBe("AGENTS.md");
  });

  it("should set array of patterns for multiple exporters", () => {
    const config: Partial<AlignTrueConfig> = {
      mode: "solo",
      exporters: ["cursor", "agents"],
    };

    const result = applyDefaults(config as AlignTrueConfig);

    expect(Array.isArray(result.sync?.edit_source)).toBe(true);
    expect(result.sync?.edit_source).toEqual([
      ".cursor/rules/*.mdc",
      "AGENTS.md",
    ]);
  });

  it("should include all patterns for three exporters", () => {
    const config: Partial<AlignTrueConfig> = {
      mode: "solo",
      exporters: ["cursor", "agents", "copilot"],
    };

    const result = applyDefaults(config as AlignTrueConfig);

    expect(Array.isArray(result.sync?.edit_source)).toBe(true);
    expect(result.sync?.edit_source).toEqual([
      ".cursor/rules/*.mdc",
      "AGENTS.md",
      ".github/copilot-instructions.md",
    ]);
  });

  it("should deduplicate patterns if multiple exporters use same pattern", () => {
    const config: Partial<AlignTrueConfig> = {
      mode: "solo",
      exporters: ["agents", "agents"], // duplicate
    };

    const result = applyDefaults(config as AlignTrueConfig);

    expect(result.sync?.edit_source).toBe("AGENTS.md");
  });

  it("should not override explicitly set edit_source", () => {
    const config: Partial<AlignTrueConfig> = {
      mode: "solo",
      exporters: ["cursor", "agents"],
      sync: {
        edit_source: "any_agent_file",
      },
    };

    const result = applyDefaults(config as AlignTrueConfig);

    expect(result.sync?.edit_source).toBe("any_agent_file");
  });

  it("should work with unknown exporters (skip them)", () => {
    const config: Partial<AlignTrueConfig> = {
      mode: "solo",
      exporters: ["cursor", "unknown-exporter"],
    };

    const result = applyDefaults(config as AlignTrueConfig);

    expect(result.sync?.edit_source).toBe(".cursor/rules/*.mdc");
  });
});
