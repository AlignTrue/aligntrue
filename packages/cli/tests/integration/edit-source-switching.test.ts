import { join } from "path";
import {
  writeFileSync,
  readFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
} from "fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import {
  runCli,
  createTestDir,
  cleanupTestDir,
} from "../utils/integration-helpers.js";

describe("Edit Source Switching", () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await createTestDir("edit-source-switching-test");
  });

  afterAll(async () => {
    await cleanupTestDir(testDir);
  });

  afterEach(async () => {
    // Wait for any pending async operations
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  it("should replace IR with new source content when switching edit sources", async () => {
    // 1. Initialize project (creates AGENTS.md with default content)
    await runCli(["init", "--yes", "--mode", "solo"], { cwd: testDir });

    // 2. Verify initial IR content (matches AGENTS.md)
    const irPath = join(testDir, ".aligntrue", ".rules.yaml");
    let irContent = readFileSync(irPath, "utf-8");
    expect(irContent).toContain("Global principles");

    // 3. Create Cursor rule file with UNIQUE content (different from AGENTS.md)
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

    // 4. Run sync to detect Cursor and auto-switch edit source
    // --yes enables non-interactive mode which auto-upgrades edit source
    const result = await runCli(["sync", "--yes", "--verbose"], {
      cwd: testDir,
    });

    expect(result.exitCode).toBe(0);

    // Check output for confirmation of upgrade
    expect(result.stdout).toMatch(/Auto-upgrading edit source to.*Cursor/);

    // Check output for backup confirmation (summary message)
    expect(result.stdout).toMatch(
      /Switched to new source \(backed up 1 old file\(s\)\)/,
    );

    // 5. Verify IR now contains ONLY Cursor content (New Source As Truth)
    irContent = readFileSync(irPath, "utf-8");
    expect(irContent).toContain("Backend Guidelines"); // From Cursor (new source)

    // Should NOT contain old AGENTS.md content in IR anymore (since we switched truth)
    expect(irContent).not.toContain("Global principles");

    // 6. Verify edit source changed in config
    const configPath = join(testDir, ".aligntrue", "config.yaml");
    const configContent = readFileSync(configPath, "utf-8");
    expect(configContent).toContain("edit_source");
    expect(configContent).toContain(".cursor/rules/*.mdc");
  });

  it("should backup old source files to overwritten-rules folder", async () => {
    const overwrittenDir = join(testDir, ".aligntrue", "overwritten-rules");
    expect(existsSync(overwrittenDir)).toBe(true);

    // Check for backed up AGENTS.md file
    const files = readdirSync(overwrittenDir);
    const backedUpAgents = files.find(
      (f) => f.startsWith("AGENTS") && f.endsWith(".md"),
    );
    expect(backedUpAgents).toBeDefined();

    if (backedUpAgents) {
      const backupPath = join(overwrittenDir, backedUpAgents);
      const backupContent = readFileSync(backupPath, "utf-8");
      expect(backupContent).toContain("Global principles"); // Original content preserved
    }
  });

  it("should auto-sync new content to all exporters (including old source file)", async () => {
    // 1. Check that AGENTS.md (old source) now contains NEW content (synced from IR)
    const agentsPath = join(testDir, "AGENTS.md");
    const agentsContent = readFileSync(agentsPath, "utf-8");

    // Should be overwritten with new source content
    expect(agentsContent).toContain("Backend Guidelines");
    expect(agentsContent).not.toContain("Global principles"); // Old content gone (except in backup)

    // Should have read-only warning now
    expect(agentsContent).toContain("WARNING: Read-only export");
    expect(agentsContent).toContain("Edit source: .cursor/rules/*.mdc");
  });
});
