import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkIfSyncNeeded } from "../../src/commands/sync/sync-checker.js";
import * as lastSyncTracker from "@aligntrue/core/sync/last-sync-tracker";
import * as core from "@aligntrue/core";
import * as detectAgents from "../../src/utils/detect-agents.js";
import { existsSync } from "fs";
import { globSync } from "glob";

// Mock dependencies
vi.mock("@aligntrue/core/sync/last-sync-tracker");
vi.mock("@aligntrue/core");
vi.mock("../../src/utils/detect-agents.js");
vi.mock("fs");
vi.mock("glob");

describe("Sync Checker", () => {
  const mockCwd = "/test/cwd";
  const mockConfigPath = "/test/cwd/.aligntrue/config.yaml";
  const mockPaths = {
    config: mockConfigPath,
    rules: "/test/cwd/.aligntrue/.rules.yaml",
    agentsMd: () => "/test/cwd/AGENTS.md",
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(process, "cwd").mockReturnValue(mockCwd);
    vi.mocked(core.getAlignTruePaths).mockReturnValue(mockPaths as any);
    vi.mocked(core.loadConfig).mockResolvedValue({});
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(globSync).mockReturnValue([]);
    vi.mocked(detectAgents.detectNewAgents).mockReturnValue([]);
  });

  it("should require sync if no last sync timestamp exists (first run)", async () => {
    vi.mocked(lastSyncTracker.getLastSyncTimestamp).mockReturnValue(null);

    const result = await checkIfSyncNeeded({});
    expect(result).toBe(true);
  });

  it("should require sync if config file changed", async () => {
    vi.mocked(lastSyncTracker.getLastSyncTimestamp).mockReturnValue(1000);
    vi.mocked(lastSyncTracker.wasFileModifiedSince).mockImplementation(
      (path) => path === mockConfigPath,
    );

    const result = await checkIfSyncNeeded({});
    expect(result).toBe(true);
    expect(lastSyncTracker.wasFileModifiedSince).toHaveBeenCalledWith(
      mockConfigPath,
      1000,
    );
  });

  it("should require sync if IR changed", async () => {
    vi.mocked(lastSyncTracker.getLastSyncTimestamp).mockReturnValue(1000);
    vi.mocked(lastSyncTracker.wasFileModifiedSince).mockImplementation(
      (path) => path === mockPaths.rules,
    );

    const result = await checkIfSyncNeeded({});
    expect(result).toBe(true);
  });

  it("should require sync if AGENTS.md changed", async () => {
    vi.mocked(lastSyncTracker.getLastSyncTimestamp).mockReturnValue(1000);
    vi.mocked(lastSyncTracker.wasFileModifiedSince).mockImplementation(
      (path) => path === mockPaths.agentsMd(),
    );

    const result = await checkIfSyncNeeded({});
    expect(result).toBe(true);
  });

  it("should require sync if Cursor rules changed", async () => {
    vi.mocked(lastSyncTracker.getLastSyncTimestamp).mockReturnValue(1000);
    vi.mocked(globSync).mockReturnValue(["/test/cwd/.cursor/rules/test.mdc"]);
    vi.mocked(lastSyncTracker.wasFileModifiedSince).mockImplementation(
      (path) => path === "/test/cwd/.cursor/rules/test.mdc",
    );

    const result = await checkIfSyncNeeded({});
    expect(result).toBe(true);
  });

  it("should not require sync if nothing changed", async () => {
    vi.mocked(lastSyncTracker.getLastSyncTimestamp).mockReturnValue(1000);
    vi.mocked(lastSyncTracker.wasFileModifiedSince).mockReturnValue(false);

    const result = await checkIfSyncNeeded({});
    expect(result).toBe(false);
  });

  it("should require sync if configured local source changed", async () => {
    vi.mocked(core.loadConfig).mockResolvedValue({
      sources: [{ type: "local", path: "custom-rules.yaml" }],
    });
    vi.mocked(lastSyncTracker.getLastSyncTimestamp).mockReturnValue(1000);
    vi.mocked(lastSyncTracker.wasFileModifiedSince).mockImplementation((path) =>
      path.includes("custom-rules.yaml"),
    );

    const result = await checkIfSyncNeeded({});
    expect(result).toBe(true);
  });

  it("should require sync if new agent files detected", async () => {
    vi.mocked(lastSyncTracker.getLastSyncTimestamp).mockReturnValue(1000);
    vi.mocked(lastSyncTracker.wasFileModifiedSince).mockReturnValue(false);
    vi.mocked(core.loadConfig).mockResolvedValue({
      exporters: ["agents"],
    });

    // Mock detectNewAgents to return cursor as a new agent
    vi.mocked(detectAgents.detectNewAgents).mockReturnValue([
      { name: "cursor", reason: "Cursor files detected" },
    ]);

    const result = await checkIfSyncNeeded({});
    expect(result).toBe(true);
  });
});
