/**
 * Unit tests for override diff command (Phase 3.5, Session 10)
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
  applyOverlays: vi.fn(),
  evaluateSelector: vi.fn(),
  getAlignTruePaths: vi.fn((cwd = process.cwd()) => ({
    config: `${cwd}/.aligntrue/config.yaml`,
    rules: `${cwd}/.aligntrue/rules.md`,
    lockfile: `${cwd}/.aligntrue.lock.json`,
    bundle: `${cwd}/.aligntrue.bundle.yaml`,
    aligntrueDir: `${cwd}/.aligntrue`,
  })),
}));

import { overrideDiff } from "../../src/commands/override-diff.js";
import * as core from "@aligntrue/core";
import { existsSync } from "fs";

describe("Override Diff - No Overlays", () => {
  let mockExit: ReturnType<typeof vi.spyOn>;
  let mockLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockExit = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    mockLog = vi.spyOn(console, "log").mockImplementation(() => {});

    vi.spyOn(clack.log, "error").mockImplementation(() => {});
    vi.spyOn(clack.log, "warn").mockImplementation(() => {});
    vi.spyOn(clack.log, "info").mockImplementation(() => {});
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
    await overrideDiff([]);

    expect(mockExit).toHaveBeenCalledWith(0);
    expect(mockLog).toHaveBeenCalledWith("No overlays configured");
  });
});

describe("Override Diff - Display All Overlays", () => {
  let mockExit: ReturnType<typeof vi.spyOn>;
  let mockLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockExit = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    mockLog = vi.spyOn(console, "log").mockImplementation(() => {});

    vi.spyOn(clack.log, "error").mockImplementation(() => {});
    vi.spyOn(clack.log, "warn").mockImplementation(() => {});
    vi.spyOn(clack.log, "info").mockImplementation(() => {});
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

    vi.mocked(core.applyOverlays).mockReturnValue({
      success: true,
      appliedCount: 1,
      ir: { rules: [{ id: "test/rule", severity: "error" }] },
    });
  });

  it("shows diff for overlay with set operation", async () => {
    await overrideDiff([]);

    expect(mockExit).toHaveBeenCalledWith(0);
    expect(core.loadIR).toHaveBeenCalled();
    expect(core.applyOverlays).toHaveBeenCalled();

    const output = mockLog.mock.calls.map((call) => call.join(" ")).join("\n");

    expect(output).toContain("Overlay diff for: rule[id=test/rule]");
    expect(output).toContain('severity: "error"');
    expect(output).toContain("1 property modified");
  });

  it("shows diff for overlay with remove operation", async () => {
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

    await overrideDiff([]);

    expect(mockExit).toHaveBeenCalledWith(0);

    const output = mockLog.mock.calls.map((call) => call.join(" ")).join("\n");

    expect(output).toContain("autofix: (removed)");
    expect(output).toContain("examples: (removed)");
    expect(output).toContain("2 properties modified");
  });

  it("shows diff for overlay with set and remove operations", async () => {
    vi.mocked(core.loadConfig).mockResolvedValue({
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [],
      overlays: {
        overrides: [
          {
            selector: "rule[id=test/rule]",
            set: { severity: "critical" },
            remove: ["autofix"],
          },
        ],
      },
    });

    await overrideDiff([]);

    expect(mockExit).toHaveBeenCalledWith(0);

    const output = mockLog.mock.calls.map((call) => call.join(" ")).join("\n");

    expect(output).toContain('severity: "critical"');
    expect(output).toContain("autofix: (removed)");
    expect(output).toContain("2 properties modified");
  });

  it("shows multiple overlays", async () => {
    vi.mocked(core.loadConfig).mockResolvedValue({
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [],
      overlays: {
        overrides: [
          {
            selector: "rule[id=first]",
            set: { severity: "error" },
          },
          {
            selector: "rule[id=second]",
            set: { enabled: false },
          },
        ],
      },
    });

    vi.mocked(core.applyOverlays).mockReturnValue({
      success: true,
      appliedCount: 2,
      ir: { rules: [] },
    });

    await overrideDiff([]);

    expect(mockExit).toHaveBeenCalledWith(0);

    const output = mockLog.mock.calls.map((call) => call.join(" ")).join("\n");

    expect(output).toContain("Overlay diff for: rule[id=first]");
    expect(output).toContain("Overlay diff for: rule[id=second]");
    expect(output).toContain("2 overlays applied successfully");
  });

  it("shows applied count", async () => {
    await overrideDiff([]);

    const output = mockLog.mock.calls.map((call) => call.join(" ")).join("\n");

    expect(output).toContain("✓ 1 overlay applied successfully");
  });
});

describe("Override Diff - Filter by Selector", () => {
  let mockExit: ReturnType<typeof vi.spyOn>;
  let mockLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockExit = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    mockLog = vi.spyOn(console, "log").mockImplementation(() => {});

    vi.spyOn(clack.log, "error").mockImplementation(() => {});
    vi.spyOn(clack.log, "warn").mockImplementation(() => {});
    vi.spyOn(clack.log, "info").mockImplementation(() => {});
    vi.mocked(existsSync).mockReturnValue(true);

    vi.mocked(core.loadConfig).mockResolvedValue({
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [],
      overlays: {
        overrides: [
          {
            selector: "rule[id=first]",
            set: { severity: "error" },
          },
          {
            selector: "rule[id=second]",
            set: { enabled: false },
          },
        ],
      },
    });

    vi.mocked(core.loadIR).mockResolvedValue({
      rules: [],
    });

    vi.mocked(core.applyOverlays).mockReturnValue({
      success: true,
      appliedCount: 1,
      ir: { rules: [] },
    });
  });

  it("filters to matching selector", async () => {
    await overrideDiff(["rule[id=first]"]);

    expect(mockExit).toHaveBeenCalledWith(0);

    const output = mockLog.mock.calls.map((call) => call.join(" ")).join("\n");

    expect(output).toContain("Overlay diff for: rule[id=first]");
    expect(output).not.toContain("rule[id=second]");
  });

  it("shows warning for non-matching selector", async () => {
    await overrideDiff(["rule[id=nonexistent]"]);

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(clack.log.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "No overlays match selector: rule[id=nonexistent]",
      ),
    );
  });
});

describe("Override Diff - Error Handling", () => {
  let mockExit: ReturnType<typeof vi.spyOn>;
  let mockLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockExit = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    mockLog = vi.spyOn(console, "log").mockImplementation(() => {});

    vi.spyOn(clack.log, "error").mockImplementation(() => {});
    vi.spyOn(clack.log, "warn").mockImplementation(() => {});
    vi.spyOn(clack.log, "info").mockImplementation(() => {});
    vi.mocked(existsSync).mockReturnValue(true);

    vi.mocked(core.loadConfig).mockResolvedValue({
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [],
      overlays: {
        overrides: [
          {
            selector: "rule[id=test]",
            set: { severity: "error" },
          },
        ],
      },
    });
  });

  it("shows error when IR cannot be loaded", async () => {
    vi.mocked(core.loadIR).mockRejectedValue(new Error("IR not found"));

    await overrideDiff([]);

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(clack.log.error).toHaveBeenCalledWith("Could not load IR");
    expect(clack.log.info).toHaveBeenCalledWith(
      expect.stringContaining("aligntrue sync"),
    );
  });

  it("shows error when overlay application fails", async () => {
    vi.mocked(core.loadIR).mockResolvedValue({ rules: [] });
    vi.mocked(core.applyOverlays).mockReturnValue({
      success: false,
      errors: ["Selector did not match any rules"],
    });

    await overrideDiff([]);

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(clack.log.error).toHaveBeenCalledWith("Failed to apply overlays");
    expect(mockLog).toHaveBeenCalledWith(
      expect.stringContaining("Selector did not match any rules"),
    );
  });
});
