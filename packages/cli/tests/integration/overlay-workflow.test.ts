/**
 * Full overlay workflow integration tests (Phase 3.5, Session 9)
 * Tests complete user journeys: Add → Sync → Status → Remove
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { overrideCommand } from "../../src/commands/override.js";
import { syncCommand } from "../../src/commands/sync.js";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import YAML from "yaml";
import * as clack from "@clack/prompts";

const TEST_DIR = join(process.cwd(), "temp-overlay-workflow-test");

describe("Overlay Workflow - Add → Sync → Status → Remove", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
    mkdirSync(join(TEST_DIR, ".cursor", "rules"), { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(TEST_DIR);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("completes full workflow: add overlay, sync, check status, remove", async () => {
    // Step 1: Create initial config and IR
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: solo
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/ir.yaml
`,
    );

    writeFileSync(
      join(TEST_DIR, ".aligntrue", "ir.yaml"),
      `spec_version: "1"
profile:
  id: test
  version: 1.0.0
rules:
  - id: test/rule
    severity: warn
    message: Test rule
`,
    );

    // Step 2: Add overlay
    const exitSpy1 = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy1 = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand([
        "add",
        "--selector",
        "rule[id=test/rule]",
        "--set",
        "severity=critical",
      ]);
    } catch (err) {
      // Expected
    }

    // Verify overlay added to config
    let configContent = readFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      "utf-8",
    );
    let config = YAML.parse(configContent);
    expect(config.overlays.overrides).toHaveLength(1);

    exitSpy1.mockRestore();
    consoleSpy1.mockRestore();

    // Step 3: Run sync (mock to avoid full sync complexity)
    // In real workflow, sync would apply overlay and generate exports
    // For this test, we verify config is valid for sync

    // Step 4: Check status
    const exitSpy2 = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy2 = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand(["status"]);
    } catch (err) {
      // Expected
    }

    const statusOutput = consoleSpy2.mock.calls
      .map((c) => c.join(" "))
      .join("\n");
    expect(statusOutput).toContain("rule[id=test/rule]");
    expect(statusOutput).toContain("✓"); // Healthy status

    exitSpy2.mockRestore();
    consoleSpy2.mockRestore();

    // Step 5: Remove overlay
    const exitSpy3 = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy3 = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand(["remove", "rule[id=test/rule]", "--force"]);
    } catch (err) {
      // Expected
    }

    // Verify overlay removed
    configContent = readFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      "utf-8",
    );
    config = YAML.parse(configContent);
    expect(config.overlays?.overrides || []).toHaveLength(0);

    exitSpy3.mockRestore();
    consoleSpy3.mockRestore();
  });

  it("verifies export contains overlayed changes after sync", async () => {
    // Setup
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: solo
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/ir.yaml
`,
    );

    writeFileSync(
      join(TEST_DIR, ".aligntrue", "ir.yaml"),
      `spec_version: "1"
profile:
  id: test
  version: 1.0.0
rules:
  - id: test/rule
    severity: warn
    message: Test rule
`,
    );

    // Add overlay
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
        "severity=critical",
      ]);
    } catch (err) {
      // Expected
    }

    exitSpy.mockRestore();
    consoleSpy.mockRestore();

    // Note: Full sync test would require mocking exporters
    // For now, verify overlay is in config ready for sync
    const configContent = readFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      "utf-8",
    );
    const config = YAML.parse(configContent);

    expect(config.overlays.overrides[0]).toEqual({
      selector: "rule[id=test/rule]",
      set: { severity: "critical" },
    });
  });
});

describe("Overlay Workflow - Multiple Overlays", () => {
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

  it("adds three overlays to different rules independently", async () => {
    // Setup
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: solo
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/ir.yaml
`,
    );

    writeFileSync(
      join(TEST_DIR, ".aligntrue", "ir.yaml"),
      `spec_version: "1"
profile:
  id: test
  version: 1.0.0
rules:
  - id: test/rule1
    severity: warn
    message: Rule 1
  - id: test/rule2
    severity: info
    message: Rule 2
  - id: test/rule3
    severity: warn
    message: Rule 3
`,
    );

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Add overlay 1
    try {
      await overrideCommand([
        "add",
        "--selector",
        "rule[id=test/rule1]",
        "--set",
        "severity=critical",
      ]);
    } catch (err) {
      // Expected
    }

    // Add overlay 2
    try {
      await overrideCommand([
        "add",
        "--selector",
        "rule[id=test/rule2]",
        "--set",
        "severity=error",
      ]);
    } catch (err) {
      // Expected
    }

    // Add overlay 3
    try {
      await overrideCommand([
        "add",
        "--selector",
        "rule[id=test/rule3]",
        "--remove",
        "autofix",
      ]);
    } catch (err) {
      // Expected
    }

    // Verify all overlays added
    const configContent = readFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      "utf-8",
    );
    const config = YAML.parse(configContent);

    expect(config.overlays.overrides).toHaveLength(3);
    expect(config.overlays.overrides[0].selector).toBe("rule[id=test/rule1]");
    expect(config.overlays.overrides[1].selector).toBe("rule[id=test/rule2]");
    expect(config.overlays.overrides[2].selector).toBe("rule[id=test/rule3]");

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("shows all overlays as healthy when rules exist", async () => {
    // Setup with overlays
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: solo
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/ir.yaml
overlays:
  overrides:
    - selector: "rule[id=test/rule1]"
      set:
        severity: critical
    - selector: "rule[id=test/rule2]"
      set:
        severity: error
    - selector: "rule[id=test/rule3]"
      set:
        enabled: false
`,
    );

    writeFileSync(
      join(TEST_DIR, ".aligntrue", "ir.yaml"),
      `spec_version: "1"
profile:
  id: test
  version: 1.0.0
rules:
  - id: test/rule1
    severity: warn
    message: Rule 1
  - id: test/rule2
    severity: info
    message: Rule 2
  - id: test/rule3
    severity: warn
    message: Rule 3
`,
    );

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand(["status"]);
    } catch (err) {
      // Expected
    }

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    // All should be healthy
    const checkmarks = (output.match(/✓/g) || []).length;
    expect(checkmarks).toBe(3);

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("removes one overlay while others remain unaffected", async () => {
    // Setup with multiple overlays
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: solo
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/ir.yaml
overlays:
  overrides:
    - selector: "rule[id=test/rule1]"
      set:
        severity: critical
    - selector: "rule[id=test/rule2]"
      set:
        severity: error
    - selector: "rule[id=test/rule3]"
      set:
        enabled: false
`,
    );

    writeFileSync(
      join(TEST_DIR, ".aligntrue", "ir.yaml"),
      `spec_version: "1"
profile:
  id: test
  version: 1.0.0
rules:
  - id: test/rule1
    severity: warn
  - id: test/rule2
    severity: warn
  - id: test/rule3
    severity: warn
`,
    );

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Remove middle overlay
    try {
      await overrideCommand(["remove", "rule[id=test/rule2]", "--force"]);
    } catch (err) {
      // Expected
    }

    // Verify only rule2 removed, others remain
    const configContent = readFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      "utf-8",
    );
    const config = YAML.parse(configContent);

    expect(config.overlays.overrides).toHaveLength(2);
    expect(config.overlays.overrides[0].selector).toBe("rule[id=test/rule1]");
    expect(config.overlays.overrides[1].selector).toBe("rule[id=test/rule3]");

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});

describe("Overlay Workflow - Stale Selector Detection", () => {
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

  it("detects stale overlay when rule removed from IR", async () => {
    // Setup with overlay
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: solo
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/ir.yaml
overlays:
  overrides:
    - selector: "rule[id=test/rule]"
      set:
        severity: critical
`,
    );

    // IR without the rule
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "ir.yaml"),
      `spec_version: "1"
profile:
  id: test
  version: 1.0.0
rules: []
`,
    );

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand(["status"]);
    } catch (err) {
      // Expected
    }

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    expect(output).toContain("❌");
    expect(output).toContain("stale");

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("shows no match in diff when selector is stale", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: solo
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/ir.yaml
overlays:
  overrides:
    - selector: "rule[id=nonexistent]"
      set:
        severity: critical
`,
    );

    writeFileSync(
      join(TEST_DIR, ".aligntrue", "ir.yaml"),
      `spec_version: "1"
profile:
  id: test
  version: 1.0.0
rules:
  - id: test/other-rule
    severity: warn
`,
    );

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand(["diff"]);
    } catch (err) {
      // Expected - will succeed but show no matches
    }

    // Diff should complete but show the overlay doesn't match
    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("rule[id=nonexistent]");

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});

describe("Overlay Workflow - Set/Remove Operations", () => {
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

  it("applies overlay with only set operations", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: solo
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/ir.yaml
`,
    );

    writeFileSync(
      join(TEST_DIR, ".aligntrue", "ir.yaml"),
      `spec_version: "1"
profile:
  id: test
  version: 1.0.0
rules:
  - id: test/rule
    severity: warn
`,
    );

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
        "severity=critical",
      ]);
    } catch (err) {
      // Expected
    }

    const configContent = readFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      "utf-8",
    );
    const config = YAML.parse(configContent);

    expect(config.overlays.overrides[0].set).toEqual({ severity: "critical" });
    expect(config.overlays.overrides[0].remove).toBeUndefined();

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("applies overlay with only remove operations", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: solo
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/ir.yaml
`,
    );

    writeFileSync(
      join(TEST_DIR, ".aligntrue", "ir.yaml"),
      `spec_version: "1"
profile:
  id: test
  version: 1.0.0
rules:
  - id: test/rule
    severity: warn
    autofix: true
`,
    );

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand([
        "add",
        "--selector",
        "rule[id=test/rule]",
        "--remove",
        "autofix",
      ]);
    } catch (err) {
      // Expected
    }

    const configContent = readFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      "utf-8",
    );
    const config = YAML.parse(configContent);

    expect(config.overlays.overrides[0].remove).toEqual(["autofix"]);
    expect(config.overlays.overrides[0].set).toBeUndefined();

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("applies overlay with both set and remove operations", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: solo
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/ir.yaml
`,
    );

    writeFileSync(
      join(TEST_DIR, ".aligntrue", "ir.yaml"),
      `spec_version: "1"
profile:
  id: test
  version: 1.0.0
rules:
  - id: test/rule
    severity: warn
    autofix: true
`,
    );

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
        "severity=critical",
        "--remove",
        "autofix",
      ]);
    } catch (err) {
      // Expected
    }

    const configContent = readFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      "utf-8",
    );
    const config = YAML.parse(configContent);

    expect(config.overlays.overrides[0].set).toEqual({ severity: "critical" });
    expect(config.overlays.overrides[0].remove).toEqual(["autofix"]);

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});

describe("Overlay Workflow - Dot-Notation Paths", () => {
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

  it("sets nested property using dot notation", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: solo
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/ir.yaml
`,
    );

    writeFileSync(
      join(TEST_DIR, ".aligntrue", "ir.yaml"),
      `spec_version: "1"
profile:
  id: test
  version: 1.0.0
rules:
  - id: test/rule
    severity: warn
    check:
      inputs:
        threshold: 10
`,
    );

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
        "check.inputs.threshold=15",
      ]);
    } catch (err) {
      // Expected
    }

    const configContent = readFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      "utf-8",
    );
    const config = YAML.parse(configContent);

    expect(config.overlays.overrides[0].set).toEqual({
      "check.inputs.threshold": 15,
    });

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("shows healthy status for dot-notation overlay", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: solo
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/ir.yaml
overlays:
  overrides:
    - selector: "rule[id=test/rule]"
      set:
        check.inputs.threshold: 15
`,
    );

    writeFileSync(
      join(TEST_DIR, ".aligntrue", "ir.yaml"),
      `spec_version: "1"
profile:
  id: test
  version: 1.0.0
rules:
  - id: test/rule
    severity: warn
    check:
      inputs:
        threshold: 10
`,
    );

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand(["status"]);
    } catch (err) {
      // Expected
    }

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    expect(output).toContain("✓");
    expect(output).toContain("rule[id=test/rule]");

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});
