import { describe, it, expect } from "vitest";
import {
  validateAlignSchema,
  validateAlignIntegrity,
  validateAlign,
} from "../src/validator.js";
import { computeAlignHash } from "../src/canonicalize.js";

describe("validateAlignSchema (v1)", () => {
  const validSoloPack = {
    id: "test-valid",
    version: "1.0.0",
    spec_version: "1",
    sections: [
      {
        heading: "Testing",
        level: 2,
        content: "Ensure tests exist for all code changes",
        fingerprint: "testing-abc123",
      },
    ],
  };

  const validTeamPack = {
    id: "team-pack",
    version: "1.0.0",
    spec_version: "1",
    summary: "Team pack",
    owner: "mycompany/platform",
    source: "github.com/mycompany/rules",
    source_sha: "abc123def456",
    sections: [
      {
        heading: "Testing",
        level: 2,
        content: "Team testing guidelines",
        fingerprint: "team-testing-xyz",
      },
    ],
  };

  it("validates a minimal solo pack", () => {
    const result = validateAlignSchema(validSoloPack);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it("validates a team pack with provenance", () => {
    const result = validateAlignSchema(validTeamPack, { mode: "team" });
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it("rejects pack with missing required field (id)", () => {
    const invalid = { ...validSoloPack };
    delete (invalid as Record<string, unknown>).id;

    const result = validateAlignSchema(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it("rejects pack with invalid version format", () => {
    const invalid = { ...validSoloPack, version: "not-semver" };

    const result = validateAlignSchema(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it("rejects pack with wrong spec_version", () => {
    const invalid = { ...validSoloPack, spec_version: "0" };

    const result = validateAlignSchema(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it("rejects pack with summary too long", () => {
    const invalid = { ...validTeamPack, summary: "x".repeat(201) };

    const result = validateAlignSchema(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it("rejects pack with empty sections array", () => {
    const invalid = { ...validSoloPack, sections: [] };

    const result = validateAlignSchema(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  // Rule-specific validation tests removed in sections-only refactor (implemented)
  // Check type validation deferred to future when rules format is reintroduced

  it("rejects integrity with wrong algo", () => {
    const invalid = {
      ...validSoloPack,
      integrity: {
        algo: "sha256",
        value: "<computed>",
      },
    };

    const result = validateAlignSchema(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it("rejects integrity with invalid hash format", () => {
    const invalid = {
      ...validSoloPack,
      integrity: {
        algo: "jcs-sha256",
        value: "not-a-valid-hash",
      },
    };

    const result = validateAlignSchema(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it("accepts integrity with valid hex hash", () => {
    const align = {
      ...validSoloPack,
      integrity: {
        algo: "jcs-sha256",
        value: "a".repeat(64),
      },
    };

    const result = validateAlignSchema(align);
    expect(result.valid).toBe(true);
  });
});

describe("validateAlignIntegrity", () => {
  const validAlignYaml = `
id: "test-integrity"
version: "1.0.0"
spec_version: "1"
sections:
  - heading: "Testing"
    level: 2
    content: "Ensure tests exist for all code changes"
    fingerprint: "testing-abc123"
integrity:
  algo: "jcs-sha256"
  value: "PLACEHOLDER"
`;

  it("validates matching hash", () => {
    const correctHash = computeAlignHash(validAlignYaml);
    const alignWithHash = validAlignYaml.replace("PLACEHOLDER", correctHash);

    const result = validateAlignIntegrity(alignWithHash);
    expect(result.valid).toBe(true);
    expect(result.storedHash).toBe(correctHash);
    expect(result.computedHash).toBe(correctHash);
  });

  it("detects mismatched hash", () => {
    const wrongHash = "a".repeat(64);
    const alignWithWrongHash = validAlignYaml.replace("PLACEHOLDER", wrongHash);

    const result = validateAlignIntegrity(alignWithWrongHash);
    expect(result.valid).toBe(false);
    expect(result.storedHash).toBe(wrongHash);
    expect(result.computedHash).not.toBe(wrongHash);
  });

  it("accepts <computed> placeholder during authoring", () => {
    const alignWithPlaceholder = validAlignYaml.replace(
      "PLACEHOLDER",
      "<computed>",
    );

    const result = validateAlignIntegrity(alignWithPlaceholder);
    expect(result.valid).toBe(true);
    expect(result.storedHash).toBe("<computed>");
    expect(result.computedHash).toBe("<computed>");
  });

  it("handles pack without integrity field (solo mode)", () => {
    const soloYaml = `
id: "test-solo"
version: "1.0.0"
spec_version: "1"
sections:
  - heading: "Guidelines"
    level: 2
    content: "Solo development guidelines"
    fingerprint: "guidelines-xyz"
`;

    // Solo mode doesn't require integrity, so should compute hash successfully
    const result = validateAlignIntegrity(soloYaml);
    expect(result.valid).toBe(true);
  });

  it("handles parse errors gracefully", () => {
    const invalidYaml = "this is not: valid: yaml: data";

    const result = validateAlignIntegrity(invalidYaml);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe("validateAlign", () => {
  const validAlignYaml = `
id: "test-combined"
version: "1.0.0"
spec_version: "1"
summary: "Test pack for combined validation"
sections:
  - heading: "Quality"
    level: 2
    content: "Enforce code quality standards"
    fingerprint: "quality-def456"
integrity:
  algo: "jcs-sha256"
  value: "PLACEHOLDER"
`;

  it("validates both schema and integrity for valid pack", () => {
    const correctHash = computeAlignHash(validAlignYaml);
    const alignWithHash = validAlignYaml.replace("PLACEHOLDER", correctHash);

    const result = validateAlign(alignWithHash);
    expect(result.schema.valid).toBe(true);
    expect(result.integrity.valid).toBe(true);
  });

  it("detects schema errors", () => {
    const invalidYaml = validAlignYaml.replace(
      'spec_version: "1"',
      'spec_version: "99"',
    );

    const result = validateAlign(invalidYaml);
    expect(result.schema.valid).toBe(false);
    expect(result.schema.errors).toBeDefined();
  });

  it("detects integrity errors", () => {
    const wrongHash = "b".repeat(64);
    const alignWithWrongHash = validAlignYaml.replace("PLACEHOLDER", wrongHash);

    const result = validateAlign(alignWithWrongHash);
    expect(result.schema.valid).toBe(true);
    expect(result.integrity.valid).toBe(false);
  });

  it("handles packs with <computed> placeholder", () => {
    const alignWithPlaceholder = validAlignYaml.replace(
      "PLACEHOLDER",
      "<computed>",
    );

    const result = validateAlign(alignWithPlaceholder);
    expect(result.schema.valid).toBe(true);
    expect(result.integrity.valid).toBe(true);
  });
});

describe("provenance fields validation", () => {
  it("accepts pack with full provenance in team mode", () => {
    const pack = {
      id: "team-pack",
      version: "1.0.0",
      spec_version: "1",
      summary: "Team pack",
      owner: "mycompany/platform",
      source: "github.com/mycompany/rules",
      source_sha: "abc123def456",
      sections: [
        {
          heading: "Testing",
          level: 2,
          content: "Team testing standards",
          fingerprint: "testing-abc",
        },
      ],
    };

    const result = validateAlignSchema(pack, { mode: "team" });
    expect(result.valid).toBe(true);
  });

  it("allows missing provenance in solo mode", () => {
    const pack = {
      id: "solo-pack",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Guidelines",
          level: 2,
          content: "Solo development guidelines",
          fingerprint: "guidelines-xyz",
        },
      ],
    };

    const result = validateAlignSchema(pack, { mode: "solo" });
    expect(result.valid).toBe(true);
  });

  it("requires summary in team mode", () => {
    const pack = {
      id: "team-pack",
      version: "1.0.0",
      spec_version: "1",
      owner: "mycompany/platform",
      source: "github.com/mycompany/rules",
      source_sha: "abc123",
      sections: [
        {
          heading: "Testing",
          level: 2,
          content: "Team standards",
          fingerprint: "team-abc",
        },
      ],
      // missing summary
    };

    const result = validateAlignSchema(pack, { mode: "team" });
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.path === "/summary")).toBe(true);
  });

  it("requires owner when source is specified in team mode", () => {
    const pack = {
      id: "team-pack",
      version: "1.0.0",
      spec_version: "1",
      summary: "Test",
      source: "github.com/test/rules",
      source_sha: "abc123",
      // missing owner
      sections: [
        {
          heading: "Code",
          level: 2,
          content: "Code standards",
          fingerprint: "code-xyz",
        },
      ],
    };

    const result = validateAlignSchema(pack, { mode: "team" });
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.path === "/owner")).toBe(true);
  });

  it("requires source_sha when source is specified in team mode", () => {
    const pack = {
      id: "team-pack",
      version: "1.0.0",
      spec_version: "1",
      summary: "Test",
      owner: "mycompany/platform",
      source: "github.com/test/rules",
      // missing source_sha
      sections: [
        {
          heading: "Standards",
          level: 2,
          content: "Development standards",
          fingerprint: "standards-123",
        },
      ],
    };

    const result = validateAlignSchema(pack, { mode: "team" });
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.path === "/source_sha")).toBe(true);
  });
});

describe("mode-dependent validation", () => {
  it("solo mode: minimal fields only", () => {
    const pack = {
      id: "solo",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Guidelines",
          level: 2,
          content: "Development guidelines",
          fingerprint: "guidelines-123",
        },
      ],
    };

    const result = validateAlignSchema(pack, { mode: "solo" });
    expect(result.valid).toBe(true);
  });

  it("catalog mode: requires all distribution metadata", () => {
    const incompletePack = {
      id: "catalog-pack",
      version: "1.0.0",
      spec_version: "1",
      summary: "Test",
      sections: [
        {
          heading: "Catalog",
          level: 2,
          content: "Catalog guidelines",
          fingerprint: "catalog-xyz",
        },
      ],
      // missing: owner, source, source_sha, tags, integrity
    };

    const result = validateAlignSchema(incompletePack, { mode: "catalog" });
    expect(result.valid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it("catalog mode: validates complete pack", () => {
    const completePack = {
      id: "packs/test/catalog",
      version: "1.0.0",
      spec_version: "1",
      summary: "Test catalog pack",
      owner: "test/team",
      source: "github.com/test/rules",
      source_sha: "abc123",
      tags: ["test"],
      sections: [
        {
          heading: "Testing",
          level: 2,
          content: "Run tests.",
          fingerprint: "testing-abc",
        },
      ],
      integrity: {
        algo: "jcs-sha256",
        value: "<computed>",
      },
    };

    const result = validateAlignSchema(completePack, { mode: "catalog" });
    expect(result.valid).toBe(true);
  });
});

describe("vendor bags in validation", () => {
  it("accepts sections with vendor metadata", () => {
    const pack = {
      id: "test",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Testing",
          level: 2,
          content: "Run tests.",
          fingerprint: "testing-abc",
          vendor: {
            cursor: { mode: "always" },
            aider: { priority: "high" },
          },
        },
      ],
    };

    const result = validateAlignSchema(pack);
    expect(result.valid).toBe(true);
  });

  it("accepts sections with vendor._meta field", () => {
    const pack = {
      id: "test",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Security",
          level: 2,
          content: "Never commit secrets.",
          fingerprint: "security-abc",
          vendor: {
            cursor: { session_id: "xyz" },
            _meta: { volatile: ["cursor.session_id"] },
          },
        },
      ],
    };

    const result = validateAlignSchema(pack);
    expect(result.valid).toBe(true);
  });
});
