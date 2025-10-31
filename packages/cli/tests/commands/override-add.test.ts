/**
 * Unit tests for override add command (Phase 3.5, Session 9)
 * Tests selector validation, operation parsing, config updates
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { overrideCommand } from "../../src/commands/override.js";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import YAML from "yaml";

const TEST_DIR = join(process.cwd(), "temp-override-add-test");

describe("Override Add - Selector Validation", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(TEST_DIR);

    // Create minimal config
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"\nmode: solo\nexporters: [cursor]\nsources:\n  - type: local\n    path: .aligntrue/rules.md\n`,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("accepts valid rule selector", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand([
        "add",
        "--selector",
        "rule[id=test/rule]",
        "--set",
        "severity=error",
      ]);
    } catch (err) {
      // Expected - process.exit(0) throws
    }

    expect(exitSpy).toHaveBeenCalledWith(0);

    // Verify config was updated
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    const configContent = readFileSync(configPath, "utf-8");
    const config = YAML.parse(configContent);

    expect(config.overlays).toBeDefined();
    expect(config.overlays.overrides).toHaveLength(1);
    expect(config.overlays.overrides[0].selector).toBe("rule[id=test/rule]");

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("accepts valid property selector", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand([
        "add",
        "--selector",
        "profile.version",
        "--set",
        "value=2.0.0",
      ]);
    } catch (err) {
      // Expected
    }

    expect(exitSpy).toHaveBeenCalledWith(0);

    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    const configContent = readFileSync(configPath, "utf-8");
    const config = YAML.parse(configContent);

    expect(config.overlays.overrides[0].selector).toBe("profile.version");

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("accepts valid array selector", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand([
        "add",
        "--selector",
        "rules[0]",
        "--set",
        "enabled=true",
      ]);
    } catch (err) {
      // Expected
    }

    expect(exitSpy).toHaveBeenCalledWith(0);

    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    const configContent = readFileSync(configPath, "utf-8");
    const config = YAML.parse(configContent);

    expect(config.overlays.overrides[0].selector).toBe("rules[0]");

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("rejects invalid selector syntax", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand([
        "add",
        "--selector",
        "invalid[selector",
        "--set",
        "severity=error",
      ]);
    } catch (err) {
      // Expected
    }

    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("requires selector flag", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    try {
      await overrideCommand(["add", "--set", "severity=error"]);
    } catch (err) {
      // Expected - Commander will error on missing required option
    }

    // Commander exits with code 1 for missing required options
    expect(exitSpy).toHaveBeenCalled();

    exitSpy.mockRestore();
  });
});

describe("Override Add - Set Operations Parsing", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(TEST_DIR);

    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"\nmode: solo\nexporters: [cursor]\nsources:\n  - type: local\n    path: .aligntrue/rules.md\n`,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("parses simple string value", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand([
        "add",
        "--selector",
        "rule[id=test]",
        "--set",
        "severity=error",
      ]);
    } catch (err) {
      // Expected
    }

    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    const configContent = readFileSync(configPath, "utf-8");
    const config = YAML.parse(configContent);

    expect(config.overlays.overrides[0].set).toEqual({ severity: "error" });

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("parses JSON boolean value", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand([
        "add",
        "--selector",
        "rule[id=test]",
        "--set",
        "enabled=true",
      ]);
    } catch (err) {
      // Expected
    }

    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    const configContent = readFileSync(configPath, "utf-8");
    const config = YAML.parse(configContent);

    expect(config.overlays.overrides[0].set).toEqual({ enabled: true });

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("parses JSON number value", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand([
        "add",
        "--selector",
        "rule[id=test]",
        "--set",
        "priority=5",
      ]);
    } catch (err) {
      // Expected
    }

    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    const configContent = readFileSync(configPath, "utf-8");
    const config = YAML.parse(configContent);

    expect(config.overlays.overrides[0].set).toEqual({ priority: 5 });

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("parses dot-notation path", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand([
        "add",
        "--selector",
        "rule[id=test]",
        "--set",
        "check.inputs.threshold=15",
      ]);
    } catch (err) {
      // Expected
    }

    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    const configContent = readFileSync(configPath, "utf-8");
    const config = YAML.parse(configContent);

    expect(config.overlays.overrides[0].set).toEqual({
      "check.inputs.threshold": 15,
    });

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("parses multiple set operations", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand([
        "add",
        "--selector",
        "rule[id=test]",
        "--set",
        "severity=critical",
        "--set",
        "enabled=false",
      ]);
    } catch (err) {
      // Expected
    }

    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    const configContent = readFileSync(configPath, "utf-8");
    const config = YAML.parse(configContent);

    expect(config.overlays.overrides[0].set).toEqual({
      severity: "critical",
      enabled: false,
    });

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("rejects invalid set format", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand([
        "add",
        "--selector",
        "rule[id=test]",
        "--set",
        "invalid-no-equals",
      ]);
    } catch (err) {
      // Expected
    }

    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});

describe("Override Add - Remove Operations Parsing", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(TEST_DIR);

    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"\nmode: solo\nexporters: [cursor]\nsources:\n  - type: local\n    path: .aligntrue/rules.md\n`,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("parses single remove operation", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand([
        "add",
        "--selector",
        "rule[id=test]",
        "--remove",
        "autofix",
      ]);
    } catch (err) {
      // Expected
    }

    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    const configContent = readFileSync(configPath, "utf-8");
    const config = YAML.parse(configContent);

    expect(config.overlays.overrides[0].remove).toEqual(["autofix"]);

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("parses multiple remove operations", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand([
        "add",
        "--selector",
        "rule[id=test]",
        "--remove",
        "autofix",
        "--remove",
        "examples",
      ]);
    } catch (err) {
      // Expected
    }

    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    const configContent = readFileSync(configPath, "utf-8");
    const config = YAML.parse(configContent);

    expect(config.overlays.overrides[0].remove).toEqual([
      "autofix",
      "examples",
    ]);

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});

describe("Override Add - Config Updates", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(TEST_DIR);

    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"\nmode: solo\nexporters: [cursor]\nsources:\n  - type: local\n    path: .aligntrue/rules.md\n`,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("creates overlays.overrides array if missing", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand([
        "add",
        "--selector",
        "rule[id=test]",
        "--set",
        "severity=error",
      ]);
    } catch (err) {
      // Expected
    }

    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    const configContent = readFileSync(configPath, "utf-8");
    const config = YAML.parse(configContent);

    expect(config.overlays).toBeDefined();
    expect(config.overlays.overrides).toBeInstanceOf(Array);
    expect(config.overlays.overrides).toHaveLength(1);

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("appends to existing overlays array", async () => {
    // Pre-populate config with one overlay
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"\nmode: solo\nexporters: [cursor]\nsources:\n  - type: local\n    path: .aligntrue/rules.md\noverlays:\n  overrides:\n    - selector: "rule[id=existing]"\n      set:\n        severity: warn\n`,
    );

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand([
        "add",
        "--selector",
        "rule[id=new]",
        "--set",
        "severity=error",
      ]);
    } catch (err) {
      // Expected
    }

    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    const configContent = readFileSync(configPath, "utf-8");
    const config = YAML.parse(configContent);

    expect(config.overlays.overrides).toHaveLength(2);
    expect(config.overlays.overrides[0].selector).toBe("rule[id=existing]");
    expect(config.overlays.overrides[1].selector).toBe("rule[id=new]");

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("preserves other config properties", async () => {
    // Config with team mode settings
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"\nmode: team\nlockfile: strict\nexporters: [cursor, vscode-mcp]\nsources:\n  - type: local\n    path: .aligntrue/rules.md\n`,
    );

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand([
        "add",
        "--selector",
        "rule[id=test]",
        "--set",
        "severity=error",
      ]);
    } catch (err) {
      // Expected
    }

    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    const configContent = readFileSync(configPath, "utf-8");
    const config = YAML.parse(configContent);

    // Verify original properties preserved
    expect(config.version).toBe("1");
    expect(config.mode).toBe("team");
    expect(config.lockfile).toBe("strict");
    expect(config.exporters).toEqual(["cursor", "vscode-mcp"]);

    // Verify overlay added
    expect(config.overlays.overrides).toHaveLength(1);

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("performs atomic write (file exists after error recovery)", async () => {
    // This test validates that saveConfig is atomic (from core package)
    // We just verify the file is written correctly even on success path
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand([
        "add",
        "--selector",
        "rule[id=test]",
        "--set",
        "severity=error",
      ]);
    } catch (err) {
      // Expected
    }

    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    expect(existsSync(configPath)).toBe(true);

    // Verify it's valid YAML
    const configContent = readFileSync(configPath, "utf-8");
    const config = YAML.parse(configContent);
    expect(config).toBeDefined();

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});

describe("Override Add - Error Messages", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(TEST_DIR);

    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"\nmode: solo\nexporters: [cursor]\nsources:\n  - type: local\n    path: .aligntrue/rules.md\n`,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("shows error for missing operations", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand(["add", "--selector", "rule[id=test]"]);
    } catch (err) {
      // Expected
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("--set or --remove is required");

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("shows examples for invalid selector", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand([
        "add",
        "--selector",
        "bad[selector",
        "--set",
        "severity=error",
      ]);
    } catch (err) {
      // Expected
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("Valid formats:");

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("shows examples for invalid set format", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand([
        "add",
        "--selector",
        "rule[id=test]",
        "--set",
        "no-equals-sign",
      ]);
    } catch (err) {
      // Expected
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("Expected format: key=value");

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});

describe("Override Add - Multiple Operations", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(TEST_DIR);

    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"\nmode: solo\nexporters: [cursor]\nsources:\n  - type: local\n    path: .aligntrue/rules.md\n`,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("handles set + remove in single command", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand([
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
    } catch (err) {
      // Expected
    }

    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    const configContent = readFileSync(configPath, "utf-8");
    const config = YAML.parse(configContent);

    expect(config.overlays.overrides[0]).toEqual({
      selector: "rule[id=test]",
      set: {
        severity: "critical",
        enabled: true,
      },
      remove: ["autofix", "examples"],
    });

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});
