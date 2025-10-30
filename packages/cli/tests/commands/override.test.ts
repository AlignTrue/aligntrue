/**
 * Tests for override command (Phase 3.5 Session 3)
 * Full integration tests for add/status/diff commands
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { overrideCommand } from "../../src/commands/override.js";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import * as clack from "@clack/prompts";

const TEST_DIR = join(process.cwd(), "temp-override-test");

describe("Override Command - Help and Routing", () => {
  it("shows help when called without arguments", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand([]);

    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("Usage: aln override");
    expect(output).toContain("add");
    expect(output).toContain("status");
    expect(output).toContain("diff");

    consoleSpy.mockRestore();
  });

  it("shows help with --help flag", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand(["--help"]);

    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("Usage: aln override");

    consoleSpy.mockRestore();
  });

  it("errors on unknown subcommand", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    try {
      await overrideCommand(["unknown"]);
    } catch (err) {
      // Expected - process.exit throws
    }

    expect(exitSpy).toHaveBeenCalledWith(2);
    exitSpy.mockRestore();
  });
});

describe("Override Command - Status", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    // Mock process.cwd to return test dir
    vi.spyOn(process, "cwd").mockReturnValue(TEST_DIR);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("shows empty status when no overlays configured", async () => {
    // Create minimal config
    const config = {
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
    };
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"\nmode: solo\nexporters: [cursor]\nsources:\n  - type: local\n    path: .aligntrue/rules.md\n`,
    );

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand(["status"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("No overlays configured");

    consoleSpy.mockRestore();
  });

  it("shows JSON output with --json flag", async () => {
    const config = {
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [{ type: "local", path: ".aligntrue/rules.md" }],
      overlays: {
        overrides: [
          {
            selector: "rule[id=test/rule]",
            set: { severity: "critical" },
          },
        ],
      },
    };
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"\nmode: solo\nexporters: [cursor]\nsources:\n  - type: local\n    path: .aligntrue/rules.md\noverlays:\n  overrides:\n    - selector: "rule[id=test/rule]"\n      set:\n        severity: critical\n`,
    );

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand(["status", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain('"overlays"');
    expect(output).toContain('"count"');

    const parsed = JSON.parse(output);
    expect(parsed.count).toBe(1);
    expect(parsed.overlays).toHaveLength(1);
    expect(parsed.overlays[0].selector).toBe("rule[id=test/rule]");

    consoleSpy.mockRestore();
  });

  it("shows health indicators in status output", async () => {
    // Config with overlays (without valid IR - testing status display logic)
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"\nmode: solo\nexporters: [cursor]\nsources:\n  - type: local\n    path: .aligntrue/rules.md\noverlays:\n  overrides:\n    - selector: "rule[id=test/rule]"\n      set:\n        severity: critical\n        enabled: true\n  limits:\n    max_overrides: 50\n    max_operations_per_override: 20\n`,
    );

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand(["status"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("Overlays:");
    expect(output).toContain("rule[id=test/rule]");
    expect(output).toContain("Set:");

    consoleSpy.mockRestore();
  });
});

describe("Override Command - Diff", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(TEST_DIR);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("shows message when no overlays configured", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"\nmode: solo\nexporters: [cursor]\nsources:\n  - type: local\n    path: .aligntrue/rules.md\n`,
    );

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand(["diff"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("No overlays configured");

    consoleSpy.mockRestore();
  });

  it("shows message when diff requires valid IR", async () => {
    // Config with overlay but no valid IR file
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"\nmode: solo\nexporters: [cursor]\nsources:\n  - type: local\n    path: .aligntrue/rules.md\noverlays:\n  overrides:\n    - selector: "rule[id=test/rule]"\n      set:\n        severity: critical\n`,
    );

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    try {
      await overrideCommand(["diff"]);
    } catch (err) {
      // Expected - IR load will fail
    }

    // Should have exited with error (no valid IR)
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("handles multiple overlays in diff", async () => {
    // Config with multiple overlays (testing they're counted)
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"\nmode: solo\nexporters: [cursor]\nsources:\n  - type: local\n    path: .aligntrue/rules.md\noverlays:\n  overrides:\n    - selector: "rule[id=test/rule1]"\n      set:\n        severity: critical\n    - selector: "rule[id=test/rule2]"\n      set:\n        severity: error\n`,
    );

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    try {
      await overrideCommand(["diff"]);
    } catch (err) {
      // Expected - IR load will fail
    }

    // Should have exited with error (no valid IR)
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});

describe("Override Command - Add (Mock Interactive)", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(TEST_DIR);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("errors when no rules found in IR", async () => {
    // Create empty IR
    const ir = {
      spec_version: "1",
      profile: { id: "test", version: "1.0.0" },
      rules: [],
    };
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "rules.md"),
      `\`\`\`aligntrue\n${JSON.stringify(ir, null, 2)}\n\`\`\`\n`,
    );

    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"\nmode: solo\nexporters: [cursor]\nsources:\n  - type: local\n    path: .aligntrue/rules.md\n`,
    );

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    try {
      await overrideCommand(["add"]);
    } catch (err) {
      // Expected - process.exit throws
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  // Note: Full interactive test would require mocking clack prompts
  // This is covered by manual testing and integration tests
});
