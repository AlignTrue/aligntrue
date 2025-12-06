import { describe, it, expect } from "vitest";
import {
  mergePlugs,
  resolveText,
  findUndeclaredPlugs,
} from "../../src/plugs/resolver.js";
import type { Plugs } from "@aligntrue/schema";

describe("mergePlugs", () => {
  it("merges slots from multiple sources", () => {
    const sources = [
      {
        plugs: {
          slots: {
            "test.cmd": {
              description: "Test command",
              format: "command" as const,
              required: true,
            },
          },
        },
        source: "base",
      },
      {
        plugs: {
          slots: {
            "build.cmd": {
              description: "Build command",
              format: "command" as const,
              required: false,
            },
          },
        },
        source: "stack",
      },
    ];

    const result = mergePlugs(sources);

    expect(result.slots).toBeDefined();
    expect(result.slots!["test.cmd"]).toBeDefined();
    expect(result.slots!["build.cmd"]).toBeDefined();
  });

  it("merges fills from multiple sources with last-writer-wins", () => {
    const sources = [
      {
        plugs: {
          fills: {
            "test.cmd": "npm test",
          },
        },
        source: "base",
      },
      {
        plugs: {
          fills: {
            "test.cmd": "pnpm test", // Overrides
          },
        },
        source: "repo",
      },
    ];

    const result = mergePlugs(sources);

    expect(result.fills).toBeDefined();
    expect(result.fills!["test.cmd"]).toBe("pnpm test");
  });

  it("validates fill values against slot format", () => {
    const sources = [
      {
        plugs: {
          slots: {
            "test.file": {
              description: "Test file",
              format: "file" as const,
              required: true,
            },
          },
          fills: {
            "test.file": "/absolute/path", // Invalid for file format
          },
        },
        source: "base",
      },
    ];

    const merged = mergePlugs(sources);
    expect(merged.fills?.["test.file"]).toBe("/absolute/path");
  });

  it("rejects invalid plug keys", () => {
    const sources = [
      {
        plugs: {
          slots: {
            "invalid key with spaces": {
              description: "Test",
              format: "text" as const,
              required: false,
            },
          },
        },
        source: "base",
      },
    ];

    expect(() => mergePlugs(sources)).toThrow("Invalid plug key");
  });

  it("rejects keys starting with stack. or sys.", () => {
    const sources = [
      {
        plugs: {
          slots: {
            "stack.test": {
              description: "Test",
              format: "text" as const,
              required: false,
            },
          },
        },
        source: "base",
      },
    ];

    expect(() => mergePlugs(sources)).toThrow("stack.");
  });
});

describe("resolveText", () => {
  it("replaces [[plug:key]] with fill value", () => {
    const plugs: Plugs = {
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
    };

    const result = resolveText("Run [[plug:test.cmd]] to verify", plugs);

    expect(result.text).toContain("Run npm test to verify");
    expect(result.resolutions[0].resolved).toBe(true);
    expect(result.resolutions[0].value).toBe("npm test");
    expect(result.unresolvedRequired).toHaveLength(0);
  });

  it("generates TODO block for unresolved required plug with example", () => {
    const plugs: Plugs = {
      slots: {
        "test.cmd": {
          description: "Test command",
          format: "command",
          required: true,
          example: "pytest -q",
        },
      },
    };

    const result = resolveText("Run [[plug:test.cmd]] to verify", plugs);

    expect(result.text).toContain("TODO(plug:test.cmd):");
    expect(result.text).toContain("Examples: pytest -q");
    expect(result.unresolvedRequired).toContain("test.cmd");
  });

  it("generates TODO block for unresolved required plug without example", () => {
    const plugs: Plugs = {
      slots: {
        "test.cmd": {
          description: "Test command",
          format: "command",
          required: true,
        },
      },
    };

    const result = resolveText("Run [[plug:test.cmd]] to verify", plugs);

    expect(result.text).toContain("TODO(plug:test.cmd):");
    expect(result.text).not.toContain("Examples:");
    expect(result.unresolvedRequired).toContain("test.cmd");
  });

  it("replaces unresolved optional plug with empty string", () => {
    const plugs: Plugs = {
      slots: {
        "docs.url": {
          description: "Documentation URL",
          format: "url",
          required: false,
        },
      },
    };

    const result = resolveText("See [[plug:docs.url]] for more info", plugs);

    expect(result.text).toBe("See  for more info\n");
    expect(result.unresolvedRequired).toHaveLength(0);
  });

  it("handles escaped plugs [[\\plug:key]]", () => {
    const plugs: Plugs = {
      fills: {
        "test.cmd": "npm test",
      },
    };

    // Note: \\ in string literal produces a single backslash
    const input = "Example: [[\\plug:test.cmd]] becomes [[plug:test.cmd]]";
    const result = resolveText(input, plugs);

    expect(result.text).toContain("[[plug:test.cmd]] becomes npm test");
  });

  it("normalizes CRLF to LF", () => {
    const plugs: Plugs = {
      fills: {
        "test.cmd": "npm test",
      },
    };

    const result = resolveText("Line 1\r\n[[plug:test.cmd]]\r\nLine 3", plugs);

    expect(result.text).not.toContain("\r");
    expect(result.text).toContain("\n");
  });

  it("ensures single trailing LF", () => {
    const plugs: Plugs = {
      fills: {
        "test.cmd": "npm test",
      },
    };

    const result = resolveText("[[plug:test.cmd]]   \n\n\n", plugs);

    expect(result.text).toMatch(/[^\n]\n$/);
    expect(result.text).not.toMatch(/\n\n$/);
  });

  it("handles multiple plugs in same text", () => {
    const plugs: Plugs = {
      fills: {
        "test.cmd": "npm test",
        "build.cmd": "npm build",
      },
    };

    const result = resolveText(
      "Run [[plug:test.cmd]] then [[plug:build.cmd]]",
      plugs,
    );

    expect(result.text).toContain("Run npm test then npm build");
    expect(result.resolutions).toHaveLength(2);
  });
});

describe("findUndeclaredPlugs", () => {
  it("finds undeclared plug references", () => {
    const declaredSlots = new Set(["test.cmd", "build.cmd"]);
    const text = "Run [[plug:test.cmd]] and [[plug:deploy.cmd]]";

    const undeclared = findUndeclaredPlugs(text, declaredSlots);

    expect(undeclared).toContain("deploy.cmd");
    expect(undeclared).not.toContain("test.cmd");
  });

  it("returns empty array when all plugs declared", () => {
    const declaredSlots = new Set(["test.cmd", "build.cmd"]);
    const text = "Run [[plug:test.cmd]] and [[plug:build.cmd]]";

    const undeclared = findUndeclaredPlugs(text, declaredSlots);

    expect(undeclared).toHaveLength(0);
  });

  it("deduplicates undeclared plugs", () => {
    const declaredSlots = new Set(["test.cmd"]);
    const text = "Use [[plug:missing]] here and [[plug:missing]] there";

    const undeclared = findUndeclaredPlugs(text, declaredSlots);

    expect(undeclared).toEqual(["missing"]);
  });
});
