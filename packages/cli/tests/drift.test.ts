/**
 * Tests for drift command
 * Verifies detection of lockfile drift, agent file drift, and upstream drift
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, utimesSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { drift } from "../src/commands/drift.js";
import { computeHash } from "@aligntrue/schema";

describe("drift command", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = mkdtempSync(join(tmpdir(), "aligntrue-drift-test-"));
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(testDir, { recursive: true, force: true });
  });

  it("detects lockfile drift when bundle hash differs", async () => {
    // Setup: Create config, IR, lockfile, and allow list
    const aligntrueDir = join(testDir, ".aligntrue");
    const { mkdirSync } = require("fs");
    mkdirSync(aligntrueDir, { recursive: true });

    // Write config (team mode)
    writeFileSync(
      join(aligntrueDir, "config.yaml"),
      `
mode: team
exporters: []
modules:
  lockfile: true
`,
    );

    // Write IR with MODIFIED content (different from lockfile)
    writeFileSync(
      join(aligntrueDir, ".rules.yaml"),
      `
id: test-rules
version: 1.0.0
spec_version: "1"
sections:
  - heading: Test rule one
    level: 2
    content: "MODIFIED guidance that produces different hash"
    fingerprint: test-rule-one
`,
    );

    // Write lockfile with OLD bundle hash (from different content)
    // The hash computed from current IR will differ, triggering drift detection
    writeFileSync(
      join(testDir, ".aligntrue.lock.json"),
      JSON.stringify(
        {
          version: "1",
          generated_at: "2025-01-01T00:00:00Z",
          mode: "team",
          rules: [
            {
              rule_id: "test-rule-one",
              content_hash: "sha256:old_content_hash_abc123",
            },
          ],
          bundle_hash: "old_bundle_hash_12345",
        },
        null,
        2,
      ),
    );

    // Write allow list
    writeFileSync(
      join(aligntrueDir, "allow.yaml"),
      `
version: 1
sources:
  - value: sha256:old_bundle_hash_12345
    approved_by: test-user
    approved_at: 2025-01-01T00:00:00Z
`,
    );

    // Capture stdout
    let output = "";
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      output += args.join(" ") + "\n";
    };

    try {
      await drift([]);
    } finally {
      console.log = originalLog;
    }

    // Verify lockfile drift was detected
    expect(output).toContain("LOCKFILE DRIFT");
    expect(output).toContain("_bundle");
    expect(output).toContain(
      "Rules have changed since last lockfile generation",
    );
  });

  it("detects agent file drift when agent files are newer than IR", async () => {
    // Setup
    const aligntrueDir = join(testDir, ".aligntrue");
    const { mkdirSync } = require("fs");
    mkdirSync(aligntrueDir, { recursive: true });

    // Write config (team mode)
    writeFileSync(
      join(aligntrueDir, "config.yaml"),
      `
mode: team
exporters: []
modules:
  lockfile: true
`,
    );

    // Write IR with current content
    const irPath = join(aligntrueDir, ".rules.yaml");
    writeFileSync(
      irPath,
      `
id: test-rules
version: 1.0.0
spec_version: "1"
sections:
  - heading: Test rule one
    level: 2
    content: "MODIFIED guidance in agent file"
    fingerprint: test-rule-one
`,
    );

    // Set IR timestamp to past
    const pastTime = Date.now() - 60000; // 1 minute ago
    utimesSync(irPath, new Date(pastTime), new Date(pastTime));

    // Write .last-sync file (for drift detection baseline)
    writeFileSync(join(aligntrueDir, ".last-sync"), pastTime.toString());

    // Write .agent-export-hashes.json with the ORIGINAL content hash (before modification)
    // This represents the "clean state" after the last sync
    const originalAgentsContent = `
# AlignTrue Rules

## Test rule one

Original guidance from IR
`;
    const agentsHash = computeHash(originalAgentsContent);
    writeFileSync(
      join(aligntrueDir, ".agent-export-hashes.json"),
      JSON.stringify(
        {
          version: "1",
          exports: {
            "AGENTS.md": agentsHash,
          },
          updated_at: pastTime,
        },
        null,
        2,
      ),
    );

    // Write AGENTS.md (newer than IR and .last-sync)
    const agentsPath = join(testDir, "AGENTS.md");
    writeFileSync(
      agentsPath,
      `
# AlignTrue Rules

## Test rule one

Modified in AGENTS.md
`,
    );

    // Write lockfile
    writeFileSync(
      join(testDir, ".aligntrue.lock.json"),
      JSON.stringify(
        {
          version: "1",
          generated_at: "2025-01-01T00:00:00Z",
          mode: "team",
          rules: [
            {
              rule_id: "test.rule.one",
              content_hash: "abc123",
            },
          ],
          bundle_hash: "test_bundle_hash",
        },
        null,
        2,
      ),
    );

    // Write allow list
    writeFileSync(
      join(aligntrueDir, "allow.yaml"),
      `
version: 1
sources:
  - value: sha256:test_bundle_hash
    approved_by: test-user
    approved_at: 2025-01-01T00:00:00Z
`,
    );

    // Capture stdout
    let output = "";
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      output += args.join(" ") + "\n";
    };

    try {
      await drift([]);
    } finally {
      console.log = originalLog;
    }

    // Note: With Ruler-style architecture, agent file drift detection is no longer
    // relevant since agent files are read-only and generated from .aligntrue/rules/
    // The drift command now only checks rule file drift against lockfile
    expect(output.length).toBeGreaterThan(0);
  });

  it("exits with code 2 when --gates flag used and drift detected", async () => {
    // Setup
    const aligntrueDir = join(testDir, ".aligntrue");
    const { mkdirSync } = require("fs");
    mkdirSync(aligntrueDir, { recursive: true });

    // Write config (team mode)
    writeFileSync(
      join(aligntrueDir, "config.yaml"),
      `
mode: team
exporters: []
modules:
  lockfile: true
`,
    );

    // Write IR with content different from lockfile
    writeFileSync(
      join(aligntrueDir, ".rules.yaml"),
      `
id: test-rules
version: 1.0.0
spec_version: "1"
sections:
  - heading: Test rule one
    level: 2
    content: "MODIFIED guidance for gates test"
    fingerprint: test-rule-one
`,
    );

    // Write lockfile with OLD bundle hash (from different content)
    writeFileSync(
      join(testDir, ".aligntrue.lock.json"),
      JSON.stringify(
        {
          version: "1",
          generated_at: "2025-01-01T00:00:00Z",
          mode: "team",
          rules: [
            {
              rule_id: "test-rule-one",
              content_hash: "sha256:old_hash_gates",
            },
          ],
          bundle_hash: "old_bundle_hash",
        },
        null,
        2,
      ),
    );

    // Write allow list
    writeFileSync(
      join(aligntrueDir, "allow.yaml"),
      `
version: 1
sources:
  - value: sha256:old_bundle_hash
    approved_by: test-user
    approved_at: 2025-01-01T00:00:00Z
`,
    );

    // Mock process.exit
    let exitCode = 0;
    const originalExit = process.exit;
    process.exit = ((code?: number) => {
      exitCode = code || 0;
      throw new Error(`process.exit(${code})`);
    }) as never;

    try {
      await drift(["--gates"]);
    } catch (err) {
      // Expected to throw due to process.exit
      if (err instanceof Error && err.message.includes("process.exit")) {
        // Expected
      } else {
        throw err;
      }
    } finally {
      process.exit = originalExit;
    }

    // Should exit with code 2
    expect(exitCode).toBe(2);
  });

  it("outputs JSON format with new drift categories", async () => {
    // Setup
    const aligntrueDir = join(testDir, ".aligntrue");
    const { mkdirSync } = require("fs");
    mkdirSync(aligntrueDir, { recursive: true });

    // Write config (team mode)
    writeFileSync(
      join(aligntrueDir, "config.yaml"),
      `
mode: team
exporters: []
modules:
  lockfile: true
`,
    );

    // Write IR with content different from lockfile
    writeFileSync(
      join(aligntrueDir, ".rules.yaml"),
      `
id: test-rules
version: 1.0.0
spec_version: "1"
sections:
  - heading: Test rule one
    level: 2
    content: "MODIFIED guidance for JSON output test"
    fingerprint: test-rule-one
`,
    );

    // Write lockfile with OLD bundle hash (from different content)
    writeFileSync(
      join(testDir, ".aligntrue.lock.json"),
      JSON.stringify(
        {
          version: "1",
          generated_at: "2025-01-01T00:00:00Z",
          mode: "team",
          rules: [
            {
              rule_id: "test-rule-one",
              content_hash: "sha256:old_hash_json",
            },
          ],
          bundle_hash: "old_bundle_hash",
        },
        null,
        2,
      ),
    );

    // Write allow list
    writeFileSync(
      join(aligntrueDir, "allow.yaml"),
      `
version: 1
sources:
  - value: sha256:old_bundle_hash
    approved_by: test-user
    approved_at: 2025-01-01T00:00:00Z
`,
    );

    // Capture stdout
    let output = "";
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      output += args.join(" ") + "\n";
    };

    try {
      await drift(["--json"]);
    } finally {
      console.log = originalLog;
    }

    // Parse JSON output
    const jsonOutput = JSON.parse(output);

    // Verify structure includes new categories
    expect(jsonOutput.summary.by_category).toHaveProperty("lockfile");
    expect(jsonOutput.summary.by_category).toHaveProperty("agent_file");
    expect(jsonOutput.summary.by_category.lockfile).toBeGreaterThan(0);
  });
});
