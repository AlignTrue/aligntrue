import { describe, it, expect } from "vitest";
import { resolvePlugsForPack } from "../../src/plugs/index.js";
import type { AlignPack } from "@aligntrue/schema";

describe("resolvePlugsForPack", () => {
  it("resolves all plugs in pack rules", () => {
    const pack: AlignPack = {
      id: "test/pack",
      version: "1.0.0",
      spec_version: "1",
      plugs: {
        slots: {
          "test.cmd": {
            description: "Test command",
            format: "command",
            required: true,
          },
        },
        fills: {
          "test.cmd": "npm test",
        },
      },
      rules: [
        {
          id: "test.require.tests",
          severity: "error",
          applies_to: ["**/*.ts"],
          guidance: "Run [[plug:test.cmd]] to verify",
        },
        {
          id: "test.another.rule",
          severity: "warn",
          applies_to: ["**/*.ts"],
          guidance: "Use [[plug:test.cmd]] for testing",
        },
      ],
    };

    const result = resolvePlugsForPack(pack);

    expect(result.success).toBe(true);
    expect(result.rules).toHaveLength(2);
    expect(result.rules[0].guidance).toContain("npm test");
    expect(result.rules[1].guidance).toContain("npm test");
    expect(result.unresolvedRequired).toHaveLength(0);
  });

  it("handles rules without guidance", () => {
    const pack: AlignPack = {
      id: "test/pack",
      version: "1.0.0",
      spec_version: "1",
      rules: [
        {
          id: "test.rule",
          severity: "error",
          applies_to: ["**/*.ts"],
        },
      ],
    };

    const result = resolvePlugsForPack(pack);

    expect(result.success).toBe(true);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0].guidance).toBeUndefined();
    expect(result.rules[0].resolutions).toHaveLength(0);
  });

  it("tracks unresolved required plugs", () => {
    const pack: AlignPack = {
      id: "test/pack",
      version: "1.0.0",
      spec_version: "1",
      plugs: {
        slots: {
          "test.cmd": {
            description: "Test command",
            format: "command",
            required: true,
            example: "npm test",
          },
          "build.cmd": {
            description: "Build command",
            format: "command",
            required: true,
          },
        },
      },
      rules: [
        {
          id: "test.rule",
          severity: "error",
          applies_to: ["**/*.ts"],
          guidance: "Run [[plug:test.cmd]] then [[plug:build.cmd]]",
        },
      ],
    };

    const result = resolvePlugsForPack(pack);

    expect(result.success).toBe(true);
    expect(result.unresolvedRequired).toContain("test.cmd");
    expect(result.unresolvedRequired).toContain("build.cmd");
    expect(result.rules[0].guidance).toContain("TODO(plug:test.cmd)");
    expect(result.rules[0].guidance).toContain("TODO(plug:build.cmd)");
  });

  it("fails in strict mode with unresolved required plugs", () => {
    const pack: AlignPack = {
      id: "test/pack",
      version: "1.0.0",
      spec_version: "1",
      plugs: {
        slots: {
          "test.cmd": {
            description: "Test command",
            format: "command",
            required: true,
          },
        },
      },
      rules: [
        {
          id: "test.rule",
          severity: "error",
          applies_to: ["**/*.ts"],
          guidance: "Run [[plug:test.cmd]]",
        },
      ],
    };

    const result = resolvePlugsForPack(pack, undefined, {
      failOnUnresolved: true,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]).toContain("Strict mode");
    expect(result.errors![0]).toContain("test.cmd");
  });

  it("merges additional fills from stack/repo", () => {
    const pack: AlignPack = {
      id: "test/base-pack",
      version: "1.0.0",
      spec_version: "1",
      plugs: {
        slots: {
          "test.cmd": {
            description: "Test command",
            format: "command",
            required: true,
          },
        },
      },
      rules: [
        {
          id: "test.rule",
          severity: "error",
          applies_to: ["**/*.ts"],
          guidance: "Run [[plug:test.cmd]]",
        },
      ],
    };

    const additionalFills = {
      "test.cmd": "pnpm test",
    };

    const result = resolvePlugsForPack(pack, additionalFills);

    expect(result.success).toBe(true);
    expect(result.rules[0].guidance).toContain("pnpm test");
    expect(result.unresolvedRequired).toHaveLength(0);
  });

  it("detects undeclared plug references", () => {
    const pack: AlignPack = {
      id: "test/pack",
      version: "1.0.0",
      spec_version: "1",
      plugs: {
        slots: {
          "test.cmd": {
            description: "Test command",
            format: "command",
            required: true,
          },
        },
      },
      rules: [
        {
          id: "test.rule",
          severity: "error",
          applies_to: ["**/*.ts"],
          guidance: "Run [[plug:undeclared.cmd]]",
        },
      ],
    };

    const result = resolvePlugsForPack(pack);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]).toContain("undeclared");
    expect(result.errors![0]).toContain("undeclared.cmd");
  });

  it("handles pack without plugs", () => {
    const pack: AlignPack = {
      id: "test/pack",
      version: "1.0.0",
      spec_version: "1",
      rules: [
        {
          id: "test.rule",
          severity: "error",
          applies_to: ["**/*.ts"],
          guidance: "No plugs here",
        },
      ],
    };

    const result = resolvePlugsForPack(pack);

    expect(result.success).toBe(true);
    expect(result.rules[0].guidance).toBe("No plugs here\n");
    expect(result.unresolvedRequired).toHaveLength(0);
  });

  it("catches validation errors and returns gracefully", () => {
    const pack: AlignPack = {
      id: "test/pack",
      version: "1.0.0",
      spec_version: "1",
      plugs: {
        slots: {
          "test.file": {
            description: "Test file",
            format: "file",
            required: true,
          },
        },
        fills: {
          "test.file": "/absolute/path", // Invalid
        },
      },
      rules: [
        {
          id: "test.rule",
          severity: "error",
          applies_to: ["**/*.ts"],
          guidance: "Check [[plug:test.file]]",
        },
      ],
    };

    const result = resolvePlugsForPack(pack);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]).toContain("repo-relative");
  });
});
