/**
 * Tests for team validation module
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  validateTeamConfig,
  validateTeamLockfile,
  validateTeamSources,
  getTeamValidationErrors,
  formatTeamValidationErrors,
} from "../../src/team/validation.js";
import type { AlignTrueConfig } from "../../src/config/index.js";
import * as fs from "fs";

// Mock filesystem
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock allow list parser
vi.mock("../../src/team/allow.js", () => ({
  parseAllowList: vi.fn(),
}));

describe("validateTeamConfig", () => {
  it("returns empty array for solo mode", () => {
    const config: AlignTrueConfig = {
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
    };

    const errors = validateTeamConfig(config);
    expect(errors).toEqual([]);
  });

  it("warns when lockfile not enabled in team mode", () => {
    const config: AlignTrueConfig = {
      version: "1",
      mode: "team",
      modules: { lockfile: false },
      exporters: ["cursor"],
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
    };

    const errors = validateTeamConfig(config);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.type).toBe("warning");
    expect(errors[0]?.message).toContain("Team mode without lockfile");
    expect(errors[0]?.suggestion).toContain("modules:");
    expect(errors[0]?.suggestion).toContain("lockfile: true");
  });

  it("passes when lockfile enabled in team mode", () => {
    const config: AlignTrueConfig = {
      version: "1",
      mode: "team",
      modules: { lockfile: true },
      lockfile: { mode: "soft" },
      exporters: ["cursor"],
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
    };

    const errors = validateTeamConfig(config);
    expect(errors).toEqual([]);
  });

  it("warns when lockfile mode is off", () => {
    const config: AlignTrueConfig = {
      version: "1",
      mode: "team",
      modules: { lockfile: true },
      lockfile: { mode: "off" },
      exporters: ["cursor"],
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
    };

    const errors = validateTeamConfig(config);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.type).toBe("warning");
    expect(errors[0]?.message).toContain("mode is off");
    expect(errors[0]?.suggestion).toContain("soft");
    expect(errors[0]?.suggestion).toContain("strict");
  });

  it("passes when lockfile mode is soft", () => {
    const config: AlignTrueConfig = {
      version: "1",
      mode: "team",
      modules: { lockfile: true },
      lockfile: { mode: "soft" },
      exporters: ["cursor"],
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
    };

    const errors = validateTeamConfig(config);
    expect(errors).toEqual([]);
  });

  it("passes when lockfile mode is strict", () => {
    const config: AlignTrueConfig = {
      version: "1",
      mode: "team",
      modules: { lockfile: true },
      lockfile: { mode: "strict" },
      exporters: ["cursor"],
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
    };

    const errors = validateTeamConfig(config);
    expect(errors).toEqual([]);
  });
});

describe("validateTeamLockfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array for solo mode", () => {
    const config: AlignTrueConfig = {
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
    };

    const errors = validateTeamLockfile(config);
    expect(errors).toEqual([]);
  });

  it("returns empty array when lockfile disabled", () => {
    const config: AlignTrueConfig = {
      version: "1",
      mode: "team",
      modules: { lockfile: false },
      exporters: ["cursor"],
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
    };

    const errors = validateTeamLockfile(config);
    expect(errors).toEqual([]);
  });

  it("warns when lockfile not generated yet", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const config: AlignTrueConfig = {
      version: "1",
      mode: "team",
      modules: { lockfile: true },
      exporters: ["cursor"],
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
    };

    const errors = validateTeamLockfile(config);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.type).toBe("warning");
    expect(errors[0]?.message).toContain("not generated yet");
    expect(errors[0]?.suggestion).toContain("aligntrue sync");
  });

  it("passes when lockfile exists", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const config: AlignTrueConfig = {
      version: "1",
      mode: "team",
      modules: { lockfile: true },
      exporters: ["cursor"],
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
    };

    const errors = validateTeamLockfile(config);
    expect(errors).toEqual([]);
  });

  it("uses custom lockfile path when provided", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const config: AlignTrueConfig = {
      version: "1",
      mode: "team",
      modules: { lockfile: true },
      exporters: ["cursor"],
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
    };

    const errors = validateTeamLockfile(config, "custom/lockfile.json");
    expect(fs.existsSync).toHaveBeenCalledWith("custom/lockfile.json");
    expect(errors).toHaveLength(1);
  });
});

describe("validateTeamSources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array for solo mode", () => {
    const config: AlignTrueConfig = {
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
    };

    const errors = validateTeamSources(config);
    expect(errors).toEqual([]);
  });

  it("returns empty array when no sources configured", () => {
    const config: AlignTrueConfig = {
      version: "1",
      mode: "team",
      modules: { lockfile: true },
      exporters: ["cursor"],
      sources: [],
    };

    const errors = validateTeamSources(config);
    expect(errors).toEqual([]);
  });

  it("warns when sources configured but no allow list", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const config: AlignTrueConfig = {
      version: "1",
      mode: "team",
      modules: { lockfile: true },
      exporters: ["cursor"],
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
    };

    const errors = validateTeamSources(config);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.type).toBe("warning");
    expect(errors[0]?.message).toContain("no allow list");
    expect(errors[0]?.suggestion).toContain("aligntrue team approve");
  });

  it("warns when allow list exists but is empty", async () => {
    const { parseAllowList } = await import("../../src/team/allow.js");
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(parseAllowList).mockReturnValue({ sources: [] });

    const config: AlignTrueConfig = {
      version: "1",
      mode: "team",
      modules: { lockfile: true },
      exporters: ["cursor"],
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
    };

    const errors = validateTeamSources(config);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.type).toBe("warning");
    expect(errors[0]?.message).toContain("empty");
  });

  it("warns when git source not in allow list", async () => {
    const { parseAllowList } = await import("../../src/team/allow.js");
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(parseAllowList).mockReturnValue({
      sources: [{ type: "hash", value: "sha256:abc123..." }],
    });

    const config: AlignTrueConfig = {
      version: "1",
      mode: "team",
      modules: { lockfile: true },
      exporters: ["cursor"],
      sources: [{ type: "git", url: "https://github.com/example/rules.git" }],
    };

    const errors = validateTeamSources(config);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.type).toBe("warning");
    expect(errors[0]?.message).toContain("not in allow list");
    expect(errors[0]?.message).toContain("git:");
    expect(errors[0]?.suggestion).toContain("aligntrue team approve");
  });

  it("passes when git source in allow list", async () => {
    const { parseAllowList } = await import("../../src/team/allow.js");
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(parseAllowList).mockReturnValue({
      sources: [{ type: "id", value: "https://github.com/example/rules.git" }],
    });

    const config: AlignTrueConfig = {
      version: "1",
      mode: "team",
      modules: { lockfile: true },
      exporters: ["cursor"],
      sources: [{ type: "git", url: "https://github.com/example/rules.git" }],
    };

    const errors = validateTeamSources(config);
    expect(errors).toEqual([]);
  });

  it("returns error when allow list parse fails", async () => {
    const { parseAllowList } = await import("../../src/team/allow.js");
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(parseAllowList).mockImplementation(() => {
      throw new Error("Invalid YAML");
    });

    const config: AlignTrueConfig = {
      version: "1",
      mode: "team",
      modules: { lockfile: true },
      exporters: ["cursor"],
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
    };

    const errors = validateTeamSources(config);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.type).toBe("error");
    expect(errors[0]?.message).toContain("Failed to parse");
    expect(errors[0]?.suggestion).toContain("Invalid YAML");
  });
});

describe("getTeamValidationErrors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns valid=true for solo mode", () => {
    const config: AlignTrueConfig = {
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
    };

    const result = getTeamValidationErrors(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("aggregates multiple warnings", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const config: AlignTrueConfig = {
      version: "1",
      mode: "team",
      modules: { lockfile: false },
      exporters: ["cursor"],
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
    };

    const result = getTeamValidationErrors(config);
    expect(result.valid).toBe(true); // warnings don't invalidate
    expect(result.errors).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(
      result.warnings.some((w) => w.message.includes("without lockfile")),
    ).toBe(true);
  });

  it("separates errors and warnings correctly", async () => {
    const { parseAllowList } = await import("../../src/team/allow.js");
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(parseAllowList).mockImplementation(() => {
      throw new Error("Parse error");
    });

    const config: AlignTrueConfig = {
      version: "1",
      mode: "team",
      modules: { lockfile: false },
      exporters: ["cursor"],
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
    };

    const result = getTeamValidationErrors(config);
    expect(result.valid).toBe(false); // has errors
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe("formatTeamValidationErrors", () => {
  it("formats errors with suggestions", () => {
    const result = {
      valid: false,
      errors: [
        {
          type: "error" as const,
          message: "Test error",
          suggestion: "Fix it like this",
        },
      ],
      warnings: [],
    };

    const formatted = formatTeamValidationErrors(result);
    expect(formatted).toContain("Team Mode Validation Errors:");
    expect(formatted).toContain("ERROR: Test error");
    expect(formatted).toContain("→ Fix it like this");
  });

  it("formats warnings with suggestions", () => {
    const result = {
      valid: true,
      errors: [],
      warnings: [
        {
          type: "warning" as const,
          message: "Test warning",
          suggestion: "Consider this",
        },
      ],
    };

    const formatted = formatTeamValidationErrors(result);
    expect(formatted).toContain("Team Mode Warnings:");
    expect(formatted).toContain("WARNING: Test warning");
    expect(formatted).toContain("→ Consider this");
  });

  it("formats both errors and warnings", () => {
    const result = {
      valid: false,
      errors: [
        {
          type: "error" as const,
          message: "Error message",
          suggestion: "Error fix",
        },
      ],
      warnings: [
        {
          type: "warning" as const,
          message: "Warning message",
          suggestion: "Warning fix",
        },
      ],
    };

    const formatted = formatTeamValidationErrors(result);
    expect(formatted).toContain("Validation Errors:");
    expect(formatted).toContain("ERROR: Error message");
    expect(formatted).toContain("Warnings:");
    expect(formatted).toContain("WARNING: Warning message");
  });

  it("handles multiline suggestions correctly", () => {
    const result = {
      valid: false,
      errors: [
        {
          type: "error" as const,
          message: "Multi-line error",
          suggestion: "Line 1\nLine 2\nLine 3",
        },
      ],
      warnings: [],
    };

    const formatted = formatTeamValidationErrors(result);
    expect(formatted).toContain("→ Line 1");
    expect(formatted).toContain("  Line 2");
    expect(formatted).toContain("  Line 3");
  });
});
