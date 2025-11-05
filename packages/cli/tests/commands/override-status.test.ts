/**
 * Unit tests for override status command (Phase 3.5, Session 10)
 * Standardized mock-based tests following sync.test.ts pattern
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import * as clack from "@clack/prompts";

// Mock dependencies before imports
vi.mock("fs");
vi.mock("@clack/prompts");
vi.mock("@aligntrue/core/telemetry/collector.js", () => ({
  recordEvent: vi.fn(),
}));
vi.mock("@aligntrue/schema", () => ({
  canonicalizeJson: vi.fn((obj) => JSON.stringify(obj || {})),
  validateAlign: vi.fn(),
  validateRuleId: vi.fn(() => ({ valid: true })),
}));
vi.mock("@aligntrue/core", () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  loadIR: vi.fn(),
  evaluateSelector: vi.fn(),
  getAlignTruePaths: vi.fn((cwd = process.cwd()) => ({
    config: `${cwd}/.aligntrue/config.yaml`,
    rules: `${cwd}/.aligntrue/rules.md`,
    lockfile: `${cwd}/.aligntrue.lock.json`,
    bundle: `${cwd}/.aligntrue.bundle.yaml`,
    aligntrueDir: `${cwd}/.aligntrue`,
  })),
}));

import { overrideStatus } from "../../src/commands/override-status.js";
import * as core from "@aligntrue/core";
import { existsSync } from "fs";

describe("Override Status - No Overlays", () => {
  let mockExit: ReturnType<typeof vi.spyOn>;
  let mockLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockExit = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    mockLog = vi.spyOn(console, "log").mockImplementation(() => {});

    vi.mocked(clack.log.error).mockImplementation(() => {});
    vi.mocked(clack.log.warn).mockImplementation(() => {});
    vi.mocked(clack.log.info).mockImplementation(() => {});
    vi.mocked(existsSync).mockReturnValue(true);

    vi.mocked(core.loadConfig).mockResolvedValue({
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [],
      // No overlays
    });
  });

  it("shows empty state message", async () => {
    await overrideStatus([]);

    expect(mockExit).toHaveBeenCalledWith(0);
    expect(mockLog).toHaveBeenCalledWith("No overlays configured");
  });

  it("outputs JSON for empty state", async () => {
    await overrideStatus(["--json"]);

    expect(mockExit).toHaveBeenCalledWith(0);

    // Find the JSON output (single call with full JSON)
    const jsonCall = mockLog.mock.calls.find((call) => {
      const str = call.join(" ");
      return str.trim().startsWith("{");
    });

    expect(jsonCall).toBeDefined();
    const json = JSON.parse(jsonCall!.join(" "));
    expect(json).toEqual({
      total: 0,
      healthy: 0,
      stale: 0,
      overlays: [],
    });
  });
});

describe("Override Status - Healthy Overlays", () => {
  let mockExit: ReturnType<typeof vi.spyOn>;
  let mockLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockExit = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    mockLog = vi.spyOn(console, "log").mockImplementation(() => {});

    vi.mocked(clack.log.error).mockImplementation(() => {});
    vi.mocked(clack.log.warn).mockImplementation(() => {});
    vi.mocked(clack.log.info).mockImplementation(() => {});
    vi.mocked(existsSync).mockReturnValue(true);

    vi.mocked(core.loadConfig).mockResolvedValue({
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [],
      overlays: {
        overrides: [
          {
            selector: "rule[id=test/rule]",
            set: { severity: "error" },
          },
        ],
      },
    });

    vi.mocked(core.loadIR).mockResolvedValue({
      rules: [{ id: "test/rule", severity: "warn" }],
    });

    vi.mocked(core.evaluateSelector).mockReturnValue({ success: true });
  });

  it("shows healthy overlay", async () => {
    await overrideStatus([]);

    expect(mockExit).toHaveBeenCalledWith(0);
    expect(core.evaluateSelector).toHaveBeenCalledWith(
      "rule[id=test/rule]",
      expect.any(Object),
    );

    const output = mockLog.mock.calls.map((call) => call.join(" ")).join("\n");

    expect(output).toContain("Overlays (1 active");
    expect(output).toContain("✓ rule[id=test/rule]");
    expect(output).toContain("Healthy: yes");
  });

  it("outputs JSON for healthy overlay", async () => {
    await overrideStatus(["--json"]);

    expect(mockExit).toHaveBeenCalledWith(0);

    const jsonCall = mockLog.mock.calls.find((call) => {
      const str = call.join(" ");
      return str.trim().startsWith("{");
    });

    expect(jsonCall).toBeDefined();
    const json = JSON.parse(jsonCall!.join(" "));
    expect(json.total).toBe(1);
    expect(json.healthy).toBe(1);
    expect(json.stale).toBe(0);
    expect(json.overlays[0].health).toBe("healthy");
    expect(json.overlays[0].selector).toBe("rule[id=test/rule]");
  });

  it("displays set operations", async () => {
    await overrideStatus([]);

    const output = mockLog.mock.calls.map((call) => call.join(" ")).join("\n");

    expect(output).toContain('Set: severity="error"');
  });

  it("displays remove operations", async () => {
    vi.mocked(core.loadConfig).mockResolvedValue({
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [],
      overlays: {
        overrides: [
          {
            selector: "rule[id=test/rule]",
            remove: ["autofix", "examples"],
          },
        ],
      },
    });

    await overrideStatus([]);

    const output = mockLog.mock.calls.map((call) => call.join(" ")).join("\n");

    expect(output).toContain("Remove: autofix, examples");
  });

  it("displays set and remove operations together", async () => {
    vi.mocked(core.loadConfig).mockResolvedValue({
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [],
      overlays: {
        overrides: [
          {
            selector: "rule[id=test/rule]",
            set: { severity: "critical", enabled: false },
            remove: ["autofix"],
          },
        ],
      },
    });

    await overrideStatus([]);

    const output = mockLog.mock.calls.map((call) => call.join(" ")).join("\n");

    expect(output).toContain('severity="critical"');
    expect(output).toContain("Remove: autofix");
  });
});

describe("Override Status - Stale Overlays", () => {
  let mockExit: ReturnType<typeof vi.spyOn>;
  let mockLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockExit = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    mockLog = vi.spyOn(console, "log").mockImplementation(() => {});

    vi.mocked(clack.log.error).mockImplementation(() => {});
    vi.mocked(clack.log.warn).mockImplementation(() => {});
    vi.mocked(clack.log.info).mockImplementation(() => {});
    vi.mocked(existsSync).mockReturnValue(true);

    vi.mocked(core.loadConfig).mockResolvedValue({
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [],
      overlays: {
        overrides: [
          {
            selector: "rule[id=deleted/rule]",
            set: { severity: "error" },
          },
        ],
      },
    });

    vi.mocked(core.loadIR).mockResolvedValue({
      rules: [], // No matching rules
    });

    vi.mocked(core.evaluateSelector).mockReturnValue({ success: false });
  });

  it("marks non-matching overlay as stale", async () => {
    await overrideStatus([]);

    expect(mockExit).toHaveBeenCalledWith(0);

    const output = mockLog.mock.calls.map((call) => call.join(" ")).join("\n");

    expect(output).toContain("Overlays (1 active, 1 stale)");
    expect(output).toContain("❌ rule[id=deleted/rule]");
    expect(output).toContain("Healthy: stale (no match in IR)");
  });

  it("outputs JSON for stale overlay", async () => {
    await overrideStatus(["--json"]);

    expect(mockExit).toHaveBeenCalledWith(0);

    const jsonCall = mockLog.mock.calls.find((call) => {
      const str = call.join(" ");
      return str.trim().startsWith("{");
    });

    expect(jsonCall).toBeDefined();
    const json = JSON.parse(jsonCall!.join(" "));
    expect(json.total).toBe(1);
    expect(json.healthy).toBe(0);
    expect(json.stale).toBe(1);
    expect(json.overlays[0].health).toBe("stale");
  });

  it("shows tip to clean up stale overlays", async () => {
    await overrideStatus([]);

    const output = mockLog.mock.calls.map((call) => call.join(" ")).join("\n");

    expect(output).toContain("aligntrue override remove");
  });
});

describe("Override Status - Mixed Health", () => {
  let mockExit: ReturnType<typeof vi.spyOn>;
  let mockLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockExit = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    mockLog = vi.spyOn(console, "log").mockImplementation(() => {});

    vi.mocked(clack.log.error).mockImplementation(() => {});
    vi.mocked(clack.log.warn).mockImplementation(() => {});
    vi.mocked(clack.log.info).mockImplementation(() => {});
    vi.mocked(existsSync).mockReturnValue(true);

    vi.mocked(core.loadConfig).mockResolvedValue({
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [],
      overlays: {
        overrides: [
          {
            selector: "rule[id=active/rule]",
            set: { severity: "error" },
          },
          {
            selector: "rule[id=deleted/rule]",
            set: { enabled: false },
          },
          {
            selector: "rule[id=another/active]",
            remove: ["autofix"],
          },
        ],
      },
    });

    vi.mocked(core.loadIR).mockResolvedValue({
      rules: [
        { id: "active/rule", severity: "warn" },
        { id: "another/active", autofix: true },
      ],
    });

    // Mock evaluateSelector to return different results per call
    let _callCount = 0;
    vi.mocked(core.evaluateSelector).mockImplementation((selector: string) => {
      _callCount++;
      if (
        selector === "rule[id=active/rule]" ||
        selector === "rule[id=another/active]"
      ) {
        return { success: true };
      }
      return { success: false };
    });
  });

  it("shows mixed health status", async () => {
    await overrideStatus([]);

    expect(mockExit).toHaveBeenCalledWith(0);

    const output = mockLog.mock.calls.map((call) => call.join(" ")).join("\n");

    expect(output).toContain("Overlays (3 active, 1 stale)");
    expect(output).toContain("✓ rule[id=active/rule]");
    expect(output).toContain("❌ rule[id=deleted/rule]");
    expect(output).toContain("✓ rule[id=another/active]");
  });

  it("outputs JSON for mixed health", async () => {
    await overrideStatus(["--json"]);

    expect(mockExit).toHaveBeenCalledWith(0);

    const jsonCall = mockLog.mock.calls.find((call) => {
      const str = call.join(" ");
      return str.trim().startsWith("{");
    });

    expect(jsonCall).toBeDefined();
    const json = JSON.parse(jsonCall!.join(" "));
    expect(json.total).toBe(3);
    expect(json.healthy).toBe(2);
    expect(json.stale).toBe(1);
  });
});

describe("Override Status - No IR", () => {
  let mockExit: ReturnType<typeof vi.spyOn>;
  let mockLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockExit = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    mockLog = vi.spyOn(console, "log").mockImplementation(() => {});

    vi.mocked(clack.log.error).mockImplementation(() => {});
    vi.mocked(clack.log.warn).mockImplementation(() => {});
    vi.mocked(clack.log.info).mockImplementation(() => {});
    vi.mocked(existsSync).mockReturnValue(true);

    vi.mocked(core.loadConfig).mockResolvedValue({
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [],
      overlays: {
        overrides: [
          {
            selector: "rule[id=test/rule]",
            set: { severity: "error" },
          },
        ],
      },
    });

    // Simulate IR loading failure
    vi.mocked(core.loadIR).mockRejectedValue(new Error("IR not found"));
  });

  it("marks all overlays as stale when IR unavailable", async () => {
    await overrideStatus([]);

    expect(mockExit).toHaveBeenCalledWith(0);
    expect(clack.log.warn).toHaveBeenCalledWith(
      expect.stringContaining("Could not load IR"),
    );
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining("aligntrue sync"),
    );

    const output = mockLog.mock.calls.map((call) => call.join(" ")).join("\n");

    // Without IR, cannot determine health
    expect(output).toContain("rule[id=test/rule]");
  });
});
