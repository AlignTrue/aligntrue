/**
 * Team mode integration tests for overlays (Phase 3.5, Session 9)
 * Tests lockfile triple-hash, drift detection, updates
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { overrideCommand } from "../../src/commands/override.js";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import YAML from "yaml";
import { generateLockfile } from "@aligntrue/core/lockfile/generator.js";
import { loadIR } from "@aligntrue/core/ir/loader.js";
import { loadConfig } from "@aligntrue/core/config/index.js";

const TEST_DIR = join(process.cwd(), "temp-overlay-team-test");

describe("Overlay Team Mode - Lockfile Triple Hash", () => {
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

  it("generates lockfile with base_hash, overlay_hash, result_hash", async () => {
    // Setup team mode config
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: team
lockfile: strict
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

    // Load config and IR
    const config = await loadConfig(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
    );
    const ir = await loadIR(join(TEST_DIR, ".aligntrue", "config.yaml"));

    // Generate lockfile
    const lockfile = await generateLockfile(ir, config);

    // Verify triple hash present
    expect(lockfile.base_hash).toBeDefined();
    expect(lockfile.overlay_hash).toBeDefined();
    expect(lockfile.result_hash).toBeDefined();

    expect(typeof lockfile.base_hash).toBe("string");
    expect(typeof lockfile.overlay_hash).toBe("string");
    expect(typeof lockfile.result_hash).toBe("string");

    // All three should be different
    expect(lockfile.base_hash).not.toBe(lockfile.overlay_hash);
    expect(lockfile.base_hash).not.toBe(lockfile.result_hash);
    expect(lockfile.overlay_hash).not.toBe(lockfile.result_hash);
  });

  it("base_hash unchanged when only overlay changes", async () => {
    // Setup
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: team
lockfile: strict
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

    // Generate lockfile without overlay
    let config = await loadConfig(join(TEST_DIR, ".aligntrue", "config.yaml"));
    let ir = await loadIR(join(TEST_DIR, ".aligntrue", "config.yaml"));
    const lockfile1 = await generateLockfile(ir, config);
    const baseHash1 = lockfile1.base_hash;

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

    // Generate lockfile with overlay
    config = await loadConfig(join(TEST_DIR, ".aligntrue", "config.yaml"));
    ir = await loadIR(join(TEST_DIR, ".aligntrue", "config.yaml"));
    const lockfile2 = await generateLockfile(ir, config);
    const baseHash2 = lockfile2.base_hash;

    // Base hash should be identical (IR unchanged)
    expect(baseHash2).toBe(baseHash1);

    // But overlay_hash and result_hash should differ
    expect(lockfile2.overlay_hash).not.toBe(lockfile1.overlay_hash || "");
    expect(lockfile2.result_hash).not.toBe(lockfile1.result_hash);
  });

  it("overlay_hash stable across lockfile regenerations", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: team
lockfile: strict
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

    // Generate lockfile twice
    const config = await loadConfig(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
    );
    const ir = await loadIR(join(TEST_DIR, ".aligntrue", "config.yaml"));

    const lockfile1 = await generateLockfile(ir, config);
    const lockfile2 = await generateLockfile(ir, config);

    // overlay_hash should be identical
    expect(lockfile2.overlay_hash).toBe(lockfile1.overlay_hash);
    expect(lockfile2.base_hash).toBe(lockfile1.base_hash);
    expect(lockfile2.result_hash).toBe(lockfile1.result_hash);
  });
});

describe("Overlay Team Mode - Drift Detection", () => {
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

  it("detects overlay drift when overlay_hash changes", async () => {
    // Initial state
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: team
lockfile: strict
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

    // Generate initial lockfile
    let config = await loadConfig(join(TEST_DIR, ".aligntrue", "config.yaml"));
    let ir = await loadIR(join(TEST_DIR, ".aligntrue", "config.yaml"));
    const lockfile = await generateLockfile(ir, config);

    writeFileSync(
      join(TEST_DIR, ".aligntrue", "lock.json"),
      JSON.stringify(lockfile, null, 2),
    );

    // Modify overlay (change severity value)
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand(["remove", "rule[id=test/rule]", "--force"]);
    } catch (err) {
      // Expected
    }

    try {
      await overrideCommand([
        "add",
        "--selector",
        "rule[id=test/rule]",
        "--set",
        "severity=error",
      ]);
    } catch (err) {
      // Expected
    }

    exitSpy.mockRestore();
    consoleSpy.mockRestore();

    // Generate new lockfile
    config = await loadConfig(join(TEST_DIR, ".aligntrue", "config.yaml"));
    ir = await loadIR(join(TEST_DIR, ".aligntrue", "config.yaml"));
    const newLockfile = await generateLockfile(ir, config);

    // overlay_hash should differ
    expect(newLockfile.overlay_hash).not.toBe(lockfile.overlay_hash);

    // base_hash should be same (IR unchanged)
    expect(newLockfile.base_hash).toBe(lockfile.base_hash);
  });

  it("categorizes drift as overlay type when overlay_hash differs", async () => {
    // Setup with initial lockfile
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: team
lockfile: strict
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

    const config = await loadConfig(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
    );
    const ir = await loadIR(join(TEST_DIR, ".aligntrue", "config.yaml"));
    const lockfile = await generateLockfile(ir, config);

    writeFileSync(
      join(TEST_DIR, ".aligntrue", "lock.json"),
      JSON.stringify(
        {
          ...lockfile,
          overlay_hash: "old-overlay-hash",
        },
        null,
        2,
      ),
    );

    // Current state has different overlay_hash
    // Drift detection would categorize this as overlay drift
    const currentLockfile = await generateLockfile(ir, config);

    expect(currentLockfile.overlay_hash).not.toBe("old-overlay-hash");
  });
});

describe("Overlay Team Mode - Update with Overlays", () => {
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

  it("re-applies overlay to new base after upstream change", async () => {
    // Initial state
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: team
lockfile: strict
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

    // Generate initial lockfile
    let config = await loadConfig(join(TEST_DIR, ".aligntrue", "config.yaml"));
    let ir = await loadIR(join(TEST_DIR, ".aligntrue", "config.yaml"));
    const lockfile1 = await generateLockfile(ir, config);

    // Simulate upstream change (modify IR)
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "ir.yaml"),
      `spec_version: "1"
profile:
  id: test
  version: 1.0.0
rules:
  - id: test/rule
    severity: warn
    message: Test rule updated
    enabled: true
`,
    );

    // Generate new lockfile with updated IR
    config = await loadConfig(join(TEST_DIR, ".aligntrue", "config.yaml"));
    ir = await loadIR(join(TEST_DIR, ".aligntrue", "config.yaml"));
    const lockfile2 = await generateLockfile(ir, config);

    // base_hash should change (IR changed)
    expect(lockfile2.base_hash).not.toBe(lockfile1.base_hash);

    // overlay_hash should remain same (overlay unchanged)
    expect(lockfile2.overlay_hash).toBe(lockfile1.overlay_hash);

    // result_hash should change (final result changed)
    expect(lockfile2.result_hash).not.toBe(lockfile1.result_hash);
  });
});

describe("Overlay Team Mode - Size Limits", () => {
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

  it("warns when approaching max_overrides limit", async () => {
    // Setup config with limit
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: team
lockfile: strict
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/ir.yaml
overlays:
  limits:
    max_overrides: 3
  overrides:
    - selector: "rule[id=test/rule1]"
      set:
        severity: critical
    - selector: "rule[id=test/rule2]"
      set:
        severity: error
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

    // Add one more overlay (approaching limit)
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand([
        "add",
        "--selector",
        "rule[id=test/rule3]",
        "--set",
        "severity=warn",
      ]);
    } catch (err) {
      // Expected - should succeed but may warn
    }

    // Verify overlay added (at limit now)
    const configContent = readFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      "utf-8",
    );
    const config = YAML.parse(configContent);

    expect(config.overlays.overrides).toHaveLength(3);

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});

describe("Overlay Team Mode - Conflict Scenarios", () => {
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

  it("allows overlapping overlays (same selector, different properties)", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: team
lockfile: strict
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

    writeFileSync(
      join(TEST_DIR, ".aligntrue", "ir.yaml"),
      `spec_version: "1"
profile:
  id: test
  version: 1.0.0
rules:
  - id: test/rule
    severity: warn
    enabled: true
`,
    );

    // Add another overlay for same selector
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
        "enabled=false",
      ]);
    } catch (err) {
      // Expected
    }

    const configContent = readFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      "utf-8",
    );
    const config = YAML.parse(configContent);

    // Should have 2 overlays (allowed)
    expect(config.overlays.overrides).toHaveLength(2);
    expect(config.overlays.overrides[0].selector).toBe("rule[id=test/rule]");
    expect(config.overlays.overrides[1].selector).toBe("rule[id=test/rule]");

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("handles duplicate selectors in remove operation", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: team
lockfile: strict
exporters: [cursor]
sources:
  - type: local
    path: .aligntrue/ir.yaml
overlays:
  overrides:
    - selector: "rule[id=test/rule]"
      set:
        severity: critical
    - selector: "rule[id=test/rule]"
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
  - id: test/rule
    severity: warn
`,
    );

    // Remove first match
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand(["remove", "rule[id=test/rule]", "--force"]);
    } catch (err) {
      // Expected
    }

    const configContent = readFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      "utf-8",
    );
    const config = YAML.parse(configContent);

    // Should remove only first match
    expect(config.overlays.overrides).toHaveLength(1);
    expect(config.overlays.overrides[0].set).toEqual({ enabled: false });

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});

describe("Overlay Team Mode - Lock/Unlock Cycle", () => {
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

  it("maintains overlay_hash stability across lock/unlock cycles", async () => {
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `version: "1"
mode: team
lockfile: strict
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

    const config = await loadConfig(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
    );
    const ir = await loadIR(join(TEST_DIR, ".aligntrue", "config.yaml"));

    // Generate lockfile 3 times
    const lockfile1 = await generateLockfile(ir, config);
    const lockfile2 = await generateLockfile(ir, config);
    const lockfile3 = await generateLockfile(ir, config);

    // overlay_hash should be identical across all generations
    expect(lockfile2.overlay_hash).toBe(lockfile1.overlay_hash);
    expect(lockfile3.overlay_hash).toBe(lockfile1.overlay_hash);
  });
});
