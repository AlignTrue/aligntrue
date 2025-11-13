/**
 * Tests for lockfile drift detection in sync command
 * Verifies that sync correctly detects when rules have changed since last lock
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { sync } from "../src/commands/sync.js";
import { cleanupDir } from "./helpers/fs-cleanup.js";

describe("sync lockfile drift detection", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = mkdtempSync(join(tmpdir(), "aligntrue-sync-lockfile-test-"));
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupDir(testDir);
  });

  it.skip("detects lockfile drift when rules change", async () => {
    // Setup: Create initial config and IR
    const configPath = join(testDir, ".aligntrue", "config.yaml");
    const irPath = join(testDir, ".aligntrue", ".rules.yaml");
    const lockfilePath = join(testDir, ".aligntrue.lock.json");
    const allowListPath = join(testDir, ".aligntrue", "allow.yaml");

    // Create directories
    const aligntrueDir = join(testDir, ".aligntrue");
    const { mkdirSync } = require("fs");
    mkdirSync(aligntrueDir, { recursive: true });

    // Write initial config (team mode, strict lockfile)
    writeFileSync(
      configPath,
      `
mode: team
exporters: []
modules:
  lockfile: true
lockfile:
  mode: strict
`,
    );

    // Write initial IR
    const initialIR = `
id: test-rules
version: 1.0.0
spec_version: "1"
sections:
  - heading: Test rule one
    level: 2
    content: "Initial guidance"
    fingerprint: test-rule-one
`;
    writeFileSync(irPath, initialIR);

    // Run sync to generate initial lockfile
    process.chdir(testDir);
    await sync(["--yes"]);

    // Verify lockfile was created
    expect(readFileSync(lockfilePath, "utf-8")).toBeTruthy();
    const initialLockfile = JSON.parse(readFileSync(lockfilePath, "utf-8"));
    const initialBundleHash = initialLockfile.bundle_hash;

    // Approve the initial bundle hash
    writeFileSync(
      allowListPath,
      `
version: 1
sources:
  - value: sha256:${initialBundleHash}
    approved_by: test-user
    approved_at: 2025-01-01T00:00:00Z
`,
    );

    // Modify the IR (change guidance - must produce different hash)
    const modifiedIR = `
id: test-rules
version: 1.0.0
spec_version: "1"
sections:
  - heading: Test rule one
    level: 2
    content: "MODIFIED guidance that produces different hash"
    fingerprint: test-rule-one
`;
    writeFileSync(irPath, modifiedIR);

    // Run sync again - should detect drift
    let exitCode = 0;
    const originalExit = process.exit;
    process.exit = ((code?: number) => {
      exitCode = code || 0;
      throw new Error(`process.exit(${code})`);
    }) as never;

    try {
      await sync([]);
    } catch (err) {
      // Expected to throw due to process.exit in strict mode
      if (err instanceof Error && err.message.includes("process.exit")) {
        // Expected
      } else {
        throw err;
      }
    } finally {
      process.exit = originalExit;
    }

    // In non-interactive strict mode, should exit with code 1
    expect(exitCode).toBe(1);

    // Verify lockfile hash changed
    const newLockfile = JSON.parse(readFileSync(lockfilePath, "utf-8"));
    expect(newLockfile.bundle_hash).not.toBe(initialBundleHash);
  });

  it.skip("allows sync in soft mode with unapproved hash", async () => {
    // Setup similar to above but with soft mode
    const configPath = join(testDir, ".aligntrue", "config.yaml");
    const irPath = join(testDir, ".aligntrue", ".rules.yaml");
    const lockfilePath = join(testDir, ".aligntrue.lock.json");
    const allowListPath = join(testDir, ".aligntrue", "allow.yaml");

    const aligntrueDir = join(testDir, ".aligntrue");
    const { mkdirSync } = require("fs");
    mkdirSync(aligntrueDir, { recursive: true });

    // Write config with soft mode
    writeFileSync(
      configPath,
      `
mode: team
exporters: []
modules:
  lockfile: true
lockfile:
  mode: soft
`,
    );

    // Write initial IR
    writeFileSync(
      irPath,
      `
id: test-rules
version: 1.0.0
spec_version: "1"
sections:
  - heading: Test rule one
    level: 2
    content: "Initial guidance"
    fingerprint: test-rule-one
`,
    );

    // Run sync to generate initial lockfile
    process.chdir(testDir);
    await sync(["--yes"]);

    const initialLockfile = JSON.parse(readFileSync(lockfilePath, "utf-8"));
    const initialBundleHash = initialLockfile.bundle_hash;

    // Approve the initial bundle hash
    writeFileSync(
      allowListPath,
      `
version: 1
sources:
  - value: sha256:${initialBundleHash}
    approved_by: test-user
    approved_at: 2025-01-01T00:00:00Z
`,
    );

    // Modify the IR (change content to trigger different hash)
    writeFileSync(
      irPath,
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

    // Run sync again - should warn but continue in soft mode
    let exitCode = 0;
    const originalExit = process.exit;
    process.exit = ((code?: number) => {
      exitCode = code || 0;
      throw new Error(`process.exit(${code})`);
    }) as never;

    try {
      await sync([]);
    } catch (err) {
      // Should not throw in soft mode
      if (err instanceof Error && err.message.includes("process.exit")) {
        // Unexpected
        throw err;
      }
    } finally {
      process.exit = originalExit;
    }

    // Should succeed (exit code 0)
    expect(exitCode).toBe(0);

    // Verify lockfile was updated
    const newLockfile = JSON.parse(readFileSync(lockfilePath, "utf-8"));
    expect(newLockfile.bundle_hash).not.toBe(initialBundleHash);
  });

  it.skip("bypasses validation with --force flag", async () => {
    // Setup
    const configPath = join(testDir, ".aligntrue", "config.yaml");
    const irPath = join(testDir, ".aligntrue", ".rules.yaml");
    const lockfilePath = join(testDir, ".aligntrue.lock.json");
    const allowListPath = join(testDir, ".aligntrue", "allow.yaml");

    const aligntrueDir = join(testDir, ".aligntrue");
    const { mkdirSync } = require("fs");
    mkdirSync(aligntrueDir, { recursive: true });

    // Write config with strict mode
    writeFileSync(
      configPath,
      `
mode: team
exporters: []
modules:
  lockfile: true
lockfile:
  mode: strict
`,
    );

    // Write initial IR
    writeFileSync(
      irPath,
      `
id: test-rules
version: 1.0.0
spec_version: "1"
sections:
  - heading: Test rule one
    level: 2
    content: "Initial guidance"
    fingerprint: test-rule-one
`,
    );

    // Run sync to generate initial lockfile
    process.chdir(testDir);
    await sync(["--yes"]);

    const initialLockfile = JSON.parse(readFileSync(lockfilePath, "utf-8"));
    const initialBundleHash = initialLockfile.bundle_hash;

    // Approve the initial bundle hash
    writeFileSync(
      allowListPath,
      `
version: 1
sources:
  - value: sha256:${initialBundleHash}
    approved_by: test-user
    approved_at: 2025-01-01T00:00:00Z
`,
    );

    // Modify the IR (change content to trigger different hash)
    writeFileSync(
      irPath,
      `
id: test-rules
version: 1.0.0
spec_version: "1"
sections:
  - heading: Test rule one
    level: 2
    content: "MODIFIED guidance for force flag test"
    fingerprint: test-rule-one
`,
    );

    // Run sync with --force - should succeed
    await sync(["--force"]);

    // Verify lockfile was updated
    const newLockfile = JSON.parse(readFileSync(lockfilePath, "utf-8"));
    expect(newLockfile.bundle_hash).not.toBe(initialBundleHash);
  });
});
