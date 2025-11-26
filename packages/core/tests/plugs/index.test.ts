import { describe, it, expect } from "vitest";
import { resolvePlugsForAlign } from "../../src/plugs/index.js";
import type { Align } from "@aligntrue/schema";

describe("resolvePlugsForAlign", () => {
  it("resolves all plugs in align rules", () => {
    const align: Align = {
      id: "test/align",
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
      sections: [
        {
          heading: "Test Rule 1",
          level: 2,
          content: "Run [[plug:test.cmd]] to verify",
          fingerprint: "test-rule-1",
        },
        {
          heading: "Test Rule 2",
          level: 2,
          content: "Use [[plug:test.cmd]] for testing",
          fingerprint: "test-rule-2",
        },
      ],
    };

    const result = resolvePlugsForAlign(align);

    expect(result.success).toBe(true);
    expect(result.rules).toHaveLength(2);
    expect(result.rules[0].content).toContain("npm test");
    expect(result.rules[1].content).toContain("npm test");
    expect(result.unresolvedRequired).toHaveLength(0);
  });

  it("handles rules without content", () => {
    const align: Align = {
      id: "test/align",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Simple Rule",
          level: 2,
          content: "",
          fingerprint: "simple-rule",
        },
      ],
    };

    const result = resolvePlugsForAlign(align);

    expect(result.success).toBe(true);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0].content).toBeUndefined();
    expect(result.rules[0].resolutions).toHaveLength(0);
  });

  it("tracks unresolved required plugs", () => {
    const align: Align = {
      id: "test/align",
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
      sections: [
        {
          heading: "Test Rule",
          level: 2,
          content: "Run [[plug:test.cmd]] then [[plug:build.cmd]]",
          fingerprint: "test-rule",
        },
      ],
    };

    const result = resolvePlugsForAlign(align);

    expect(result.success).toBe(true);
    expect(result.unresolvedRequired).toContain("test.cmd");
    expect(result.unresolvedRequired).toContain("build.cmd");
    expect(result.rules[0].content).toContain("TODO(plug:test.cmd)");
    expect(result.rules[0].content).toContain("TODO(plug:build.cmd)");
  });

  it("fails in strict mode with unresolved required plugs", () => {
    const align: Align = {
      id: "test/align",
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
      sections: [
        {
          heading: "Test Rule",
          level: 2,
          content: "Run [[plug:test.cmd]]",
          fingerprint: "test-rule",
        },
      ],
    };

    const result = resolvePlugsForAlign(align, undefined, {
      failOnUnresolved: true,
    });

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]).toContain("Strict mode");
    expect(result.errors![0]).toContain("test.cmd");
  });

  it("merges additional fills from stack/repo", () => {
    const align: Align = {
      id: "test/base-align",
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
      sections: [
        {
          heading: "Test Rule",
          level: 2,
          content: "Run [[plug:test.cmd]]",
          fingerprint: "test-rule",
        },
      ],
    };

    const additionalFills = {
      "test.cmd": "pnpm test",
    };

    const result = resolvePlugsForAlign(align, additionalFills);

    expect(result.success).toBe(true);
    expect(result.rules[0].content).toContain("pnpm test");
    expect(result.unresolvedRequired).toHaveLength(0);
  });

  it("detects undeclared plug references", () => {
    const align: Align = {
      id: "test/align",
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
      sections: [
        {
          heading: "Test Rule",
          level: 2,
          content: "Run [[plug:undeclared.cmd]]",
          fingerprint: "test-rule",
        },
      ],
    };

    const result = resolvePlugsForAlign(align);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]).toContain("undeclared");
    expect(result.errors![0]).toContain("undeclared.cmd");
  });

  it("handles align without plugs", () => {
    const align: Align = {
      id: "test/align",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Test Rule",
          level: 2,
          content: "No plugs here\n",
          fingerprint: "test-rule",
        },
      ],
    };

    const result = resolvePlugsForAlign(align);

    expect(result.success).toBe(true);
    expect(result.rules[0].content).toBe("No plugs here\n");
    expect(result.unresolvedRequired).toHaveLength(0);
  });

  it("catches validation errors and returns gracefully", () => {
    const align: Align = {
      id: "test/align",
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
      sections: [
        {
          heading: "Test Rule",
          level: 2,
          content: "Check [[plug:test.file]]",
          fingerprint: "test-rule",
        },
      ],
    };

    const result = resolvePlugsForAlign(align);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]).toContain("repo-relative");
  });
});
