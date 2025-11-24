import { join } from "path";
import { writeFileSync, existsSync, readFileSync } from "fs";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
// Correct import path for test helpers
import {
  runCli,
  createTestDir,
  cleanupTestDir,
} from "../utils/integration-helpers.js";

// Skip: This test suite was for bidirectional extraction which has been removed
// in the Ruler-style architecture refactor. Sync is now unidirectional (IR -> agents).
describe.skip("New File Extraction", () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await createTestDir("extraction-test");
  });

  afterAll(async () => {
    await cleanupTestDir(testDir);
  });

  it("should extract content from new agent files before overwriting", async () => {
    // 1. Initialize project
    await runCli(["init", "--yes", "--mode", "solo"], { cwd: testDir });

    // 2. Create a new agent file with unique content
    const claudePath = join(testDir, "CLAUDE.md");
    const claudeContent = `## Claude Tips

Use concise prompts.

## Unique Section

This content should be extracted.
`;
    writeFileSync(claudePath, claudeContent, "utf-8");

    // 3. Run sync to detect and extract
    // Note: --yes auto-enables exporters
    const result = await runCli(["sync", "--yes"], { cwd: testDir });
    expect(result.exitCode).toBe(0);

    // 4. Verify extracted-rules.md exists
    const extractedPath = join(testDir, ".aligntrue", "extracted-rules.md");
    expect(existsSync(extractedPath)).toBe(true);

    // 5. Verify content was extracted
    const extractedContent = readFileSync(extractedPath, "utf-8");
    expect(extractedContent).toContain("Extracted from: CLAUDE.md");
    expect(extractedContent).toContain("## Unique Section");
    expect(extractedContent).toContain("This content should be extracted.");

    // 6. Verify CLAUDE.md was overwritten with current rules (AGENTS.md content)
    // Current rules (from init) typically have "Global principles" etc.
    const newClaudeContent = readFileSync(claudePath, "utf-8");
    expect(newClaudeContent).not.toContain("## Unique Section");
    expect(newClaudeContent).toContain("Global principles"); // Standard default rule

    // 7. Verify config updated
    const configPath = join(testDir, ".aligntrue", "config.yaml");
    const configContent = readFileSync(configPath, "utf-8");
    expect(configContent).toContain("claude");
  });
});
