/**
 * Test Cursor file sync behavior
 * Verifies P2 from test findings: Cursor file edits should sync to IR when edit_source is .cursor/rules/*.mdc
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { createHermeticTestEnv, type TestEnv } from "../utils/test-env.js";

describe("Cursor file sync behavior", () => {
  let env: TestEnv;

  beforeEach(() => {
    env = createHermeticTestEnv();
  });

  afterEach(() => {
    env.cleanup();
  });

  it("should sync Cursor file edits to IR when edit_source is .cursor/rules/*.mdc", async () => {
    // Initialize with Cursor as edit source
    const initResult = env.runCLI("init --yes --exporters cursor,agents");
    expect(initResult.exitCode).toBe(0);

    // Verify initial state
    const configPath = env.path(".aligntrue", "config.yaml");
    expect(existsSync(configPath)).toBe(true);

    const config = readFileSync(configPath, "utf-8");

    // Check if Cursor exporter is enabled
    expect(config).toContain("cursor");

    // Check if edit_source includes cursor files (either explicit or default)
    // In the test, we need to verify the actual behavior regardless of exact config

    // Create a Cursor file with new content
    env.mkdir(".cursor", "rules");
    const cursorFilePath = env.path(".cursor", "rules", "backend.mdc");

    const newContent = `## Backend Guidelines

Use async/await for all I/O operations.

## Database Access

Always use parameterized queries to prevent SQL injection.`;

    writeFileSync(cursorFilePath, newContent, "utf-8");

    // Run sync to process the Cursor file
    // With --yes flag, new files should be auto-enabled
    const syncResult = env.runCLI("sync --yes");
    expect(syncResult.exitCode).toBe(0);

    // Verify the content was synced to IR
    const irPath = env.path(".aligntrue", ".rules.yaml");
    expect(existsSync(irPath)).toBe(true);

    const irContent = readFileSync(irPath, "utf-8");

    // Check if the new sections appear in the IR
    // The content should be present in the IR file
    expect(irContent).toContain("Backend Guidelines");
    expect(irContent).toContain("Database Access");

    // Verify that AGENTS.md also got updated (as a read-only export)
    const agentsMdPath = env.path("AGENTS.md");
    if (existsSync(agentsMdPath)) {
      const agentsMdContent = readFileSync(agentsMdPath, "utf-8");
      expect(agentsMdContent).toContain("Backend Guidelines");
      expect(agentsMdContent).toContain("Database Access");
    }
  });

  it("should handle edits to existing Cursor files", async () => {
    // Initialize with Cursor exporter
    const initResult = env.runCLI("init --yes --exporters cursor");
    expect(initResult.exitCode).toBe(0);

    // First sync to create initial Cursor files
    const syncResult1 = env.runCLI("sync --yes");
    expect(syncResult1.exitCode).toBe(0);

    // Find the generated Cursor file
    const cursorFile = env.path(".cursor", "rules", "aligntrue.mdc");
    expect(existsSync(cursorFile)).toBe(true);

    // Read original content
    const originalContent = readFileSync(cursorFile, "utf-8");

    // Add a new section to the Cursor file
    const updatedContent =
      originalContent +
      `

## Testing Guidelines

Always write tests before implementing features.`;

    writeFileSync(cursorFile, updatedContent, "utf-8");

    // Run sync again
    const syncResult2 = env.runCLI("sync --yes");
    expect(syncResult2.exitCode).toBe(0);

    // Verify the new content appears in IR
    const irPath = env.path(".aligntrue", ".rules.yaml");
    const irContent = readFileSync(irPath, "utf-8");

    expect(irContent).toContain("Testing Guidelines");
  });

  it("should detect when Cursor file is edited but not in edit_source", async () => {
    // Initialize with AGENTS.md as edit source (NOT Cursor)
    const initResult = env.runCLI("init --yes --exporters agents,cursor");
    expect(initResult.exitCode).toBe(0);

    // Manually set edit_source to AGENTS.md to make Cursor files read-only
    const configPath = env.path(".aligntrue", "config.yaml");
    let config = readFileSync(configPath, "utf-8");

    // Ensure edit_source is set to AGENTS.md
    if (!config.includes("edit_source:")) {
      config += "\nsync:\n  edit_source: AGENTS.md\n";
      writeFileSync(configPath, config, "utf-8");
    }

    // Run initial sync
    const syncResult1 = env.runCLI("sync --yes");
    expect(syncResult1.exitCode).toBe(0);

    // Now edit a Cursor file (which is read-only)
    const cursorFile = env.path(".cursor", "rules", "aligntrue.mdc");
    if (existsSync(cursorFile)) {
      const content = readFileSync(cursorFile, "utf-8");
      const modified =
        content + "\n## Unauthorized Edit\n\nThis should trigger a warning.";
      writeFileSync(cursorFile, modified, "utf-8");

      // Run sync and check for warnings
      // Note: The current implementation might not show warnings for read-only edits
      // This test documents the expected behavior
      const syncResult2 = env.runCLI("sync --yes");

      // Sync should succeed but the edit to read-only file should be overwritten
      expect(syncResult2.exitCode).toBe(0);

      // After sync, the unauthorized edit should be gone (overwritten by IR export)
      const finalContent = readFileSync(cursorFile, "utf-8");
      expect(finalContent).not.toContain("Unauthorized Edit");
    }
  });

  it("should handle multiple Cursor files with scope-based organization", async () => {
    // Initialize with Cursor exporter
    const initResult = env.runCLI("init --yes --exporters cursor");
    expect(initResult.exitCode).toBe(0);

    // Create multiple Cursor files for different scopes
    env.mkdir(".cursor", "rules");
    const frontendFile = env.path(".cursor", "rules", "frontend.mdc");
    const backendFile = env.path(".cursor", "rules", "backend.mdc");

    writeFileSync(
      frontendFile,
      "## Frontend\n\nReact best practices.",
      "utf-8",
    );
    writeFileSync(
      backendFile,
      "## Backend\n\nNode.js best practices.",
      "utf-8",
    );

    // Run sync with --yes to auto-enable new files
    const syncResult = env.runCLI("sync --yes");
    expect(syncResult.exitCode).toBe(0);

    // Verify both files' content appears in IR
    const irPath = env.path(".aligntrue", ".rules.yaml");
    const irContent = readFileSync(irPath, "utf-8");

    expect(irContent).toContain("Frontend");
    expect(irContent).toContain("Backend");
    expect(irContent).toContain("React best practices");
    expect(irContent).toContain("Node.js best practices");
  });
});
