import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, mkdirSync, readFileSync, chmodSync, rmSync } from "fs";
import { join } from "path";
import { sync } from "../../src/commands/sync/index.js";
import * as clack from "@clack/prompts";
import * as yaml from "yaml";
import { setupTestProject, TestProjectContext } from "../helpers/test-setup.js";
import * as lastSyncTracker from "@aligntrue/core/sync/tracking";
import { computeHash } from "@aligntrue/schema";
import { AlignTrueError } from "../../src/utils/error-types.js";
import { BackupManager } from "@aligntrue/core";

vi.mock("@clack/prompts");

let TEST_DIR: string;
let testProjectContext: TestProjectContext;
let originalCwd: string;

// Skip on Windows due to file locking issues
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

beforeEach(async () => {
  vi.clearAllMocks();

  // Create fresh test directory
  testProjectContext = await setupTestProject();
  TEST_DIR = testProjectContext.projectDir;
  originalCwd = process.cwd();

  // Change to test directory
  process.chdir(TEST_DIR);

  // Mock clack prompts
  const mockSpinner = {
    start: vi.fn(),
    stop: vi.fn(),
  };
  vi.mocked(clack.spinner).mockReturnValue(mockSpinner as never);
  vi.mocked(clack.intro).mockImplementation(() => {});
  vi.mocked(clack.outro).mockImplementation(() => {});
  vi.mocked(clack.log.success).mockImplementation(() => {});
  vi.mocked(clack.log.info).mockImplementation(() => {});
  vi.mocked(clack.log.warn).mockImplementation(() => {});
  vi.mocked(clack.log.error).mockImplementation(() => {});
});

afterEach(async () => {
  process.chdir(originalCwd);
  // Cleanup
  await testProjectContext.cleanup();
});

describeSkipWindows("Sync UX Improvements", () => {
  it("skips sync when nothing has changed since last sync", async () => {
    // 1. Setup valid project state - use skipFiles to start fresh
    const testCtx = await setupTestProject({ skipFiles: true });
    const priorCwd = process.cwd();
    process.chdir(testCtx.projectDir);

    const config = { exporters: ["agents"] };
    writeFileSync(
      join(testCtx.projectDir, ".aligntrue", "config.yaml"),
      yaml.stringify(config),
    );

    // Managed .gitignore present (simulates prior sync state)
    writeFileSync(
      join(testCtx.projectDir, ".gitignore"),
      [
        "# START AlignTrue Generated Files",
        ".cursor/",
        "AGENTS.md",
        ".vscode/",
        "# END AlignTrue Generated Files",
        "",
      ].join("\n"),
      "utf-8",
    );

    // Create rules directory with markdown file
    const rulesDir = join(testCtx.projectDir, ".aligntrue", "rules");
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, "rule-1.md"), "## Rule 1\n\nContent 1\n");

    // Baseline export file to simulate previous successful sync
    const agentsPath = join(testCtx.projectDir, "AGENTS.md");
    writeFileSync(agentsPath, "# Agents export\n");

    // Ensure timestamp is strictly newer than file creation
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Store source rule hashes to simulate a previous successful sync
    // Must compute hash for all rule files in the directory
    const ruleFiles = [join(rulesDir, "rule-1.md")];
    const ruleHashes: Record<string, string> = {};
    for (const file of ruleFiles) {
      const content = readFileSync(file, "utf-8");
      const relPath = file.replace(testCtx.projectDir + "/", "");
      ruleHashes[relPath] = computeHash(content);
    }

    const configContent = readFileSync(
      join(testCtx.projectDir, ".aligntrue", "config.yaml"),
      "utf-8",
    );
    lastSyncTracker.storeSourceRuleHashes(
      testCtx.projectDir,
      ruleHashes,
      computeHash(configContent),
    );
    lastSyncTracker.storeExportFileHashes(testCtx.projectDir, {
      "AGENTS.md": computeHash(readFileSync(agentsPath, "utf-8")),
    });

    // Update last sync timestamp
    lastSyncTracker.updateLastSyncTimestamp(testCtx.projectDir);

    // 2. Run sync
    await sync([]);

    // 3. Verify early exit message
    expect(clack.log.success).toHaveBeenCalledWith(
      "Everything already in sync",
    );
    expect(clack.outro).toHaveBeenCalledWith("✓ No changes detected");

    // Cleanup
    process.chdir(priorCwd);
    await testCtx.cleanup();
  });

  it("runs full sync when .last-sync is missing (first run)", async () => {
    // 1. Setup valid project state
    const config = { exporters: ["agents"] };
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      yaml.stringify(config),
    );
    // Create empty rules directory
    const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
    mkdirSync(rulesDir, { recursive: true });

    // Ensure no .last-sync file
    // (Fresh test dir doesn't have it)

    // 2. Run sync
    await sync([]);

    // 3. Verify full sync ran (not early exit)
    expect(clack.log.success).not.toHaveBeenCalledWith(
      "Everything already in sync",
    );
    // Should show normal completion message OR "Everything up to date" if nothing written
    try {
      expect(clack.outro).toHaveBeenCalledWith(
        expect.stringContaining("✓ Sync complete"),
      );
    } catch {
      expect(clack.outro).toHaveBeenCalledWith(
        "✓ Everything up to date - no changes needed",
      );
    }
  });

  it("runs full sync when config file changed", async () => {
    // 1. Setup state
    const config = { exporters: ["agents"] };
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      yaml.stringify(config),
    );
    // Create empty rules directory
    mkdirSync(join(TEST_DIR, ".aligntrue", "rules"), { recursive: true });

    // Set last sync to past
    lastSyncTracker.updateLastSyncTimestamp(TEST_DIR);
    const oldTime = Date.now() - 10000;
    // Manually rewrite timestamp file to be old
    writeFileSync(
      join(TEST_DIR, ".aligntrue", ".last-sync"),
      oldTime.toString(),
    );

    // 2. Modify config (mtime > last sync)
    await new Promise((resolve) => setTimeout(resolve, 100)); // Ensure mtime diff
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      yaml.stringify({ ...config, exporters: ["cursor"] }),
    );

    // 3. Run sync
    await sync([]);

    // 4. Verify full sync ran
    expect(clack.log.success).not.toHaveBeenCalledWith(
      "Everything already in sync",
    );
  });

  it("runs full sync when forced with --force", async () => {
    // 1. Setup state where sync would normally be skipped
    const config = { exporters: ["agents"] };
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      yaml.stringify(config),
    );
    // Create empty rules directory
    mkdirSync(join(TEST_DIR, ".aligntrue", "rules"), { recursive: true });
    lastSyncTracker.updateLastSyncTimestamp(TEST_DIR);

    // 2. Run sync with --force
    await sync(["--force"]);

    // 3. Verify full sync ran
    expect(clack.log.success).not.toHaveBeenCalledWith(
      "Everything already in sync",
    );
  });

  it("runs full sync when new agent files detected (even with old mtimes)", async () => {
    // 1. Setup initial state with just agents exporter
    const config = { exporters: ["agents"] };
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      yaml.stringify(config),
    );
    // Create empty rules directory
    mkdirSync(join(TEST_DIR, ".aligntrue", "rules"), { recursive: true });

    // 2. Update last sync timestamp AFTER creating files
    await new Promise((resolve) => setTimeout(resolve, 100));
    lastSyncTracker.updateLastSyncTimestamp(TEST_DIR);

    // 3. Add Cursor .mdc files with OLD mtimes (simulating copied files)
    // This mimics the user's scenario where they copy files with preserved timestamps
    const { utimesSync } = await import("fs");
    mkdirSync(join(TEST_DIR, ".cursor", "rules"), { recursive: true });
    const cursorFile = join(TEST_DIR, ".cursor", "rules", "test.mdc");
    writeFileSync(cursorFile, "# Test rule\n\nTest content\n");

    // Set mtime to be OLDER than last sync (simulating copied file)
    const oldTime = new Date(Date.now() - 100000); // 100 seconds ago
    utimesSync(cursorFile, oldTime, oldTime);

    // 4. Run sync - should detect new agent (cursor) even though mtime is old
    await sync([]);

    // 5. Verify full sync ran (not early exit)
    expect(clack.log.success).not.toHaveBeenCalledWith(
      "Everything already in sync",
    );
  });

  it("surfaces a single permission error with path when project root is read-only", async () => {
    const projectDir = testProjectContext.projectDir;

    try {
      chmodSync(projectDir, 0o555); // remove write permission at root
      await expect(sync([])).rejects.toBeInstanceOf(AlignTrueError);
    } finally {
      chmodSync(projectDir, 0o755); // restore for cleanup
    }
  });

  it("shows concise missing-config error and hint", async () => {
    const bareProject = setupTestProject({ skipFiles: true });
    const priorCwd = process.cwd();
    process.chdir(bareProject.projectDir);

    await expect(sync([])).rejects.toMatchObject({
      message: expect.stringContaining("Configuration file not found"),
      hint: expect.stringContaining("aligntrue init"),
    });

    process.chdir(priorCwd);
    await bareProject.cleanup();
  });

  it("includes backup restore hint when config is missing but backups exist", async () => {
    const project = await setupTestProject({ skipFiles: true });
    const priorCwd = process.cwd();
    process.chdir(project.projectDir);

    // Create minimal config + rules to allow a backup, then delete config
    const configPath = join(project.projectDir, ".aligntrue", "config.yaml");
    mkdirSync(join(project.projectDir, ".aligntrue", "rules"), {
      recursive: true,
    });
    writeFileSync(
      configPath,
      yaml.stringify({ mode: "solo", exporters: ["agents"] }),
    );
    BackupManager.createBackup({ cwd: project.projectDir, notes: "baseline" });
    rmSync(configPath);

    await expect(sync([])).rejects.toMatchObject({
      message: expect.stringContaining("Configuration file not found"),
      hint: expect.stringContaining("backup restore"),
    });

    process.chdir(priorCwd);
    await project.cleanup();
  });

  it("recreates managed .gitignore block when removed", async () => {
    const project = setupTestProject();
    const priorCwd = process.cwd();
    process.chdir(project.projectDir);

    await sync([]);

    const gitignorePath = join(project.projectDir, ".gitignore");
    writeFileSync(gitignorePath, "");

    await sync([]);

    const gitignoreContent = readFileSync(gitignorePath, "utf-8");
    expect(gitignoreContent).toContain("# START AlignTrue Generated Files");
    expect(gitignoreContent).toContain(".aligntrue/.backups/");
    expect(gitignoreContent).toContain("AGENTS.md");

    process.chdir(priorCwd);
    await project.cleanup();
  });

  it("warns when rules are removed since last sync", async () => {
    const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
    mkdirSync(rulesDir, { recursive: true });

    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      yaml.stringify({ exporters: ["agents"] }),
    );

    writeFileSync(join(rulesDir, "keep.md"), "# Keep\n");
    writeFileSync(join(rulesDir, "remove.md"), "# Remove me\n");

    // First sync to record hashes
    await sync([]);
    vi.mocked(clack.log.warn).mockClear();

    // Delete one rule and sync again
    rmSync(join(rulesDir, "remove.md"));
    await sync([]);

    const warnings = vi.mocked(clack.log.warn).mock.calls.flat();
    expect(
      warnings.some(
        (msg) =>
          typeof msg === "string" &&
          msg.includes("Rules removed since last sync") &&
          msg.includes("remove.md"),
      ),
    ).toBe(true);
  });
});
