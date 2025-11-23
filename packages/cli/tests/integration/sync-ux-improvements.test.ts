import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync } from "fs";
import { join } from "path";
import { sync } from "../../src/commands/sync/index.js";
import * as clack from "@clack/prompts";
import * as yaml from "yaml";
import { setupTestProject, TestProjectContext } from "../helpers/test-setup.js";
import * as lastSyncTracker from "@aligntrue/core/sync/last-sync-tracker";

vi.mock("@clack/prompts");

let TEST_DIR: string;
let testProjectContext: TestProjectContext;

// Skip on Windows due to file locking issues
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

beforeEach(async () => {
  vi.clearAllMocks();

  // Create fresh test directory
  testProjectContext = await setupTestProject();
  TEST_DIR = testProjectContext.projectDir;

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
  // Cleanup
  await testProjectContext.cleanup();
});

describeSkipWindows("Sync UX Improvements", () => {
  it("skips sync when nothing has changed since last sync", async () => {
    // 1. Setup valid project state
    const config = { exporters: ["agents"] };
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      yaml.stringify(config),
    );

    const ir = `id: test
version: 1.0.0
spec_version: "1"
sections:
  - heading: Rule 1
    content: Content 1
    level: 2
    fingerprint: rule-1
`;
    writeFileSync(join(TEST_DIR, ".aligntrue", ".rules.yaml"), ir);

    // Ensure timestamp is strictly newer than file creation
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Create .last-sync file with current timestamp
    lastSyncTracker.updateLastSyncTimestamp(TEST_DIR);

    // 2. Run sync
    await sync([]);

    // 3. Verify early exit message
    expect(clack.log.success).toHaveBeenCalledWith(
      "Everything already in sync",
    );
    expect(clack.outro).toHaveBeenCalledWith("✓ No changes detected");
  });

  it("runs full sync when .last-sync is missing (first run)", async () => {
    // 1. Setup valid project state
    const config = { exporters: ["agents"] };
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      yaml.stringify(config),
    );
    const ir = `id: test
version: 1.0.0
spec_version: "1"
sections: []
`;
    writeFileSync(join(TEST_DIR, ".aligntrue", ".rules.yaml"), ir);

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
    const ir = `id: test\nversion: 1.0.0\nspec_version: "1"\nsections: []`;
    writeFileSync(join(TEST_DIR, ".aligntrue", ".rules.yaml"), ir);

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
    const ir = `id: test\nversion: 1.0.0\nspec_version: "1"\nsections: []`;
    writeFileSync(join(TEST_DIR, ".aligntrue", ".rules.yaml"), ir);
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
    const ir = `id: test\nversion: 1.0.0\nspec_version: "1"\nsections: []`;
    writeFileSync(join(TEST_DIR, ".aligntrue", ".rules.yaml"), ir);

    // 2. Update last sync timestamp AFTER creating files
    await new Promise((resolve) => setTimeout(resolve, 100));
    lastSyncTracker.updateLastSyncTimestamp(TEST_DIR);

    // 3. Add Cursor .mdc files with OLD mtimes (simulating copied files)
    // This mimics the user's scenario where they copy files with preserved timestamps
    const { mkdirSync, utimesSync } = await import("fs");
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
});
