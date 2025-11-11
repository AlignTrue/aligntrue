/**
 * Tests for team mode validation
 */

import { describe, it, expect } from "vitest";
import {
  validateTeamMode,
  validateScopeConfig,
  detectScopeConflicts,
} from "../../src/validation/team-mode.js";
import type { AlignTrueConfig } from "../../src/config/index.js";

describe("validateTeamMode", () => {
  it("should pass validation for solo mode", () => {
    const config: AlignTrueConfig = {
      mode: "solo",
      exporters: ["cursor"],
    };

    const result = validateTeamMode(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail when personal scope uses repo storage in team mode", () => {
    const config: AlignTrueConfig = {
      mode: "team",
      exporters: ["cursor"],
      storage: {
        personal: {
          type: "repo",
        },
      },
    };

    const result = validateTeamMode(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain(
      "Personal rules cannot use 'repo' storage",
    );
  });

  it("should pass when personal scope uses local storage in team mode", () => {
    const config: AlignTrueConfig = {
      mode: "team",
      exporters: ["cursor"],
      storage: {
        personal: {
          type: "local",
        },
      },
    };

    const result = validateTeamMode(config);
    expect(result.valid).toBe(true);
  });

  it("should pass when personal scope uses remote storage in team mode", () => {
    const config: AlignTrueConfig = {
      mode: "team",
      exporters: ["cursor"],
      storage: {
        personal: {
          type: "remote",
          url: "git@github.com:user/repo.git",
        },
      },
    };

    const result = validateTeamMode(config);
    expect(result.valid).toBe(true);
  });

  it("should fail when remote storage is missing URL", () => {
    const config: AlignTrueConfig = {
      mode: "team",
      exporters: ["cursor"],
      storage: {
        personal: {
          type: "remote",
        },
      },
    };

    const result = validateTeamMode(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain("requires url");
  });

  it("should validate resources configuration", () => {
    const config: AlignTrueConfig = {
      mode: "team",
      exporters: ["cursor"],
      resources: {
        rules: {
          scopes: {
            team: {
              sections: "*",
            },
            personal: {
              sections: ["My Notes"],
            },
          },
          storage: {
            team: {
              type: "repo",
            },
            personal: {
              type: "local",
            },
          },
        },
      },
    };

    const result = validateTeamMode(config);
    expect(result.valid).toBe(true);
  });

  it("should fail when resources scope uses invalid storage", () => {
    const config: AlignTrueConfig = {
      mode: "team",
      exporters: ["cursor"],
      resources: {
        rules: {
          scopes: {
            personal: {
              sections: ["My Notes"],
            },
          },
          storage: {
            personal: {
              type: "repo",
            },
          },
        },
      },
    };

    const result = validateTeamMode(config);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) =>
        e.message.includes("Personal scope cannot use 'repo' storage"),
      ),
    ).toBe(true);
  });
});

describe("validateScopeConfig", () => {
  it("should pass for valid scope configuration", () => {
    const scopes = {
      team: {
        sections: ["Security", "Compliance"],
      },
      personal: {
        sections: "*",
      },
    };

    const result = validateScopeConfig(scopes);
    expect(result.valid).toBe(true);
  });

  it("should fail when scope is missing sections", () => {
    const scopes = {
      team: {},
    };

    const result = validateScopeConfig(scopes);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain("must have sections defined");
  });
});

describe("detectScopeConflicts", () => {
  it("should detect no conflicts when scopes are distinct", () => {
    const scopes = {
      team: {
        sections: ["Security", "Compliance"],
      },
      personal: {
        sections: ["My Notes", "Preferences"],
      },
    };

    const conflicts = detectScopeConflicts(scopes);
    expect(conflicts).toHaveLength(0);
  });

  it("should detect conflicts when same section in multiple scopes", () => {
    const scopes = {
      team: {
        sections: ["Security", "Shared"],
      },
      personal: {
        sections: ["Shared", "My Notes"],
      },
    };

    const conflicts = detectScopeConflicts(scopes);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.section).toBe("Shared");
    expect(conflicts[0]?.scopes).toContain("team");
    expect(conflicts[0]?.scopes).toContain("personal");
  });

  it("should detect conflicts with wildcard scope", () => {
    const scopes = {
      team: {
        sections: "*",
      },
      personal: {
        sections: ["My Notes"],
      },
    };

    const conflicts = detectScopeConflicts(scopes);
    // Wildcard conflicts with any specific section
    expect(conflicts.length).toBeGreaterThan(0);
  });

  it("should handle empty scopes", () => {
    const scopes = {};

    const conflicts = detectScopeConflicts(scopes);
    expect(conflicts).toHaveLength(0);
  });
});
