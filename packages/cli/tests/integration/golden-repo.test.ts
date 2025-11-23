import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import { execSync } from "child_process";

import { setupTestProject, TestProjectContext } from "../helpers/test-setup.js";

const REPO_ROOT = join(__dirname, "../../../../");

/**
 * Integration Tests: Golden Repository Workflows
 *
 * These tests validate end-to-end workflows using a fresh copy of the golden repo.
 * They ensure the <60 second setup claim is accurate and deterministic.
 */

const GOLDEN_REPO_SOURCE = join(
  __dirname,
  "../../../..",
  "examples/golden-repo",
);

let testProjectContext: TestProjectContext;

beforeEach(async () => {
  testProjectContext = setupTestProject();

  // Ensure CLI is built within the test project
  // The comprehensive test runner builds the CLI once, so this is redundant.
  // execSync("pnpm --filter @aligntrue/cli build", {
  //   cwd: testProjectContext.projectDir,
  //   stdio: "pipe",
  // });
});

afterEach(async () => {
  // Cleanup
  if (testProjectContext) {
    await testProjectContext.cleanup();
  }
});

describe("Golden Repository Workflows", () => {
  it("Fresh init workflow completes in <60 seconds", async () => {
    const startTime = Date.now();

    // Start with empty directory
    const projectDir = join(testProjectContext.projectDir, "fresh-project");
    await fs.mkdir(projectDir, { recursive: true });

    try {
      // Initialize fresh AlignTrue project
      const initCmd = `node ${join(REPO_ROOT, "packages/cli/dist/index.js")} init --exporters cursor,agents --project-id test-project --yes`;
      const initOutput = execSync(initCmd, {
        cwd: projectDir,
        encoding: "utf-8",
      });
      console.log("Init output:", initOutput);

      // Run sync
      const syncCmd = `node ${join(REPO_ROOT, "packages/cli/dist/index.js")} sync`;
      const syncOutput = execSync(syncCmd, {
        cwd: projectDir,
        encoding: "utf-8",
      });
      console.log("Sync output:", syncOutput);
    } catch (error) {
      // Log error details for debugging
      console.error("Init/Sync error:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      throw error;
    }

    // Verify outputs exist
    // Init creates 5 starter rules, sync exports them
    // After first sync, starter file is removed and replaced with synced output
    // NOTE: In fresh init with default settings, the edit source is AGENTS.md (single file).
    // Since AGENTS.md is the edit source, it is NOT overwritten with read-only markers.
    // The .cursor/rules/aligntrue.mdc file IS generated as a read-only export.

    // List directories for debugging
    const filesList = await fs.readdir(projectDir, { recursive: true });
    console.log("Project directory:", projectDir);
    console.log("Project files:", filesList);

    // Check if .cursor directory exists
    const cursorDir = join(projectDir, ".cursor");
    console.log(
      ".cursor directory exists:",
      await fs
        .access(cursorDir)
        .then(() => true)
        .catch(() => false),
    );

    // Check if .cursor/rules directory exists
    const rulesDir = join(projectDir, ".cursor/rules");
    console.log(
      ".cursor/rules directory exists:",
      await fs
        .access(rulesDir)
        .then(() => true)
        .catch(() => false),
    );

    const syncedCursorExists = await fs
      .access(join(projectDir, ".cursor/rules/aligntrue.mdc"))
      .then(() => true)
      .catch(() => false);
    console.log(".cursor/rules/aligntrue.mdc exists:", syncedCursorExists);
    const agentsExists = await fs
      .access(join(projectDir, "AGENTS.md"))
      .then(() => true)
      .catch(() => false);
    const irExists = await fs
      .access(join(projectDir, ".aligntrue/.rules.yaml"))
      .then(() => true)
      .catch(() => false);

    expect(syncedCursorExists).toBe(true); // Synced output created
    expect(agentsExists).toBe(true);
    expect(irExists).toBe(true);

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(60000); // <60 seconds
  }, 60000);

  it.skip("Edit → sync workflow updates outputs and content hash", async () => {
    // Setup: Copy golden repo
    const projectDir = join(testProjectContext.projectDir, "edit-project");
    await fs.cp(GOLDEN_REPO_SOURCE, projectDir, { recursive: true });

    // Also copy hidden directories that fs.cp might miss
    const hiddenDirs = [".aligntrue", ".cursor", ".vscode"];
    for (const dir of hiddenDirs) {
      const srcDir = join(GOLDEN_REPO_SOURCE, dir);
      const dstDir = join(projectDir, dir);
      try {
        await fs.cp(srcDir, dstDir, { recursive: true });
      } catch {
        // Directory might not exist, continue
      }
    }

    // Initial sync
    execSync(`node ${join(REPO_ROOT, "packages/cli/dist/index.js")} sync`, {
      cwd: projectDir,
      stdio: "pipe",
    });

    // Read initial hash
    const initialCursor = await fs.readFile(
      join(projectDir, ".cursor/rules/aligntrue.mdc"),
      "utf8",
    );
    const initialHashMatch = initialCursor.match(
      /Content Hash: ([a-f0-9]{64})/,
    );
    expect(initialHashMatch).toBeTruthy();
    const initialHash = initialHashMatch![1];

    // Edit native format (Cursor .mdc) - this is the solo dev workflow
    const cursorPath = join(projectDir, ".cursor/rules/aligntrue.mdc");
    const cursorContent = await fs.readFile(cursorPath, "utf8");
    const updatedCursor = cursorContent.replace(
      /Content Hash:/,
      `## Rule: testing.example.newrule

**Severity:** INFO
**Applies to:** \`**/*.ts\`

New rule added via native format editing

---

Content Hash:`,
    );
    await fs.writeFile(cursorPath, updatedCursor);

    // Sync again - auto-pull will pull from Cursor, then sync to other agents
    execSync(`node ${join(REPO_ROOT, "packages/cli/dist/index.js")} sync`, {
      cwd: projectDir,
      stdio: "pipe",
    });

    // Verify hash changed
    const finalCursor = await fs.readFile(cursorPath, "utf8");
    const finalHashMatch = finalCursor.match(/Content Hash: ([a-f0-9]{64})/);
    expect(finalHashMatch).toBeTruthy();
    const finalHash = finalHashMatch![1];

    expect(finalHash).not.toBe(initialHash);
    expect(finalCursor).toContain("testing.example.newrule");

    // Verify AGENTS.md also has the new rule
    const agentsMd = await fs.readFile(join(projectDir, "AGENTS.md"), "utf8");
    expect(agentsMd).toContain("testing.example.newrule");
  });

  it.skip("Multi-exporter validation generates all 3 outputs with correct format", async () => {
    // Setup
    const projectDir = join(testProjectContext.projectDir, "multi-exporter");
    await fs.cp(GOLDEN_REPO_SOURCE, projectDir, { recursive: true });

    // Also copy hidden directories that fs.cp might miss
    const hiddenDirs = [".aligntrue", ".cursor", ".vscode"];
    for (const dir of hiddenDirs) {
      const srcDir = join(GOLDEN_REPO_SOURCE, dir);
      const dstDir = join(projectDir, dir);
      try {
        await fs.cp(srcDir, dstDir, { recursive: true });
      } catch {
        // Directory might not exist, continue
      }
    }

    // Sync
    execSync(`node ${join(REPO_ROOT, "packages/cli/dist/index.js")} sync`, {
      cwd: projectDir,
      stdio: "pipe",
    });

    // Verify Cursor format - should have YAML frontmatter but no AlignTrue metadata
    const cursorContent = await fs.readFile(
      join(projectDir, ".cursor/rules/aligntrue.mdc"),
      "utf8",
    );
    expect(cursorContent).toContain("---"); // YAML frontmatter
    expect(cursorContent).toContain("##"); // Markdown headers
    // Should NOT contain AlignTrue metadata
    expect(cursorContent).not.toContain("Content Hash:");
    expect(cursorContent).not.toContain("Generated by AlignTrue");

    // Verify AGENTS.md format - should be clean without AlignTrue headers
    const agentsContent = await fs.readFile(
      join(projectDir, "AGENTS.md"),
      "utf8",
    );
    expect(agentsContent).toContain("## Rule:");
    expect(agentsContent).toContain("Severity:");
    // Should NOT contain AlignTrue metadata
    expect(agentsContent).not.toContain("Generated by AlignTrue");
    expect(agentsContent).not.toContain("Content Hash");

    // Verify MCP config format
    const mcpContent = await fs.readFile(
      join(projectDir, ".vscode/mcp.json"),
      "utf8",
    );
    const mcpJson = JSON.parse(mcpContent);
    expect(mcpJson.version).toBe("v1"); // MCP uses 'v1' format
    expect(mcpJson.generated_by).toBe("AlignTrue");
    expect(mcpJson.rules).toBeInstanceOf(Array);
    expect(mcpJson.rules.length).toBeGreaterThan(0);
    expect(mcpJson.content_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it.skip("Auto-pull pulls manual Cursor edits into IR and syncs to other agents", async () => {
    // Setup
    const projectDir = join(testProjectContext.projectDir, "auto-pull-project");
    await fs.cp(GOLDEN_REPO_SOURCE, projectDir, { recursive: true });

    // Also copy hidden directories that fs.cp might miss
    const hiddenDirs = [".aligntrue", ".cursor", ".vscode"];
    for (const dir of hiddenDirs) {
      const srcDir = join(GOLDEN_REPO_SOURCE, dir);
      const dstDir = join(projectDir, dir);
      try {
        await fs.cp(srcDir, dstDir, { recursive: true });
      } catch {
        // Directory might not exist, continue
      }
    }

    // Initial sync
    execSync(`node ${join(REPO_ROOT, "packages/cli/dist/index.js")} sync`, {
      cwd: projectDir,
      stdio: "pipe",
    });

    // Manually edit Cursor output (simulating native-format editing)
    // Change guidance text rather than rule ID (to avoid schema validation issues)
    const cursorPath = join(projectDir, ".cursor/rules/aligntrue.mdc");
    const cursorContent = await fs.readFile(cursorPath, "utf8");
    const modifiedCursor = cursorContent.replace(
      "Every new feature must include unit tests",
      "Every new feature must include comprehensive unit tests",
    );
    await fs.writeFile(cursorPath, modifiedCursor);

    // Sync with --force (non-interactive) - auto-pull will pull the edit from Cursor
    execSync(
      `node ${join(REPO_ROOT, "packages/cli/dist/index.js")} sync --force`,
      {
        cwd: projectDir,
        stdio: "pipe",
      },
    );

    // Verify edit was preserved in Cursor (auto-pull accepted it)
    const finalCursor = await fs.readFile(cursorPath, "utf8");
    expect(finalCursor).toContain("comprehensive unit tests");

    // Verify edit was synced to IR
    const rulesContent = await fs.readFile(
      join(projectDir, ".aligntrue/.rules.yaml"),
      "utf8",
    );
    expect(rulesContent).toContain("comprehensive unit tests");

    // Verify edit was synced to other agents
    const agentsMd = await fs.readFile(join(projectDir, "AGENTS.md"), "utf8");
    expect(agentsMd).toContain("comprehensive unit tests");
  });

  it.skip("Dry-run mode shows audit trail without writing files", async () => {
    // Setup
    const projectDir = join(testProjectContext.projectDir, "dry-run-project");
    await fs.cp(GOLDEN_REPO_SOURCE, projectDir, { recursive: true });

    // Also copy hidden directories that fs.cp might miss
    const hiddenDirs = [".aligntrue", ".cursor", ".vscode"];
    for (const dir of hiddenDirs) {
      const srcDir = join(GOLDEN_REPO_SOURCE, dir);
      const dstDir = join(projectDir, dir);
      try {
        await fs.cp(srcDir, dstDir, { recursive: true });
      } catch {
        // Directory might not exist, continue
      }
    }

    // Remove outputs if they exist
    await fs.rm(join(projectDir, ".cursor"), { recursive: true, force: true });
    await fs.rm(join(projectDir, ".vscode"), { recursive: true, force: true });
    await fs.rm(join(projectDir, "AGENTS.md"), { force: true });

    // Dry-run sync
    const output = execSync(
      `node ${join(REPO_ROOT, "packages/cli/dist/index.js")} sync --dry-run`,
      {
        cwd: projectDir,
        stdio: "pipe",
      },
    ).toString();

    // Verify dry-run mode message
    expect(output).toContain("Preview complete");
    expect(output).toContain("Dry-run mode: no files written");
    expect(output).toContain("Audit trail:");

    // Verify files NOT created
    const cursorExists = await fs
      .access(join(projectDir, ".cursor/rules/aligntrue.mdc"))
      .then(() => true)
      .catch(() => false);

    expect(cursorExists).toBe(false);
  });

  it.skip("Edit AGENTS.md → sync workflow updates IR and other agents", async () => {
    // Setup
    const projectDir = join(testProjectContext.projectDir, "agents-edit");
    await fs.cp(GOLDEN_REPO_SOURCE, projectDir, { recursive: true });

    // Copy hidden directories
    const hiddenDirs = [".aligntrue", ".cursor", ".vscode"];
    for (const dir of hiddenDirs) {
      const srcDir = join(GOLDEN_REPO_SOURCE, dir);
      const dstDir = join(projectDir, dir);
      try {
        await fs.cp(srcDir, dstDir, { recursive: true });
      } catch {
        // Directory might not exist, continue
      }
    }

    // Update config to use agents as primary agent
    const configPath = join(projectDir, ".aligntrue/config.yaml");
    const configContent = await fs.readFile(configPath, "utf8");
    const updatedConfig = configContent.replace(
      "primary_agent: cursor",
      "primary_agent: agents",
    );
    await fs.writeFile(configPath, updatedConfig);

    // Initial sync
    execSync(`node ${join(REPO_ROOT, "packages/cli/dist/index.js")} sync`, {
      cwd: projectDir,
      stdio: "pipe",
    });

    // Edit AGENTS.md (primary user-editable file)
    const agentsMdPath = join(projectDir, "AGENTS.md");
    const agentsMdContent = await fs.readFile(agentsMdPath, "utf8");
    const modifiedAgentsMd = agentsMdContent.replace(
      "Every new feature must include unit tests",
      "Every new feature must include comprehensive unit tests with 80%+ coverage",
    );
    await fs.writeFile(agentsMdPath, modifiedAgentsMd);

    // Sync - should pull from AGENTS.md and update IR + other agents
    execSync(
      `node ${join(REPO_ROOT, "packages/cli/dist/index.js")} sync --force`,
      {
        cwd: projectDir,
        stdio: "pipe",
      },
    );

    // Verify edit was preserved in AGENTS.md
    const finalAgentsMd = await fs.readFile(agentsMdPath, "utf8");
    expect(finalAgentsMd).toContain(
      "comprehensive unit tests with 80%+ coverage",
    );

    // Verify edit was synced to IR (check for the key phrase, accounting for YAML formatting)
    const rulesContent = await fs.readFile(
      join(projectDir, ".aligntrue/.rules.yaml"),
      "utf8",
    );
    // YAML may format this as multiline, so check for the key phrase
    expect(rulesContent.replace(/\s+/g, " ")).toContain(
      "comprehensive unit tests with 80%+ coverage",
    );

    // Verify edit was synced to Cursor
    const cursorContent = await fs.readFile(
      join(projectDir, ".cursor/rules/aligntrue.mdc"),
      "utf8",
    );
    expect(cursorContent).toContain(
      "comprehensive unit tests with 80%+ coverage",
    );
  });
});
