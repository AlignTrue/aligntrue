/**
 * Tests for team mode validation
 */

import { describe, it, expect } from "vitest";
import { validateTeamMode } from "../../src/validation/team-mode.js";
import type { AlignTrueConfig } from "../../src/config/index.js";

describe("validateTeamMode", () => {
  it("should pass validation for solo mode", () => {
    const config: AlignTrueConfig = {
      mode: "solo",
      version: "1",
      exporters: ["cursor"],
    };

    const result = validateTeamMode(config);
    expect(result.valid).toBe(true);
    expect(result.errors || []).toHaveLength(0);
  });

  it("should pass validation for team mode", () => {
    const config: AlignTrueConfig = {
      mode: "team",
      version: "1",
      exporters: ["cursor"],
    };

    const result = validateTeamMode(config);
    expect(result.valid).toBe(true);
    expect(result.errors || []).toHaveLength(0);
  });

  it("should pass validation for enterprise mode", () => {
    const config: AlignTrueConfig = {
      mode: "enterprise",
      version: "1",
      exporters: ["cursor"],
    };

    const result = validateTeamMode(config);
    expect(result.valid).toBe(true);
    expect(result.errors || []).toHaveLength(0);
  });
});
