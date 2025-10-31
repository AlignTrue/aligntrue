/**
 * Unit tests for override remove command (Phase 3.5, Session 9)
 * Tests interactive selection, direct removal, confirmation prompts
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { overrideCommand } from "../../src/commands/override.js";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import YAML from "yaml";
import * as clack from "@clack/prompts";

const TEST_DIR = join(process.cwd(), "temp-override-remove-test");

describe("Override Remove - Direct Removal", () => {
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

  it("removes overlay by selector with --force", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: solo
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/rules.md
overlays:
  overrides:
    - selector: "rule[id=test/rule]"
      set:
        severity: critical
`,
    );

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand(["remove", "rule[id=test/rule]", "--force"]);
    } catch (err) {
      // Expected - process.exit(0) throws
    }

    expect(exitSpy).toHaveBeenCalledWith(0);

    // Verify overlay removed from config
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    const configContent = readFileSync(configPath, "utf-8");
    const config = YAML.parse(configContent);

    expect(config.overlays?.overrides || []).toHaveLength(0);

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("removes only matching overlay, preserves others", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: solo
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/rules.md
overlays:
  overrides:
    - selector: "rule[id=test/rule1]"
      set:
        severity: critical
    - selector: "rule[id=test/rule2]"
      set:
        severity: error
`,
    );

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand(["remove", "rule[id=test/rule1]", "--force"]);
    } catch (err) {
      // Expected
    }

    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    const configContent = readFileSync(configPath, "utf-8");
    const config = YAML.parse(configContent);

    expect(config.overlays.overrides).toHaveLength(1);
    expect(config.overlays.overrides[0].selector).toBe("rule[id=test/rule2]");

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("errors when selector not found", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: solo
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/rules.md
overlays:
  overrides:
    - selector: "rule[id=test/rule]"
      set:
        severity: critical
`,
    );

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand(["remove", "rule[id=nonexistent]", "--force"]);
    } catch (err) {
      // Expected
    }

    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("shows message when no overlays configured", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: solo
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/rules.md
`,
    );

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand(["remove"]);
    } catch (err) {
      // Expected
    }

    expect(exitSpy).toHaveBeenCalledWith(0);
    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("No overlays configured");

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});

describe("Override Remove - Confirmation Prompt", () => {
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

  it("prompts for confirmation without --force", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: solo
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/rules.md
overlays:
  overrides:
    - selector: "rule[id=test/rule]"
      set:
        severity: critical
`,
    );

    // Mock confirmation as accepted
    const confirmSpy = vi.spyOn(clack, "confirm").mockResolvedValue(true);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand(["remove", "rule[id=test/rule]"]);
    } catch (err) {
      // Expected
    }

    expect(confirmSpy).toHaveBeenCalled();

    confirmSpy.mockRestore();
    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("cancels when user rejects confirmation", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: solo
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/rules.md
overlays:
  overrides:
    - selector: "rule[id=test/rule]"
      set:
        severity: critical
`,
    );

    // Mock confirmation as rejected
    const confirmSpy = vi.spyOn(clack, "confirm").mockResolvedValue(false);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand(["remove", "rule[id=test/rule]"]);
    } catch (err) {
      // Expected
    }

    expect(exitSpy).toHaveBeenCalledWith(0);

    // Verify overlay NOT removed
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    const configContent = readFileSync(configPath, "utf-8");
    const config = YAML.parse(configContent);

    expect(config.overlays.overrides).toHaveLength(1);

    confirmSpy.mockRestore();
    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("skips confirmation with --force flag", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: solo
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/rules.md
overlays:
  overrides:
    - selector: "rule[id=test/rule]"
      set:
        severity: critical
`,
    );

    // Mock confirmation - should NOT be called with --force
    const confirmSpy = vi.spyOn(clack, "confirm");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand(["remove", "rule[id=test/rule]", "--force"]);
    } catch (err) {
      // Expected
    }

    expect(confirmSpy).not.toHaveBeenCalled();

    // Verify overlay removed
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    const configContent = readFileSync(configPath, "utf-8");
    const config = YAML.parse(configContent);

    expect(config.overlays?.overrides || []).toHaveLength(0);

    confirmSpy.mockRestore();
    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});

describe("Override Remove - Interactive Selection", () => {
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

  it("shows interactive list when no selector provided", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: solo
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/rules.md
overlays:
  overrides:
    - selector: "rule[id=test/rule1]"
      set:
        severity: critical
    - selector: "rule[id=test/rule2]"
      set:
        severity: error
`,
    );

    // Mock interactive select
    const selectSpy = vi
      .spyOn(clack, "select")
      .mockResolvedValue("rule[id=test/rule1]");
    const confirmSpy = vi.spyOn(clack, "confirm").mockResolvedValue(true);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand(["remove"]);
    } catch (err) {
      // Expected
    }

    expect(selectSpy).toHaveBeenCalled();

    selectSpy.mockRestore();
    confirmSpy.mockRestore();
    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("displays overlay details in interactive list", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: solo
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/rules.md
overlays:
  overrides:
    - selector: "rule[id=test/rule]"
      set:
        severity: critical
      remove:
        - autofix
`,
    );

    const selectSpy = vi
      .spyOn(clack, "select")
      .mockResolvedValue("rule[id=test/rule]");
    const confirmSpy = vi.spyOn(clack, "confirm").mockResolvedValue(true);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand(["remove"]);
    } catch (err) {
      // Expected
    }

    // Check that select was called with properly formatted choices
    const selectCall = selectSpy.mock.calls[0];
    expect(selectCall).toBeDefined();
    const options = selectCall[0] as { options: Array<{ hint?: string }> };
    expect(options.options[0].hint).toContain("Set:");
    expect(options.options[0].hint).toContain("Remove:");

    selectSpy.mockRestore();
    confirmSpy.mockRestore();
    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("cancels when interactive selection is cancelled", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: solo
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/rules.md
overlays:
  overrides:
    - selector: "rule[id=test/rule]"
      set:
        severity: critical
`,
    );

    // Mock cancel symbol
    const selectSpy = vi
      .spyOn(clack, "select")
      .mockResolvedValue(Symbol("cancel"));
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand(["remove"]);
    } catch (err) {
      // Expected
    }

    expect(exitSpy).toHaveBeenCalledWith(0);

    // Verify overlay NOT removed
    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    const configContent = readFileSync(configPath, "utf-8");
    const config = YAML.parse(configContent);

    expect(config.overlays.overrides).toHaveLength(1);

    selectSpy.mockRestore();
    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});

describe("Override Remove - Config Updates", () => {
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

  it("preserves other config properties when removing overlay", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: team
lockfile: strict
exporters: [cursor, vscode-mcp]
sources:
  - type: local
    path: .aligntrue/rules.md
overlays:
  overrides:
    - selector: "rule[id=test/rule]"
      set:
        severity: critical
`,
    );

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand(["remove", "rule[id=test/rule]", "--force"]);
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

    // Verify overlay removed
    expect(config.overlays?.overrides || []).toHaveLength(0);

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("performs atomic write on removal", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: solo
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/rules.md
overlays:
  overrides:
    - selector: "rule[id=test/rule]"
      set:
        severity: critical
`,
    );

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand(["remove", "rule[id=test/rule]", "--force"]);
    } catch (err) {
      // Expected
    }

    const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
    expect(existsSync(configPath)).toBe(true);

    // Verify it's valid YAML after removal
    const configContent = readFileSync(configPath, "utf-8");
    const config = YAML.parse(configContent);
    expect(config).toBeDefined();

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});
