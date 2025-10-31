/**
 * Unit tests for override add command (Phase 3.5, Session 10)
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
  loadIR: vi.fn(() => ({ rules: [] })),
  evaluateSelector: vi.fn(() => []),
  validateSelector: vi.fn(() => ({ valid: true })),
  parseSelector: vi.fn((sel: string) => ({ type: "rule", value: sel })),
  getAlignTruePaths: vi.fn((cwd = process.cwd()) => ({
    config: `${cwd}/.aligntrue/config.yaml`,
    rules: `${cwd}/.aligntrue/rules.md`,
    lockfile: `${cwd}/.aligntrue.lock.json`,
    bundle: `${cwd}/.aligntrue.bundle.yaml`,
    aligntrueDir: `${cwd}/.aligntrue`,
  })),
}));

import { overrideAdd } from "../../src/commands/override-add.js";
import * as core from "@aligntrue/core";
import { existsSync } from "fs";

describe("Override Add - Selector Validation", () => {
  let mockExit: ReturnType<typeof vi.spyOn>;
  let mockLog: ReturnType<typeof vi.spyOn>;
  let mockError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock process.exit without throwing
    mockExit = vi.spyOn(process, "exit").mockImplementation((() => {
      // Don't throw, just record the call
    }) as any);

    mockLog = vi.spyOn(console, "log").mockImplementation(() => {});
    mockError = vi.spyOn(console, "error").mockImplementation(() => {});

    // Mock clack
    vi.mocked(clack.log.error).mockImplementation(() => {});
    vi.mocked(clack.log.success).mockImplementation(() => {});

    // Default mocks
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(core.loadConfig).mockResolvedValue({
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
    });
    vi.mocked(core.saveConfig).mockResolvedValue();
    vi.mocked(core.validateSelector).mockReturnValue({ valid: true });
    vi.mocked(core.parseSelector).mockReturnValue({
      type: "rule",
      value: "test",
    });
  });

  it("accepts valid rule selector", async () => {
    await overrideAdd([
      "--selector",
      "rule[id=test/rule]",
      "--set",
      "severity=error",
    ]);

    expect(mockExit).toHaveBeenCalledWith(0);
    expect(core.validateSelector).toHaveBeenCalledWith("rule[id=test/rule]");
    expect(core.saveConfig).toHaveBeenCalled();

    // Verify config was updated with overlay
    const saveCall = vi.mocked(core.saveConfig).mock.calls[0];
    expect(saveCall).toBeDefined();
    const [savedConfig] = saveCall!;
    expect(savedConfig.overlays).toBeDefined();
    expect(savedConfig.overlays.overrides).toHaveLength(1);
    expect(savedConfig.overlays.overrides[0].selector).toBe(
      "rule[id=test/rule]",
    );
    expect(savedConfig.overlays.overrides[0].set).toEqual({
      severity: "error",
    });
  });

  it("accepts valid property selector", async () => {
    await overrideAdd([
      "add",
      "--selector",
      "profile.version",
      "--set",
      "value=2.0.0",
    ]);

    expect(mockExit).toHaveBeenCalledWith(0);

    const saveCall = vi.mocked(core.saveConfig).mock.calls[0];
    expect(saveCall![0].overlays.overrides[0].selector).toBe("profile.version");
  });

  it("accepts valid array selector", async () => {
    await overrideAdd([
      "add",
      "--selector",
      "rules[0]",
      "--set",
      "enabled=false",
    ]);

    expect(mockExit).toHaveBeenCalledWith(0);

    const saveCall = vi.mocked(core.saveConfig).mock.calls[0];
    expect(saveCall![0].overlays.overrides[0].selector).toBe("rules[0]");
  });

  it("rejects invalid selector syntax", async () => {
    vi.mocked(core.validateSelector).mockReturnValue({
      valid: false,
      error: "Invalid syntax",
    });

    await overrideAdd([
      "add",
      "--selector",
      "bad[[syntax",
      "--set",
      "value=test",
    ]);

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(clack.log.error).toHaveBeenCalledWith(
      expect.stringContaining("Invalid selector"),
    );
  });

  it("rejects unparseable selector", async () => {
    vi.mocked(core.parseSelector).mockReturnValue(null);

    await overrideAdd([
      "add",
      "--selector",
      "complex[[broken",
      "--set",
      "value=test",
    ]);

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(clack.log.error).toHaveBeenCalledWith(
      expect.stringContaining("Could not parse selector"),
    );
  });
});

describe("Override Add - Set Operations Parsing", () => {
  let mockExit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockExit = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    vi.spyOn(console, "log").mockImplementation(() => {});

    vi.mocked(clack.log.error).mockImplementation(() => {});
    vi.mocked(clack.log.success).mockImplementation(() => {});
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(core.loadConfig).mockResolvedValue({
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [],
    });
    vi.mocked(core.saveConfig).mockResolvedValue();
    vi.mocked(core.validateSelector).mockReturnValue({ valid: true });
    vi.mocked(core.parseSelector).mockReturnValue({
      type: "rule",
      value: "test",
    });
  });

  it("parses string value", async () => {
    await overrideAdd([
      "add",
      "--selector",
      "rule[id=test]",
      "--set",
      "severity=error",
    ]);

    const saveCall = vi.mocked(core.saveConfig).mock.calls[0];
    expect(saveCall![0].overlays.overrides[0].set).toEqual({
      severity: "error",
    });
  });

  it("parses boolean value", async () => {
    await overrideAdd([
      "add",
      "--selector",
      "rule[id=test]",
      "--set",
      "enabled=false",
    ]);

    const saveCall = vi.mocked(core.saveConfig).mock.calls[0];
    expect(saveCall![0].overlays.overrides[0].set).toEqual({ enabled: false });
  });

  it("parses JSON object value", async () => {
    await overrideAdd([
      "add",
      "--selector",
      "rule[id=test]",
      "--set",
      'metadata={"key":"value"}',
    ]);

    const saveCall = vi.mocked(core.saveConfig).mock.calls[0];
    expect(saveCall![0].overlays.overrides[0].set).toEqual({
      metadata: { key: "value" },
    });
  });

  it("parses JSON number value", async () => {
    await overrideAdd([
      "add",
      "--selector",
      "rule[id=test]",
      "--set",
      "priority=5",
    ]);

    const saveCall = vi.mocked(core.saveConfig).mock.calls[0];
    expect(saveCall![0].overlays.overrides[0].set).toEqual({ priority: 5 });
  });

  it("parses dot-notation path", async () => {
    await overrideAdd([
      "add",
      "--selector",
      "rule[id=test]",
      "--set",
      "check.inputs.threshold=15",
    ]);

    const saveCall = vi.mocked(core.saveConfig).mock.calls[0];
    expect(saveCall![0].overlays.overrides[0].set).toEqual({
      "check.inputs.threshold": 15,
    });
  });

  it("parses multiple set operations", async () => {
    await overrideAdd([
      "add",
      "--selector",
      "rule[id=test]",
      "--set",
      "severity=critical",
      "--set",
      "enabled=false",
      "--set",
      "priority=10",
    ]);

    const saveCall = vi.mocked(core.saveConfig).mock.calls[0];
    expect(saveCall![0].overlays.overrides[0].set).toEqual({
      severity: "critical",
      enabled: false,
      priority: 10,
    });
  });
});

describe("Override Add - Remove Operations Parsing", () => {
  let mockExit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockExit = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    vi.spyOn(console, "log").mockImplementation(() => {});

    vi.mocked(clack.log.error).mockImplementation(() => {});
    vi.mocked(clack.log.success).mockImplementation(() => {});
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(core.loadConfig).mockResolvedValue({
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [],
    });
    vi.mocked(core.saveConfig).mockResolvedValue();
    vi.mocked(core.validateSelector).mockReturnValue({ valid: true });
    vi.mocked(core.parseSelector).mockReturnValue({
      type: "rule",
      value: "test",
    });
  });

  it("parses single remove operation", async () => {
    await overrideAdd([
      "add",
      "--selector",
      "rule[id=test]",
      "--remove",
      "autofix",
    ]);

    const saveCall = vi.mocked(core.saveConfig).mock.calls[0];
    expect(saveCall![0].overlays.overrides[0].remove).toEqual(["autofix"]);
  });

  it("parses multiple remove operations", async () => {
    await overrideAdd([
      "add",
      "--selector",
      "rule[id=test]",
      "--remove",
      "autofix",
      "--remove",
      "examples",
      "--remove",
      "metadata",
    ]);

    const saveCall = vi.mocked(core.saveConfig).mock.calls[0];
    expect(saveCall![0].overlays.overrides[0].remove).toEqual([
      "autofix",
      "examples",
      "metadata",
    ]);
  });
});

describe("Override Add - Config Updates", () => {
  let mockExit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockExit = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    vi.spyOn(console, "log").mockImplementation(() => {});

    vi.mocked(clack.log.error).mockImplementation(() => {});
    vi.mocked(clack.log.success).mockImplementation(() => {});
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(core.saveConfig).mockResolvedValue();
    vi.mocked(core.validateSelector).mockReturnValue({ valid: true });
    vi.mocked(core.parseSelector).mockReturnValue({
      type: "rule",
      value: "test",
    });
  });

  it("creates overlays.overrides array if missing", async () => {
    vi.mocked(core.loadConfig).mockResolvedValue({
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [],
      // No overlays property
    });

    await overrideAdd([
      "add",
      "--selector",
      "rule[id=test]",
      "--set",
      "severity=error",
    ]);

    const saveCall = vi.mocked(core.saveConfig).mock.calls[0];
    expect(saveCall![0].overlays).toBeDefined();
    expect(saveCall![0].overlays.overrides).toBeInstanceOf(Array);
    expect(saveCall![0].overlays.overrides).toHaveLength(1);
  });

  it("appends to existing overlays array", async () => {
    vi.mocked(core.loadConfig).mockResolvedValue({
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [],
      overlays: {
        overrides: [
          {
            selector: "rule[id=existing]",
            set: { severity: "warn" },
          },
        ],
      },
    });

    await overrideAdd([
      "add",
      "--selector",
      "rule[id=new]",
      "--set",
      "enabled=false",
    ]);

    const saveCall = vi.mocked(core.saveConfig).mock.calls[0];
    expect(saveCall![0].overlays.overrides).toHaveLength(2);
    expect(saveCall![0].overlays.overrides[0].selector).toBe(
      "rule[id=existing]",
    );
    expect(saveCall![0].overlays.overrides[1].selector).toBe("rule[id=new]");
  });

  it("preserves other config properties", async () => {
    vi.mocked(core.loadConfig).mockResolvedValue({
      version: "1",
      mode: "team",
      lockfile: { mode: "strict" },
      exporters: ["cursor", "agents-md"],
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
      team: { approved_sources: ["github.com/org/*"] },
    });

    await overrideAdd([
      "add",
      "--selector",
      "rule[id=test]",
      "--set",
      "severity=error",
    ]);

    const saveCall = vi.mocked(core.saveConfig).mock.calls[0];
    expect(saveCall![0].mode).toBe("team");
    expect(saveCall![0].lockfile).toEqual({ mode: "strict" });
    expect(saveCall![0].exporters).toEqual(["cursor", "agents-md"]);
    expect(saveCall![0].team).toEqual({
      approved_sources: ["github.com/org/*"],
    });

    // Verify overlay added
    expect(saveCall![0].overlays.overrides).toHaveLength(1);
  });
});

describe("Override Add - Error Messages", () => {
  let mockExit: ReturnType<typeof vi.spyOn>;
  let mockLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockExit = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    mockLog = vi.spyOn(console, "log").mockImplementation(() => {});

    vi.mocked(clack.log.error).mockImplementation(() => {});
    vi.mocked(clack.log.success).mockImplementation(() => {});
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(core.loadConfig).mockResolvedValue({
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [],
    });
    vi.mocked(core.saveConfig).mockResolvedValue();
    vi.mocked(core.validateSelector).mockReturnValue({ valid: true });
    vi.mocked(core.parseSelector).mockReturnValue({
      type: "rule",
      value: "test",
    });
  });

  it("shows error for missing operations", async () => {
    await overrideAdd([
      "add",
      "--selector",
      "rule[id=test]",
      // No --set or --remove
    ]);

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(clack.log.error).toHaveBeenCalledWith(
      expect.stringContaining("--set or --remove is required"),
    );
  });

  it("shows error for invalid set format", async () => {
    await overrideAdd([
      "add",
      "--selector",
      "rule[id=test]",
      "--set",
      "invalid-no-equals",
    ]);

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(clack.log.error).toHaveBeenCalledWith(
      expect.stringContaining("Invalid --set format"),
    );
  });
});

describe("Override Add - Multiple Operations", () => {
  let mockExit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockExit = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    vi.spyOn(console, "log").mockImplementation(() => {});

    vi.mocked(clack.log.error).mockImplementation(() => {});
    vi.mocked(clack.log.success).mockImplementation(() => {});
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(core.loadConfig).mockResolvedValue({
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [],
    });
    vi.mocked(core.saveConfig).mockResolvedValue();
    vi.mocked(core.validateSelector).mockReturnValue({ valid: true });
    vi.mocked(core.parseSelector).mockReturnValue({
      type: "rule",
      value: "test",
    });
  });

  it("handles set + remove in single command", async () => {
    await overrideAdd([
      "add",
      "--selector",
      "rule[id=test]",
      "--set",
      "severity=critical",
      "--set",
      "enabled=true",
      "--remove",
      "autofix",
      "--remove",
      "examples",
    ]);

    const saveCall = vi.mocked(core.saveConfig).mock.calls[0];
    expect(saveCall![0].overlays.overrides[0]).toEqual({
      selector: "rule[id=test]",
      set: {
        severity: "critical",
        enabled: true,
      },
      remove: ["autofix", "examples"],
    });
  });
});
