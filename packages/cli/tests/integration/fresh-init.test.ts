/**
 * Integration tests for fresh user init workflow
 * Tests the complete flow from init to sync to ensure new users can get started successfully
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";
import { validateAlignSchema, validateRuleId } from "@aligntrue/schema";
import { parseYamlToJson } from "@aligntrue/schema";

describe("Fresh user experience", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "aligntrue-fresh-test-"));
  });

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  // NOTE: These tests are skipped because they require full CLI built and are end-to-end.
  // They should run in CI instead of in pre-push gate. To enable, run with NODE_ENV=test
  // and ensure @aligntrue/cli is built first.
  it.skip("init creates files with valid rule IDs", () => {
    // Run init in non-interactive mode
    execSync("pnpm --filter @aligntrue/cli exec aligntrue init --yes", {
      cwd: testDir,
      stdio: "ignore",
    });

    // Check that files were created
    expect(existsSync(join(testDir, ".aligntrue/config.yaml"))).toBe(true);
    expect(existsSync(join(testDir, ".aligntrue/rules.md"))).toBe(true);
    expect(
      existsSync(join(testDir, ".cursor/rules/aligntrue-starter.mdc")),
    ).toBe(true);

    // Load and validate IR
    const irPath = join(testDir, ".aligntrue/rules.md");
    const irContent = readFileSync(irPath, "utf-8");

    // Extract YAML from markdown
    const yamlMatch = irContent.match(/```aligntrue\n([\s\S]+?)\n```/);
    expect(yamlMatch).toBeTruthy();

    const ir = parseYamlToJson(yamlMatch![1]);

    // Validate schema
    const schemaValidation = validateAlignSchema(ir, { mode: "solo" });
    if (!schemaValidation.valid) {
      console.error("Schema validation errors:", schemaValidation.errors);
    }
    expect(schemaValidation.valid).toBe(true);

    // Validate all rule IDs
    const rules = (ir as any).rules || [];
    for (const rule of rules) {
      const idValidation = validateRuleId(rule.id);
      if (!idValidation.valid) {
        console.error(`Invalid rule ID: ${rule.id}`, idValidation.error);
      }
      expect(idValidation.valid).toBe(true);
    }

    // Check cursor file has valid IDs
    const cursorPath = join(testDir, ".cursor/rules/aligntrue-starter.mdc");
    const cursorContent = readFileSync(cursorPath, "utf-8");

    const ruleIdMatches = cursorContent.matchAll(/## Rule: (.+)/g);
    const cursorRuleIds = Array.from(ruleIdMatches, (m) => m[1]);

    expect(cursorRuleIds.length).toBeGreaterThan(0);

    for (const id of cursorRuleIds) {
      const idValidation = validateRuleId(id);
      if (!idValidation.valid) {
        console.error(`Invalid cursor rule ID: ${id}`, idValidation.error);
      }
      expect(idValidation.valid).toBe(true);
    }
  });

  it.skip("init → sync workflow succeeds", () => {
    // Run init
    execSync("pnpm --filter @aligntrue/cli exec aligntrue init --yes", {
      cwd: testDir,
      stdio: "ignore",
    });

    // Run sync
    const syncOutput = execSync(
      "pnpm --filter @aligntrue/cli exec aligntrue sync",
      {
        cwd: testDir,
        encoding: "utf-8",
      },
    );

    // Check sync succeeded
    expect(syncOutput).toContain("Sync complete");
    // Note: Auto-pull validation might warn about invalid Cursor files, but sync should still succeed
    expect(syncOutput).not.toContain("Operation failed");

    // Verify exported files exist
    expect(
      existsSync(join(testDir, ".cursor/rules/aligntrue-starter.mdc")),
    ).toBe(true);
    expect(existsSync(join(testDir, "AGENTS.md"))).toBe(true);
  });

  it.skip("init → check workflow succeeds", () => {
    // Run init
    execSync("pnpm --filter @aligntrue/cli exec aligntrue init --yes", {
      cwd: testDir,
      stdio: "ignore",
    });

    // Run check
    const checkOutput = execSync(
      "pnpm --filter @aligntrue/cli exec aligntrue check --ci",
      {
        cwd: testDir,
        encoding: "utf-8",
      },
    );

    // Check validation passed
    expect(checkOutput).not.toContain("failed");
    expect(checkOutput).not.toContain("error");
    expect(checkOutput).not.toContain("invalid");
  });

  it.skip("init does not auto-run sync", () => {
    // Run init and capture output
    const initOutput = execSync(
      "pnpm --filter @aligntrue/cli exec aligntrue init --yes",
      {
        cwd: testDir,
        encoding: "utf-8",
      },
    );

    // Check that init output does NOT contain sync messages
    expect(initOutput).not.toContain("Syncing");
    expect(initOutput).not.toContain("Auto-pull");

    // Check that init shows next steps
    expect(initOutput).toContain("Success");
    expect(initOutput).toContain("aligntrue sync");
  });

  it.skip("import → sync workflow succeeds", () => {
    // Create a cursor file manually
    const cursorDir = join(testDir, ".cursor/rules");
    execSync(`mkdir -p "${cursorDir}"`);

    const cursorContent = `---
description: Test rules
alwaysApply: true
---
## Rule: quality.test.example

**Severity:** error

**Applies to:**
- \`**/*.ts\`

Example test rule with valid 3-segment ID.
`;

    require("fs").writeFileSync(join(cursorDir, "test.mdc"), cursorContent);

    // Initialize AlignTrue config
    execSync(`mkdir -p "${join(testDir, ".aligntrue")}"`);
    require("fs").writeFileSync(
      join(testDir, ".aligntrue/config.yaml"),
      "exporters:\n  - cursor\n  - agents-md\n",
    );

    // Run import with --write
    const importOutput = execSync(
      "pnpm --filter @aligntrue/cli exec aligntrue import cursor --write",
      {
        cwd: testDir,
        encoding: "utf-8",
      },
    );

    // Check import succeeded
    expect(importOutput).toContain("Imported");
    expect(importOutput).toContain("rules");

    // Run sync
    const syncOutput = execSync(
      "pnpm --filter @aligntrue/cli exec aligntrue sync",
      {
        cwd: testDir,
        encoding: "utf-8",
      },
    );

    // Check sync succeeded
    expect(syncOutput).toContain("Sync complete");
  });
});

describe("Validation safeguards", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "aligntrue-validation-test-"));
  });

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it.skip("sync validates rule IDs before proceeding", () => {
    // Run init
    execSync("pnpm --filter @aligntrue/cli exec aligntrue init --yes", {
      cwd: testDir,
      stdio: "ignore",
    });

    // Manually corrupt the IR with invalid rule ID
    const irPath = join(testDir, ".aligntrue/rules.md");
    let irContent = readFileSync(irPath, "utf-8");

    // Replace a valid ID with an invalid one
    irContent = irContent.replace(
      "quality.typescript.strict",
      "typescript-strict",
    );

    require("fs").writeFileSync(irPath, irContent);

    // Try to sync - should fail with clear error
    try {
      execSync("pnpm --filter @aligntrue/cli exec aligntrue sync", {
        cwd: testDir,
        encoding: "utf-8",
      });
      fail("Sync should have failed with invalid rule ID");
    } catch (error: any) {
      const output = (error.stdout || "") + (error.stderr || "");

      // Check that error message mentions validation failure
      expect(output).toContain("Validation failed");
      // Error should be about the IR validation, not necessarily showing the ID itself
      expect(output).toContain("Fix the errors above");
    }
  });

  it.skip("import generates single-block markdown format", () => {
    // Create a cursor file
    const cursorDir = join(testDir, ".cursor/rules");
    execSync(`mkdir -p "${cursorDir}"`);

    const cursorContent = `---
description: Test
---
## Rule: quality.test.valid

**Severity:** error

**Applies to:**
- \`**/*.ts\`

Valid rule.
`;

    require("fs").writeFileSync(join(cursorDir, "test.mdc"), cursorContent);

    // Initialize config
    execSync(`mkdir -p "${join(testDir, ".aligntrue")}"`);
    require("fs").writeFileSync(
      join(testDir, ".aligntrue/config.yaml"),
      "exporters:\n  - cursor\n",
    );

    // Run import with --write
    execSync(
      "pnpm --filter @aligntrue/cli exec aligntrue import cursor --write",
      {
        cwd: testDir,
        stdio: "ignore",
      },
    );

    // Read generated IR
    const irPath = join(testDir, ".aligntrue/rules.md");
    const irContent = readFileSync(irPath, "utf-8");

    // Should have exactly one fenced block
    const blockMatches = irContent.match(/```aligntrue/g);
    expect(blockMatches).toBeTruthy();
    expect(blockMatches!.length).toBe(1);

    // Should be valid markdown structure
    const yamlMatch = irContent.match(/```aligntrue\n([\s\S]+?)\n```/);
    expect(yamlMatch).toBeTruthy();

    const ir = parseYamlToJson(yamlMatch![1]);
    expect(ir).toBeTruthy();
    expect((ir as any).rules).toBeTruthy();
  });

  it.skip("templates use same rule IDs after generation", () => {
    // Run init
    execSync("pnpm --filter @aligntrue/cli exec aligntrue init --yes", {
      cwd: testDir,
      stdio: "ignore",
    });

    // Read all generated files
    const irPath = join(testDir, ".aligntrue/rules.md");
    const cursorPath = join(testDir, ".cursor/rules/aligntrue-starter.mdc");

    const irContent = readFileSync(irPath, "utf-8");
    const cursorContent = readFileSync(cursorPath, "utf-8");

    // Extract rule IDs from IR
    const irMatch = irContent.match(/```aligntrue\n([\s\S]+?)\n```/);
    const ir = parseYamlToJson(irMatch![1]) as any;
    const irIds = ir.rules.map((r: any) => r.id).sort();

    // Extract rule IDs from Cursor
    const cursorMatches = cursorContent.matchAll(/## Rule: (.+)/g);
    const cursorIds = Array.from(cursorMatches, (m) => m[1]).sort();

    // Should be identical
    expect(irIds).toEqual(cursorIds);

    // All should be valid
    for (const id of irIds) {
      const validation = validateRuleId(id);
      expect(validation.valid).toBe(true);
    }
  });
});
