/**
 * Tests for allow list management
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import {
  parseAllowList,
  validateAllowList,
  parseSourceId,
  resolveSource,
  isSourceAllowed,
  addSourceToAllowList,
  removeSourceFromAllowList,
  writeAllowList,
  type AllowList,
} from "../../src/team/allow.js";

const TEST_DIR = join(process.cwd(), "test-temp-allow");
const ALLOW_LIST_PATH = join(TEST_DIR, "allow.yaml");

beforeEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("parseAllowList", () => {
  it("returns empty allow list when file does not exist", () => {
    const result = parseAllowList(ALLOW_LIST_PATH);
    expect(result).toEqual({ version: 1, sources: [] });
  });

  it("parses valid allow list YAML", () => {
    const content = `version: 1
sources:
  - type: id
    value: https://github.com/org/rules@v1.0.0
    resolved_hash: sha256:abc123
  - type: hash
    value: sha256:def456
    comment: Vendored pack
`;
    writeFileSync(ALLOW_LIST_PATH, content, "utf-8");

    const result = parseAllowList(ALLOW_LIST_PATH);
    expect(result.version).toBe(1);
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0].type).toBe("id");
    expect(result.sources[0].value).toBe("https://github.com/org/rules@v1.0.0");
    expect(result.sources[0].resolved_hash).toBe("sha256:abc123");
    expect(result.sources[1].type).toBe("hash");
    expect(result.sources[1].value).toBe("sha256:def456");
    expect(result.sources[1].comment).toBe("Vendored pack");
  });

  it("throws on invalid YAML structure", () => {
    writeFileSync(ALLOW_LIST_PATH, "not: valid: yaml:", "utf-8");
    expect(() => parseAllowList(ALLOW_LIST_PATH)).toThrow();
  });

  it("throws when version is missing", () => {
    writeFileSync(ALLOW_LIST_PATH, "sources: []", "utf-8");
    expect(() => parseAllowList(ALLOW_LIST_PATH)).toThrow("version must be 1");
  });

  it("throws when version is not 1", () => {
    writeFileSync(ALLOW_LIST_PATH, "version: 2\nsources: []", "utf-8");
    expect(() => parseAllowList(ALLOW_LIST_PATH)).toThrow("version must be 1");
  });

  it("throws when sources is missing", () => {
    writeFileSync(ALLOW_LIST_PATH, "version: 1", "utf-8");
    expect(() => parseAllowList(ALLOW_LIST_PATH)).toThrow(
      "sources must be an array",
    );
  });

  it("throws when sources is not an array", () => {
    writeFileSync(
      ALLOW_LIST_PATH,
      'version: 1\nsources: "not an array"',
      "utf-8",
    );
    expect(() => parseAllowList(ALLOW_LIST_PATH)).toThrow(
      "sources must be an array",
    );
  });
});

describe("validateAllowList", () => {
  it("validates correct allow list", () => {
    const allowList: AllowList = {
      version: 1,
      sources: [
        { type: "id", value: "base-global@aligntrue/catalog@v1.0.0" },
        { type: "hash", value: "sha256:abc123" },
      ],
    };

    const result = validateAllowList(allowList);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("detects invalid version", () => {
    const allowList = { version: 2, sources: [] } as any;

    const result = validateAllowList(allowList);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("version must be 1");
  });

  it("detects non-array sources", () => {
    const allowList = { version: 1, sources: "not an array" } as any;

    const result = validateAllowList(allowList);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("sources must be an array");
  });

  it("detects invalid source type", () => {
    const allowList: AllowList = {
      version: 1,
      sources: [{ type: "invalid" as any, value: "test" }],
    };

    const result = validateAllowList(allowList);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain(
      "sources[0].type must be 'id' or 'hash'",
    );
  });

  it("detects missing source value", () => {
    const allowList = {
      version: 1,
      sources: [{ type: "id" }],
    } as any;

    const result = validateAllowList(allowList);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain(
      "sources[0].value must be a non-empty string",
    );
  });

  it("detects hash type without sha256: prefix", () => {
    const allowList: AllowList = {
      version: 1,
      sources: [{ type: "hash", value: "abc123" }],
    };

    const result = validateAllowList(allowList);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain(
      "sources[0].value must start with 'sha256:'",
    );
  });

  it("validates optional resolved_hash", () => {
    const allowList: AllowList = {
      version: 1,
      sources: [
        { type: "id", value: "test@test@v1", resolved_hash: "sha256:abc" },
      ],
    };

    const result = validateAllowList(allowList);
    expect(result.valid).toBe(true);
  });

  it("detects invalid resolved_hash type", () => {
    const allowList = {
      version: 1,
      sources: [{ type: "id", value: "test@test@v1", resolved_hash: 123 }],
    } as any;

    const result = validateAllowList(allowList);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain(
      "sources[0].resolved_hash must be a string",
    );
  });

  it("validates optional comment", () => {
    const allowList: AllowList = {
      version: 1,
      sources: [{ type: "hash", value: "sha256:abc", comment: "Test comment" }],
    };

    const result = validateAllowList(allowList);
    expect(result.valid).toBe(true);
  });

  it("detects invalid comment type", () => {
    const allowList = {
      version: 1,
      sources: [{ type: "hash", value: "sha256:abc", comment: 123 }],
    } as any;

    const result = validateAllowList(allowList);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("sources[0].comment must be a string");
  });
});

describe("parseSourceId", () => {
  it("parses valid id@profile@version format", () => {
    const result = parseSourceId("base-global@aligntrue/catalog@v1.0.0");
    expect(result).toEqual({
      id: "base-global",
      profile: "aligntrue/catalog",
      version: "v1.0.0",
    });
  });

  it("returns null for invalid format (too few parts)", () => {
    const result = parseSourceId("base-global@v1.0.0");
    expect(result).toBeNull();
  });

  it("returns null for invalid format (too many parts)", () => {
    const result = parseSourceId("base@global@aligntrue@catalog@v1.0.0");
    expect(result).toBeNull();
  });

  it("handles complex profile names", () => {
    const result = parseSourceId("my-pack@org/sub/path@v2.1.0");
    expect(result).toEqual({
      id: "my-pack",
      profile: "org/sub/path",
      version: "v2.1.0",
    });
  });
});

describe("resolveSource", () => {
  it("resolves hash sources immediately", async () => {
    const result = await resolveSource("sha256:abc123def456");
    expect(result.success).toBe(true);
    expect(result.hash).toBe("sha256:abc123def456");
  });

  it("returns error for invalid source format", async () => {
    const result = await resolveSource("invalid-format");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid source format");
  });

  it("returns error for git resolution (not yet implemented)", async () => {
    const result = await resolveSource("base-global@aligntrue/catalog@v1.0.0");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Git resolution not yet implemented");
  });
});

describe("isSourceAllowed", () => {
  const allowList: AllowList = {
    version: 1,
    sources: [
      {
        type: "id",
        value: "base-global@aligntrue/catalog@v1.0.0",
        resolved_hash: "sha256:abc123",
      },
      { type: "hash", value: "sha256:def456" },
    ],
  };

  it("allows source by exact id match", () => {
    expect(
      isSourceAllowed("base-global@aligntrue/catalog@v1.0.0", allowList),
    ).toBe(true);
  });

  it("allows source by resolved hash match", () => {
    expect(isSourceAllowed("sha256:abc123", allowList)).toBe(true);
  });

  it("allows source by direct hash match", () => {
    expect(isSourceAllowed("sha256:def456", allowList)).toBe(true);
  });

  it("rejects source not in allow list", () => {
    expect(isSourceAllowed("other-pack@example/org@v1.0.0", allowList)).toBe(
      false,
    );
  });

  it("rejects unknown hash", () => {
    expect(isSourceAllowed("sha256:unknown", allowList)).toBe(false);
  });
});

describe("addSourceToAllowList", () => {
  it("adds hash source without resolution", async () => {
    const allowList: AllowList = { version: 1, sources: [] };
    const result = await addSourceToAllowList("sha256:abc123", allowList);

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toEqual({
      type: "hash",
      value: "sha256:abc123",
    });
  });

  it("is idempotent (does not add duplicate)", async () => {
    const allowList: AllowList = {
      version: 1,
      sources: [{ type: "hash", value: "sha256:abc123" }],
    };
    const result = await addSourceToAllowList("sha256:abc123", allowList);

    expect(result.sources).toHaveLength(1);
  });

  it("throws on git resolution failure", async () => {
    const allowList: AllowList = { version: 1, sources: [] };

    await expect(
      addSourceToAllowList("base-global@aligntrue/catalog@v1.0.0", allowList),
    ).rejects.toThrow("Failed to resolve source");
  });

  it("throws on invalid source format", async () => {
    const allowList: AllowList = { version: 1, sources: [] };

    await expect(
      addSourceToAllowList("invalid-format", allowList),
    ).rejects.toThrow("Failed to resolve source");
  });
});

describe("removeSourceFromAllowList", () => {
  it("removes source by exact value match", () => {
    const allowList: AllowList = {
      version: 1,
      sources: [
        { type: "id", value: "base-global@aligntrue/catalog@v1.0.0" },
        { type: "hash", value: "sha256:abc123" },
      ],
    };

    const result = removeSourceFromAllowList("sha256:abc123", allowList);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].value).toBe(
      "base-global@aligntrue/catalog@v1.0.0",
    );
  });

  it("removes source by resolved hash match", () => {
    const allowList: AllowList = {
      version: 1,
      sources: [
        {
          type: "id",
          value: "base-global@aligntrue/catalog@v1.0.0",
          resolved_hash: "sha256:abc123",
        },
      ],
    };

    const result = removeSourceFromAllowList("sha256:abc123", allowList);
    expect(result.sources).toHaveLength(0);
  });

  it("does nothing if source not found", () => {
    const allowList: AllowList = {
      version: 1,
      sources: [{ type: "hash", value: "sha256:abc123" }],
    };

    const result = removeSourceFromAllowList("sha256:notfound", allowList);
    expect(result.sources).toHaveLength(1);
  });
});

describe("writeAllowList", () => {
  it("writes allow list to file", () => {
    const allowList: AllowList = {
      version: 1,
      sources: [{ type: "id", value: "base-global@aligntrue/catalog@v1.0.0" }],
    };

    writeAllowList(ALLOW_LIST_PATH, allowList);

    expect(existsSync(ALLOW_LIST_PATH)).toBe(true);
    const parsed = parseAllowList(ALLOW_LIST_PATH);
    expect(parsed).toEqual(allowList);
  });

  it("creates directory if needed", () => {
    const deepPath = join(TEST_DIR, "nested", "deep", "allow.yaml");
    const allowList: AllowList = { version: 1, sources: [] };

    writeAllowList(deepPath, allowList);

    expect(existsSync(deepPath)).toBe(true);
  });
});
