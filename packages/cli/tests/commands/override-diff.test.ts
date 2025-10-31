/**
 * Unit tests for override diff command (Phase 3.5, Session 9)
 * Tests diff generation, selector filtering, output format
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { overrideCommand } from "../../src/commands/override.js";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";

const TEST_DIR = join(process.cwd(), "temp-override-diff-test");

describe("Override Diff - Diff Generation", () => {
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

  it("shows before/after for set operations", async () => {
    // Create IR
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

    await overrideCommand(["diff"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    expect(output).toContain("Overlay diff for:");
    expect(output).toContain("rule[id=test/rule]");
    expect(output).toContain("━━━ Original (upstream) ━━━");
    expect(output).toContain("━━━ With overlay ━━━");
    expect(output).toContain("severity:");
    expect(output).toContain("critical");

    consoleSpy.mockRestore();
  });

  it("shows removed properties for remove operations", async () => {
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
    autofix: true
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
      remove:
        - autofix
`,
    );

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand(["diff"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    expect(output).toContain("autofix:");
    expect(output).toContain("(removed)");

    consoleSpy.mockRestore();
  });

  it("shows combined set and remove operations", async () => {
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
    autofix: true
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
        enabled: false
      remove:
        - autofix
`,
    );

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand(["diff"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    expect(output).toContain("severity:");
    expect(output).toContain("enabled:");
    expect(output).toContain("autofix:");
    expect(output).toContain("(removed)");

    consoleSpy.mockRestore();
  });

  it("shows property count in summary", async () => {
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
        enabled: true
`,
    );

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand(["diff"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    expect(output).toContain("Changes:");
    expect(output).toContain("2 properties");

    consoleSpy.mockRestore();
  });
});

describe("Override Diff - Selector Filtering", () => {
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

  it("filters to specific overlay when selector provided", async () => {
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
  - id: test/rule2
    severity: warn
    message: Test rule 2
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

    await overrideCommand(["diff", "rule[id=test/rule1]"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    expect(output).toContain("rule[id=test/rule1]");
    expect(output).not.toContain("rule[id=test/rule2]");

    consoleSpy.mockRestore();
  });

  it("warns when selector does not match any overlay", async () => {
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

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand(["diff", "rule[id=nonexistent]"]);
    } catch (err) {
      // Expected
    }

    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});

describe("Override Diff - Multiple Overlays", () => {
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

  it("shows combined effects of multiple overlays", async () => {
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
  - id: test/rule2
    severity: info
    message: Test rule 2
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

    await overrideCommand(["diff"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    expect(output).toContain("rule[id=test/rule1]");
    expect(output).toContain("rule[id=test/rule2]");
    expect(output).toContain("2 overlays applied");

    consoleSpy.mockRestore();
  });

  it("shows separators between overlays", async () => {
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
  - id: test/rule2
    severity: warn
    message: Test rule 2
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

    await overrideCommand(["diff"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    // Look for visual separators (━━━)
    const separators = (output.match(/━━━/g) || []).length;
    expect(separators).toBeGreaterThan(0);

    consoleSpy.mockRestore();
  });
});

describe("Override Diff - No Changes Case", () => {
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
      `version: "1"
mode: solo
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/rules.md
`,
    );

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand(["diff"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    expect(output).toContain("No overlays configured");

    consoleSpy.mockRestore();
  });
});

describe("Override Diff - Output Format", () => {
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

  it("uses consistent separator format", async () => {
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

    await overrideCommand(["diff"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    expect(output).toContain("━━━ Original (upstream) ━━━");
    expect(output).toContain("━━━ With overlay ━━━");

    consoleSpy.mockRestore();
  });

  it("includes selector in header", async () => {
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

    await overrideCommand(["diff"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    expect(output).toContain("Overlay diff for: rule[id=test/rule]");

    consoleSpy.mockRestore();
  });

  it("shows property counts correctly", async () => {
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

    await overrideCommand(["diff"]);

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    expect(output).toContain("Changes: 1 property");

    consoleSpy.mockRestore();
  });
});
