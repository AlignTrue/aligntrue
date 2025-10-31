/**
 * Unit tests for override status command (Phase 3.5, Session 9)
 * Tests display, health detection, JSON output
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { overrideCommand } from "../../src/commands/override.js";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";

const TEST_DIR = join(process.cwd(), "temp-override-status-test");

describe("Override Status - Display All Overlays", () => {
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

  it("shows human-readable format with single overlay", async () => {
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

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand(["status"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    expect(output).toContain("Overlays");
    expect(output).toContain("rule[id=test/rule]");
    expect(output).toContain("Set:");
    expect(output).toContain("severity");
    expect(output).toContain("critical");

    consoleSpy.mockRestore();
  });

  it("shows all overlays when multiple configured", async () => {
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
    - selector: "rule[id=test/rule3]"
      remove:
        - autofix
`,
    );

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand(["status"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    expect(output).toContain("rule[id=test/rule1]");
    expect(output).toContain("rule[id=test/rule2]");
    expect(output).toContain("rule[id=test/rule3]");
    expect(output).toContain("Remove:");
    expect(output).toContain("autofix");

    consoleSpy.mockRestore();
  });

  it("shows empty state message when no overlays", async () => {
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

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand(["status"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    expect(output).toContain("No overlays configured");
    expect(output).toContain("Add an overlay:");

    consoleSpy.mockRestore();
  });

  it("displays set and remove operations correctly", async () => {
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
        enabled: true
      remove:
        - autofix
        - examples
`,
    );

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand(["status"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    expect(output).toContain("Set:");
    expect(output).toContain("severity");
    expect(output).toContain("enabled");
    expect(output).toContain("Remove:");
    expect(output).toContain("autofix");
    expect(output).toContain("examples");

    consoleSpy.mockRestore();
  });
});

describe("Override Status - Health Detection", () => {
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

  it("shows healthy when selector matches IR", async () => {
    // Create IR with matching rule
    const ir = {
      spec_version: "1",
      profile: { id: "test", version: "1.0.0" },
      rules: [
        {
          id: "test/rule",
          severity: "warn",
          message: "Test rule",
        },
      ],
    };
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

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand(["status"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    expect(output).toContain("✓");
    expect(output).toContain("Healthy: yes");

    consoleSpy.mockRestore();
  });

  it("shows stale when selector does not match IR", async () => {
    // Create IR without matching rule
    const ir = {
      spec_version: "1",
      profile: { id: "test", version: "1.0.0" },
      rules: [
        {
          id: "different/rule",
          severity: "warn",
          message: "Different rule",
        },
      ],
    };
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "ir.yaml"),
      `spec_version: "1"
profile:
  id: test
  version: 1.0.0
rules:
  - id: different/rule
    severity: warn
    message: Different rule
`,
    );

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

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand(["status"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    expect(output).toContain("❌");
    expect(output).toContain("stale");

    consoleSpy.mockRestore();
  });

  it("shows stale count in summary", async () => {
    // IR with only one matching rule
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "ir.yaml"),
      `spec_version: "1"
profile:
  id: test
  version: 1.0.0
rules:
  - id: test/rule1
    severity: warn
    message: Test rule 1
`,
    );

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

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand(["status"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    expect(output).toContain("1 stale");
    expect(output).toContain("💡 Tip:");

    consoleSpy.mockRestore();
  });

  it("shows warning when IR cannot be loaded", async () => {
    // No IR file
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

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand(["status"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    // Without IR, all overlays will show as stale
    expect(output).toContain("stale");

    consoleSpy.mockRestore();
  });
});

describe("Override Status - JSON Output", () => {
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

  it("outputs valid JSON with --json flag", async () => {
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

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand(["status", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    // Should be valid JSON
    const parsed = JSON.parse(output);
    expect(parsed).toBeDefined();

    consoleSpy.mockRestore();
  });

  it("includes total, healthy, stale counts in JSON", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "ir.yaml"),
      `spec_version: "1"
profile:
  id: test
  version: 1.0.0
rules:
  - id: test/rule1
    severity: warn
    message: Test rule 1
`,
    );

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

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand(["status", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    const parsed = JSON.parse(output);

    expect(parsed.total).toBe(2);
    expect(parsed.healthy).toBe(1);
    expect(parsed.stale).toBe(1);

    consoleSpy.mockRestore();
  });

  it("includes overlay details in JSON", async () => {
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
        enabled: true
      remove:
        - autofix
`,
    );

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand(["status", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    const parsed = JSON.parse(output);

    expect(parsed.overlays).toHaveLength(1);
    expect(parsed.overlays[0].selector).toBe("rule[id=test/rule]");
    expect(parsed.overlays[0].operations.set).toEqual({
      severity: "critical",
      enabled: true,
    });
    expect(parsed.overlays[0].operations.remove).toEqual(["autofix"]);

    consoleSpy.mockRestore();
  });

  it("outputs empty structure with --json when no overlays", async () => {
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

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand(["status", "--json"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    const parsed = JSON.parse(output);

    expect(parsed.total).toBe(0);
    expect(parsed.healthy).toBe(0);
    expect(parsed.stale).toBe(0);
    expect(parsed.overlays).toEqual([]);

    consoleSpy.mockRestore();
  });
});

describe("Override Status - Multiple Overlays", () => {
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

  it("displays correct counts with multiple overlays", async () => {
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
    - selector: "rule[id=test/rule3]"
      remove:
        - autofix
`,
    );

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand(["status"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    expect(output).toContain("3 active");

    consoleSpy.mockRestore();
  });

  it("shows all overlays regardless of health status", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "ir.yaml"),
      `spec_version: "1"
profile:
  id: test
  version: 1.0.0
rules:
  - id: test/rule1
    severity: warn
    message: Test rule 1
`,
    );

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

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand(["status"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    // Both should be displayed
    expect(output).toContain("rule[id=test/rule1]");
    expect(output).toContain("rule[id=test/rule2]");

    consoleSpy.mockRestore();
  });
});
