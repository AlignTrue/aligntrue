/**
 * Verify safety backups include agent files and restore reverts AGENTS edits.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
} from "fs";
import { join } from "path";
import * as clack from "@clack/prompts";
import * as yaml from "yaml";
import { BackupManager } from "@aligntrue/core";
import { sync } from "../../src/commands/sync/index.js";
import { setupTestProject, TestProjectContext } from "../helpers/test-setup.js";

vi.mock("@clack/prompts");

const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

let TEST_DIR: string;
let testProjectContext: TestProjectContext;
let originalCwd: string;

function listBackups(dir: string): string[] {
  return readdirSync(join(dir, ".aligntrue", ".backups"))
    .filter((name) => name !== "files")
    .sort()
    .reverse();
}

describeSkipWindows("Backup includes agent files", () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    testProjectContext = await setupTestProject();
    TEST_DIR = testProjectContext.projectDir;
    originalCwd = process.cwd();
    process.chdir(TEST_DIR);

    vi.spyOn(process, "exit").mockImplementation(((
      code?: Parameters<typeof process.exit>[0],
    ) => {
      throw new Error(`process.exit(${code})`);
    }) as never);

    const mockSpinner = { start: vi.fn(), stop: vi.fn() };
    vi.mocked(clack.spinner).mockReturnValue(mockSpinner as never);
    vi.mocked(clack.intro).mockImplementation(() => {});
    vi.mocked(clack.outro).mockImplementation(() => {});
    vi.mocked(clack.confirm).mockResolvedValue(true);
    vi.mocked(clack.cancel).mockImplementation(() => {});
    vi.mocked(clack.isCancel).mockReturnValue(false);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await testProjectContext.cleanup();
  });

  it("captures AGENTS.md in safety backup and restores prior content", async () => {
    const config = {
      sources: [{ type: "local", path: ".aligntrue/rules" }],
      exporters: ["cursor", "agents"],
      mode: "solo",
    };
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      yaml.stringify(config),
      "utf-8",
    );

    const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(
      join(rulesDir, "test-rule.md"),
      `---
title: Test rule
---
# Test rule
`,
      "utf-8",
    );

    // Initial sync (creates first safety backup)
    try {
      await sync([]);
    } catch {
      /* process.exit mocked */
    }
    const originalAgents = readFileSync(join(TEST_DIR, "AGENTS.md"), "utf-8");

    // Create a manual backup after the first sync that includes agent files
    const manualBackup = BackupManager.createBackup({
      cwd: TEST_DIR,
      created_by: "test",
      notes: "post-sync clean state",
      includeAgentFiles: true,
      agentFilePatterns: ["AGENTS.md"],
    });
    const cleanAgents = readFileSync(join(TEST_DIR, "AGENTS.md"), "utf-8");

    // Edit AGENTS and sync again to create another backup
    writeFileSync(join(TEST_DIR, "AGENTS.md"), `${originalAgents}\nMARKER\n`);
    try {
      await sync([]);
    } catch {
      /* process.exit mocked */
    }

    const backups = listBackups(TEST_DIR);
    expect(backups.length).toBeGreaterThanOrEqual(2);
    const latest = backups[0]!;

    const manifest = JSON.parse(
      readFileSync(
        join(TEST_DIR, ".aligntrue", ".backups", latest, "manifest.json"),
        "utf-8",
      ),
    );
    expect(manifest.agent_files).toContain("AGENTS.md");
    const backupAgentsPath = join(
      TEST_DIR,
      ".aligntrue",
      ".backups",
      latest,
      "agent-files",
      "AGENTS.md",
    );
    expect(existsSync(backupAgentsPath)).toBe(true);

    // Restore from pre-edit backup and verify marker removed
    BackupManager.restoreBackup({
      cwd: TEST_DIR,
      timestamp: manualBackup.timestamp,
    });
    const restored = readFileSync(join(TEST_DIR, "AGENTS.md"), "utf-8");
    expect(restored).toBe(cleanAgents);
    expect(restored).not.toContain("MARKER");
  });
});
