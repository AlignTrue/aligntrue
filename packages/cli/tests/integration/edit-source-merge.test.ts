import { join } from "path";
import { writeFileSync, readFileSync, mkdirSync } from "fs";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  runCli,
  createTestDir,
  cleanupTestDir,
} from "../utils/integration-helpers.js";

describe("Edit Source Merge", () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await createTestDir("edit-source-merge-test");
  });

  afterAll(async () => {
    await cleanupTestDir(testDir);
  });

  it("should merge content from Cursor rules into IR when switching edit source", async () => {
    // 1. Initialize project (creates AGENTS.md)
    await runCli(["init", "--yes", "--mode", "solo"], { cwd: testDir });

    // 2. Verify initial IR content
    const irPath = join(testDir, ".aligntrue", ".rules.yaml");
    let irContent = readFileSync(irPath, "utf-8");
    expect(irContent).toContain("Global principles");

    // 3. Create Cursor rule file with unique content
    const cursorDir = join(testDir, ".cursor", "rules");
    mkdirSync(cursorDir, { recursive: true });
    const cursorPath = join(cursorDir, "backend.mdc");
    const cursorContent = `---
description: Backend rules
globs: "**/*.ts"
---
# Backend Guidelines

Use async/await.
`;
    writeFileSync(cursorPath, cursorContent, "utf-8");

    // 4. Run sync to detect Cursor, upgrade edit source, and merge content
    // --yes enables non-interactive mode which defaults to "keep-both"
    const result = await runCli(["sync", "--yes", "--verbose"], {
      cwd: testDir,
    });

    console.log("CLI Output:", result.stdout);
    console.error("CLI Error:", result.stderr);

    expect(result.exitCode).toBe(0);

    // Check stdout for confirmation of upgrade and merge
    expect(result.stdout).toMatch(/Auto-upgrading edit source to.*Cursor/);

    // 5. Verify IR now contains both AGENTS.md content AND Cursor content
    irContent = readFileSync(irPath, "utf-8");
    expect(irContent).toContain("Global principles"); // From AGENTS.md
    expect(irContent).toContain("Backend Guidelines"); // From Cursor

    // 6. Verify edit source changed in config
    const configPath = join(testDir, ".aligntrue", "config.yaml");
    const configContent = readFileSync(configPath, "utf-8");
    expect(configContent).toContain("edit_source");
    expect(configContent).toContain(".cursor/rules/*.mdc");
  });
});
