/**
 * Tests for sync command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync } from "fs";
import * as clack from "@clack/prompts";

// Mock dependencies
vi.mock("fs");
vi.mock("@clack/prompts");
vi.mock("@aligntrue/core/telemetry/collector.js", () => ({
  recordEvent: vi.fn(),
}));
vi.mock("@aligntrue/schema", () => ({
  canonicalizeJson: vi.fn((obj) => {
    if (obj === undefined) return "{}";
    return JSON.stringify(obj);
  }),
  validateAlign: vi.fn(),
  validateRuleId: vi.fn(() => ({ valid: true })),
}));
vi.mock("@aligntrue/core", () => {
  const mockEngine = {
    registerExporter: vi.fn(),
    syncToAgents: vi.fn(),
    syncFromAgent: vi.fn(),
  };
  const mockBackupManager = {
    createBackup: vi.fn(),
    listBackups: vi.fn(),
    restoreBackup: vi.fn(),
    cleanupOldBackups: vi.fn(),
    getBackup: vi.fn(),
    deleteBackup: vi.fn(),
  };
  return {
    loadConfig: vi.fn(),
    loadIR: vi.fn(() => ({ rules: [] })),
    SyncEngine: vi.fn(function (this: any) {
      return mockEngine;
    }),
    BackupManager: mockBackupManager,
    getAlignTruePaths: vi.fn((cwd = process.cwd()) => ({
      config: `${cwd}/.aligntrue/config.yaml`,
      rules: `${cwd}/.aligntrue/rules.md`,
      lockfile: `${cwd}/.aligntrue.lock.json`,
      bundle: `${cwd}/.aligntrue.bundle.yaml`,
      cursorRules: (scope: string) => `${cwd}/.cursor/rules/${scope}.mdc`,
      agentsMd: () => `${cwd}/AGENTS.md`,
      vscodeMcp: () => `${cwd}/.vscode/mcp.json`,
      cache: (type: string) => `${cwd}/.aligntrue/.cache/${type}`,
      privacyConsent: () => `${cwd}/.aligntrue/privacy-consent.json`,
      telemetryEvents: () => `${cwd}/.aligntrue/telemetry-events.json`,
      aligntrueDir: `${cwd}/.aligntrue`,
      exporterOutput: (exporterName: string, filename: string) =>
        `${cwd}/${filename}`,
    })),
    __mockEngine: mockEngine, // Export for test access
    __mockBackupManager: mockBackupManager, // Export for test access
  };
});
vi.mock("@aligntrue/exporters", () => {
  const mockRegistry = {
    discoverAdapters: vi.fn(() => [
      "/path/to/cursor/manifest.json",
      "/path/to/agents-md/manifest.json",
    ]),
    loadManifest: vi.fn((path: string) => {
      if (path.includes("cursor")) {
        return {
          name: "cursor",
          version: "1.0.0",
          description: "Cursor exporter",
          handler: "./index.js",
        };
      }
      return {
        name: "agents-md",
        version: "1.0.0",
        description: "AGENTS.md exporter",
        handler: "./index.js",
      };
    }),
    registerFromManifest: vi.fn(),
    get: vi.fn((name: string) => ({ name, version: "1.0.0", export: vi.fn() })),
  };
  return {
    ExporterRegistry: vi.fn(function (this: any) {
      return mockRegistry;
    }),
    __mockRegistry: mockRegistry, // Export for test access
  };
});

import { sync } from "../../src/commands/sync.js";
import { loadConfig } from "@aligntrue/core";

describe("sync command", () => {
  let mockExistsSync: any;
  let mockLoadConfig: any;
  let mockSyncEngine: any;
  let mockRegistry: any;
  let consoleLogSpy: any;
  let processExitSpy: any;

  beforeEach(async () => {
    mockExistsSync = vi.mocked(existsSync);
    mockLoadConfig = vi.mocked(loadConfig);

    // Get the mocked instances from the module
    const coreModule = (await import("@aligntrue/core")) as any;
    const exportersModule = (await import("@aligntrue/exporters")) as any;
    mockSyncEngine = coreModule.__mockEngine;
    mockRegistry = exportersModule.__mockRegistry;

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number,
    ) => {
      throw new Error(`process.exit(${code})`);
    }) as any);

    // Mock clack functions
    vi.mocked(clack.intro).mockImplementation(() => {});
    vi.mocked(clack.outro).mockImplementation(() => {});
    vi.mocked(clack.spinner).mockReturnValue({
      start: vi.fn(),
      stop: vi.fn(),
    } as any);
    vi.mocked(clack.log).success = vi.fn();
    vi.mocked(clack.log).info = vi.fn();
    vi.mocked(clack.log).warn = vi.fn();
    vi.mocked(clack.log).error = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Reset mock functions to default implementations
    if (mockRegistry) {
      vi.mocked(mockRegistry.discoverAdapters).mockReturnValue([
        "/path/to/cursor/manifest.json",
        "/path/to/agents-md/manifest.json",
      ]);
      vi.mocked(mockRegistry.loadManifest).mockImplementation(
        (path: string) => {
          if (path.includes("cursor")) {
            return {
              name: "cursor",
              version: "1.0.0",
              description: "Cursor exporter",
              handler: "./index.js",
            };
          }
          return {
            name: "agents-md",
            version: "1.0.0",
            description: "AGENTS.md exporter",
            handler: "./index.js",
          };
        },
      );
      vi.mocked(mockRegistry.registerFromManifest).mockResolvedValue(undefined);
      vi.mocked(mockRegistry.get).mockImplementation((name: string) => ({
        name,
        version: "1.0.0",
        export: vi.fn(),
      }));
    }
  });

  describe("--help flag", () => {
    it("shows help text and exits", async () => {
      await expect(sync(["--help"])).rejects.toThrow("process.exit(0)");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Usage: aligntrue sync"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Sync rules from IR"),
      );
    });
  });

  describe("config validation", () => {
    it("fails if config file not found", async () => {
      mockExistsSync.mockReturnValue(false);

      await expect(sync([])).rejects.toThrow("process.exit(2)");
      expect(clack.log.error).toHaveBeenCalledWith("Config file not found");
    });

    it("fails if config loading fails", async () => {
      mockExistsSync.mockReturnValue(true);
      mockLoadConfig.mockRejectedValue(new Error("Invalid YAML"));

      await expect(sync([])).rejects.toThrow("process.exit(2)");
      expect(clack.log.error).toHaveBeenCalledWith(
        "Failed to load configuration",
      );
    });
  });

  describe("source validation", () => {
    it("fails if source file not found", async () => {
      mockExistsSync
        .mockReturnValueOnce(true) // config exists
        .mockReturnValueOnce(false); // source doesn't exist

      mockLoadConfig.mockResolvedValue({
        mode: "solo",
        sources: [{ type: "local", path: ".aligntrue/rules.md" }],
        exporters: ["cursor"],
      });

      await expect(sync([])).rejects.toThrow("process.exit(2)");
      expect(clack.log.error).toHaveBeenCalledWith("Rules file not found");
    });
  });

  describe("successful sync", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockLoadConfig.mockResolvedValue({
        mode: "solo",
        sources: [{ type: "local", path: ".aligntrue/rules.md" }],
        exporters: ["cursor", "agents-md"],
      });
      mockSyncEngine.syncToAgents.mockResolvedValue({
        success: true,
        written: [".cursor/rules/aligntrue.mdc", "AGENTS.md"],
        warnings: [],
        conflicts: [],
      });
    });

    it("loads config and syncs to agents", async () => {
      await sync([]);

      expect(mockLoadConfig).toHaveBeenCalled();
      expect(mockSyncEngine.registerExporter).toHaveBeenCalledTimes(2);
      expect(mockSyncEngine.syncToAgents).toHaveBeenCalled();
      expect(clack.log.success).toHaveBeenCalledWith(
        expect.stringContaining("Wrote 2 file"),
      );
    });

    it("shows files written", async () => {
      await sync([]);

      expect(clack.log.info).toHaveBeenCalledWith(
        expect.stringContaining(".cursor/rules/aligntrue.mdc"),
      );
      expect(clack.log.info).toHaveBeenCalledWith(
        expect.stringContaining("AGENTS.md"),
      );
    });

    it("shows warnings if present", async () => {
      mockSyncEngine.syncToAgents.mockResolvedValue({
        success: true,
        written: [],
        warnings: ["Unmapped field: check"],
      });

      await sync([]);

      expect(clack.log.warn).toHaveBeenCalledWith("Unmapped field: check");
    });

    it("shows conflicts if present", async () => {
      mockSyncEngine.syncToAgents.mockResolvedValue({
        success: true,
        written: [],
        conflicts: [
          {
            ruleId: "test.rule",
            conflicts: [
              { field: "severity", irValue: "error", agentValue: "warn" },
            ],
          },
        ],
      });

      await sync([]);

      expect(clack.log.warn).toHaveBeenCalledWith(
        expect.stringContaining("1 conflict detected"),
      );
    });
  });

  describe("--dry-run flag", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockLoadConfig.mockResolvedValue({
        mode: "solo",
        sources: [{ type: "local", path: ".aligntrue/rules.md" }],
        exporters: ["cursor"],
      });
    });

    it("previews changes without writing files", async () => {
      mockSyncEngine.syncToAgents.mockResolvedValue({
        success: true,
        written: [".cursor/rules/aligntrue.mdc"],
        auditTrail: [
          {
            action: "update",
            target: ".aligntrue/rules.md",
            source: "IR",
            timestamp: "2025-10-27T00:00:00Z",
            details: "Loaded 5 rules",
          },
        ],
      });

      await sync(["--dry-run"]);

      expect(mockSyncEngine.syncToAgents).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ dryRun: true }),
      );
      expect(clack.log.info).toHaveBeenCalledWith(
        "Dry-run mode: no files written",
      );
      expect(clack.log.success).toHaveBeenCalledWith(
        expect.stringContaining("Would write 1 file"),
      );
    });

    it("shows audit trail in dry-run mode", async () => {
      mockSyncEngine.syncToAgents.mockResolvedValue({
        success: true,
        written: [],
        auditTrail: [
          {
            action: "update",
            target: "test.md",
            source: "IR",
            timestamp: "2025-10-27T00:00:00Z",
            details: "Loaded",
          },
        ],
      });

      await sync(["--dry-run"]);

      expect(clack.log.info).toHaveBeenCalledWith(
        expect.stringContaining("Audit trail:"),
      );
    });
  });

  describe("--accept-agent flag", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockLoadConfig.mockResolvedValue({
        mode: "solo",
        sources: [{ type: "local", path: ".aligntrue/rules.md" }],
        exporters: ["cursor"],
      });
      mockSyncEngine.syncFromAgent.mockResolvedValue({
        success: true,
        written: [".aligntrue/rules.md"],
        warnings: [],
      });
    });

    it("syncs from agent to IR", async () => {
      await sync(["--accept-agent", "cursor"]);

      // Step 17 complete - real parsers implemented, no mock data warning needed
      expect(mockSyncEngine.syncFromAgent).toHaveBeenCalledWith(
        "cursor",
        expect.any(String),
        expect.objectContaining({ acceptAgent: "cursor" }),
      );
    });
  });

  describe("--force flag", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockLoadConfig.mockResolvedValue({
        mode: "solo",
        sources: [{ type: "local", path: ".aligntrue/rules.md" }],
        exporters: ["cursor"],
      });
      mockSyncEngine.syncToAgents.mockResolvedValue({
        success: true,
        written: [],
      });
    });

    it("enables non-interactive mode for CI", async () => {
      await sync(["--force"]);

      expect(mockSyncEngine.syncToAgents).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          force: true,
          interactive: false,
        }),
      );
    });
  });

  describe("--config flag", () => {
    it("uses custom config path", async () => {
      mockExistsSync.mockReturnValue(true);
      mockLoadConfig.mockResolvedValue({
        mode: "solo",
        sources: [{ type: "local", path: ".aligntrue/rules.md" }],
        exporters: ["cursor"],
      });
      mockSyncEngine.syncToAgents.mockResolvedValue({
        success: true,
        written: [],
      });

      await sync(["--config", "/custom/config.yaml"]);

      expect(mockLoadConfig).toHaveBeenCalledWith("/custom/config.yaml");
    });
  });

  describe("exporter loading", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockLoadConfig.mockResolvedValue({
        mode: "solo",
        sources: [{ type: "local", path: ".aligntrue/rules.md" }],
        exporters: ["cursor", "agents-md"],
      });
      mockSyncEngine.syncToAgents.mockResolvedValue({
        success: true,
        written: [],
      });
    });

    it("discovers and loads exporters from registry", async () => {
      await sync([]);

      expect(mockRegistry.discoverAdapters).toHaveBeenCalled();
      expect(mockRegistry.registerFromManifest).toHaveBeenCalledTimes(2);
      expect(mockSyncEngine.registerExporter).toHaveBeenCalledTimes(2);
    });

    it("warns if exporter not found", async () => {
      mockLoadConfig.mockResolvedValue({
        mode: "solo",
        sources: [{ type: "local", path: ".aligntrue/rules.md" }],
        exporters: ["nonexistent"],
      });
      mockRegistry.discoverAdapters.mockReturnValue([]);

      await sync([]);

      expect(clack.log.warn).toHaveBeenCalledWith(
        expect.stringContaining("Exporter not found: nonexistent"),
      );
    });

    it("handles exporter loading failure", async () => {
      // Need to set up config and source first
      mockExistsSync.mockReturnValue(true);
      mockLoadConfig.mockResolvedValue({
        mode: "solo",
        sources: [{ type: "local", path: ".aligntrue/rules.md" }],
        exporters: ["cursor"],
      });
      // Ensure discoverAdapters returns valid paths
      mockRegistry.discoverAdapters.mockReturnValue([
        "/path/to/cursor/manifest.json",
      ]);
      // Make loadManifest return valid manifest
      mockRegistry.loadManifest.mockReturnValue({
        name: "cursor",
        version: "1.0.0",
        description: "Cursor",
        handler: "./index.js",
      });
      // registerFromManifest throws error
      mockRegistry.registerFromManifest.mockRejectedValue(
        new Error("Failed to load handler"),
      );

      await expect(sync([])).rejects.toThrow("process.exit(1)");
      expect(clack.log.error).toHaveBeenCalledWith("Sync failed");
    });
  });

  describe("sync failures", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockLoadConfig.mockResolvedValue({
        mode: "solo",
        sources: [{ type: "local", path: ".aligntrue/rules.md" }],
        exporters: ["cursor"],
      });
    });

    it("handles sync engine errors", async () => {
      mockSyncEngine.syncToAgents.mockRejectedValue(
        new Error("Exporter failed"),
      );

      await expect(sync([])).rejects.toThrow("process.exit(1)");
      expect(clack.log.error).toHaveBeenCalledWith(
        expect.stringContaining("Sync error"),
      );
    });

    it("shows lockfile drift suggestions on lockfile errors", async () => {
      mockSyncEngine.syncToAgents.mockRejectedValue(
        new Error("lockfile validation failed"),
      );

      await expect(sync([])).rejects.toThrow("process.exit(1)");
      expect(clack.log.info).toHaveBeenCalledWith(
        expect.stringContaining("Lockfile drift"),
      );
    });

    it("handles unsuccessful sync result", async () => {
      mockSyncEngine.syncToAgents.mockResolvedValue({
        success: false,
        written: [],
        warnings: ["Lockfile validation failed in strict mode"],
      });

      await expect(sync([])).rejects.toThrow("process.exit(1)");
      expect(clack.log.error).toHaveBeenCalledWith("Sync failed");
    });
  });

  describe("team mode lockfile", () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockLoadConfig.mockResolvedValue({
        mode: "team",
        modules: { lockfile: true },
        lockfile: { mode: "soft" },
        sources: [{ type: "local", path: ".aligntrue/rules.md" }],
        exporters: ["cursor"],
      });
    });

    it("validates lockfile before sync in team mode", async () => {
      mockSyncEngine.syncToAgents.mockResolvedValue({
        success: true,
        written: [],
        auditTrail: [
          {
            action: "conflict",
            target: ".aligntrue.lock.json",
            source: "lockfile",
            timestamp: "2025-10-27T00:00:00Z",
            details: "Drift detected",
          },
        ],
      });

      await sync([]);

      // Lockfile validation happens inside syncToAgents, so we just verify it was called
      expect(mockSyncEngine.syncToAgents).toHaveBeenCalled();
    });
  });

  describe("provenance display", () => {
    it("displays provenance in dry-run mode when present", async () => {
      mockExistsSync.mockReturnValue(true);
      mockLoadConfig.mockReturnValue({
        version: "1",
        mode: "team",
        exporters: ["cursor", "agents-md"],
      });

      mockRegistry.list = vi.fn(() => ["cursor", "agents-md"]);

      mockSyncEngine.syncToAgents.mockResolvedValue({
        success: true,
        written: [".cursor/rules/aligntrue.mdc", "AGENTS.md"],
        warnings: [],
        auditTrail: [
          {
            action: "update",
            target: ".aligntrue/rules.md",
            source: "IR",
            timestamp: "2025-10-29T12:00:00.000Z",
            details: "Loaded 5 rules from IR",
            provenance: {
              owner: "aligntrue",
              source: "github.com/AlignTrue/aligns",
              source_sha: "abc123def456",
            },
          },
        ],
      });

      await sync(["--dry-run"]);

      expect(clack.log.info).toHaveBeenCalledWith("\nProvenance:");
      expect(clack.log.message).toHaveBeenCalledWith(
        expect.stringContaining("owner=aligntrue"),
      );
      expect(clack.log.message).toHaveBeenCalledWith(
        expect.stringContaining("source=github.com/AlignTrue/aligns"),
      );
      expect(clack.log.message).toHaveBeenCalledWith(
        expect.stringContaining("sha=abc123d"),
      );
    });

    it("skips provenance display when not present", async () => {
      mockExistsSync.mockReturnValue(true);
      mockLoadConfig.mockReturnValue({
        version: "1",
        mode: "solo",
        exporters: ["cursor"],
      });

      mockRegistry.list = vi.fn(() => ["cursor"]);

      mockSyncEngine.syncToAgents.mockResolvedValue({
        success: true,
        written: [".cursor/rules/aligntrue.mdc"],
        warnings: [],
        auditTrail: [
          {
            action: "update",
            target: ".aligntrue/rules.md",
            source: "IR",
            timestamp: "2025-10-29T12:00:00.000Z",
            details: "Loaded 3 rules from IR",
            // No provenance
          },
        ],
      });

      await sync(["--dry-run"]);

      // Provenance section should not be displayed
      const calls = vi.mocked(clack.log.info).mock.calls;
      const provenanceCalls = calls.filter((call) =>
        String(call[0]).includes("Provenance:"),
      );
      expect(provenanceCalls).toHaveLength(0);
    });
  });

  describe("auto-backup integration", () => {
    let mockBackupManager: any;

    beforeEach(async () => {
      // Get mocked backup manager from @aligntrue/core mock
      const coreModule = (await import("@aligntrue/core")) as any;
      mockBackupManager = coreModule.__mockBackupManager;

      // Reset all mock functions
      mockBackupManager.createBackup.mockReset();
      mockBackupManager.cleanupOldBackups.mockReset();
    });

    it("creates backup before sync when auto_backup enabled", async () => {
      mockExistsSync.mockReturnValue(true);
      mockLoadConfig.mockReturnValue({
        version: "1",
        mode: "solo",
        exporters: ["cursor"],
        backup: {
          auto_backup: true,
          backup_on: ["sync"],
          keep_count: 10,
        },
      });

      mockBackupManager.createBackup.mockReturnValue({
        timestamp: "2025-10-29T12-00-00-000",
        path: "/path/to/backup",
        manifest: {
          version: "1",
          timestamp: "2025-10-29T12:00:00.000Z",
          files: [".aligntrue/config.yaml", ".aligntrue/rules.md"],
          created_by: "sync",
          notes: "Auto-backup before sync",
        },
      });

      mockRegistry.list = vi.fn(() => ["cursor"]);
      mockSyncEngine.syncToAgents.mockResolvedValue({
        success: true,
        written: [".cursor/rules/aligntrue.mdc"],
        warnings: [],
      });

      await sync([]);

      expect(mockBackupManager.createBackup).toHaveBeenCalledWith({
        cwd: process.cwd(),
        created_by: "sync",
        notes: "Auto-backup before sync",
      });
      expect(clack.spinner().stop).toHaveBeenCalledWith(
        "Backup created: 2025-10-29T12-00-00-000",
      );
      expect(clack.log.info).toHaveBeenCalledWith(
        "Restore with: aligntrue backup restore --to 2025-10-29T12-00-00-000",
      );
    });

    it("skips backup in dry-run mode", async () => {
      mockExistsSync.mockReturnValue(true);
      mockLoadConfig.mockReturnValue({
        version: "1",
        mode: "solo",
        exporters: ["cursor"],
        backup: {
          auto_backup: true,
          backup_on: ["sync"],
        },
      });

      mockRegistry.list = vi.fn(() => ["cursor"]);
      mockSyncEngine.syncToAgents.mockResolvedValue({
        success: true,
        written: [],
        warnings: [],
      });

      await sync(["--dry-run"]);

      expect(mockBackupManager.createBackup).not.toHaveBeenCalled();
    });

    it("skips backup when auto_backup disabled", async () => {
      mockExistsSync.mockReturnValue(true);
      mockLoadConfig.mockReturnValue({
        version: "1",
        mode: "solo",
        exporters: ["cursor"],
        backup: {
          auto_backup: false,
        },
      });

      mockRegistry.list = vi.fn(() => ["cursor"]);
      mockSyncEngine.syncToAgents.mockResolvedValue({
        success: true,
        written: [".cursor/rules/aligntrue.mdc"],
        warnings: [],
      });

      await sync([]);

      expect(mockBackupManager.createBackup).not.toHaveBeenCalled();
    });

    it("skips backup when sync not in backup_on array", async () => {
      mockExistsSync.mockReturnValue(true);
      mockLoadConfig.mockReturnValue({
        version: "1",
        mode: "solo",
        exporters: ["cursor"],
        backup: {
          auto_backup: true,
          backup_on: ["import"], // Only import, not sync
        },
      });

      mockRegistry.list = vi.fn(() => ["cursor"]);
      mockSyncEngine.syncToAgents.mockResolvedValue({
        success: true,
        written: [".cursor/rules/aligntrue.mdc"],
        warnings: [],
      });

      await sync([]);

      expect(mockBackupManager.createBackup).not.toHaveBeenCalled();
    });

    it("continues sync even if backup fails", async () => {
      mockExistsSync.mockReturnValue(true);
      mockLoadConfig.mockReturnValue({
        version: "1",
        mode: "solo",
        exporters: ["cursor"],
        backup: {
          auto_backup: true,
          backup_on: ["sync"],
        },
      });

      mockBackupManager.createBackup.mockImplementation(() => {
        throw new Error("Backup failed");
      });

      mockRegistry.list = vi.fn(() => ["cursor"]);
      mockSyncEngine.syncToAgents.mockResolvedValue({
        success: true,
        written: [".cursor/rules/aligntrue.mdc"],
        warnings: [],
      });

      await sync([]);

      expect(mockBackupManager.createBackup).toHaveBeenCalled();
      expect(clack.log.warn).toHaveBeenCalledWith(
        "Failed to create backup: Backup failed",
      );
      expect(clack.log.warn).toHaveBeenCalledWith("Continuing with sync...");
      expect(mockSyncEngine.syncToAgents).toHaveBeenCalled();
    });

    it("cleans up old backups after successful sync", async () => {
      mockExistsSync.mockReturnValue(true);
      mockLoadConfig.mockReturnValue({
        version: "1",
        mode: "solo",
        exporters: ["cursor"],
        backup: {
          auto_backup: true,
          backup_on: ["sync"],
          keep_count: 5,
        },
      });

      mockBackupManager.createBackup.mockReturnValue({
        timestamp: "2025-10-29T12-00-00-000",
        path: "/path/to/backup",
        manifest: {
          version: "1",
          timestamp: "2025-10-29T12:00:00.000Z",
          files: [".aligntrue/config.yaml"],
          created_by: "sync",
          notes: "Auto-backup before sync",
        },
      });

      mockBackupManager.cleanupOldBackups.mockReturnValue(3);

      mockRegistry.list = vi.fn(() => ["cursor"]);
      mockSyncEngine.syncToAgents.mockResolvedValue({
        success: true,
        written: [".cursor/rules/aligntrue.mdc"],
        warnings: [],
      });

      await sync([]);

      expect(mockBackupManager.cleanupOldBackups).toHaveBeenCalledWith({
        cwd: process.cwd(),
        keepCount: 5,
      });
      expect(clack.log.info).toHaveBeenCalledWith("Cleaned up 3 old backups");
    });

    it("silently continues if cleanup fails", async () => {
      mockExistsSync.mockReturnValue(true);
      mockLoadConfig.mockReturnValue({
        version: "1",
        mode: "solo",
        exporters: ["cursor"],
        backup: {
          auto_backup: true,
          backup_on: ["sync"],
          keep_count: 5,
        },
      });

      mockBackupManager.createBackup.mockReturnValue({
        timestamp: "2025-10-29T12-00-00-000",
        path: "/path/to/backup",
        manifest: {
          version: "1",
          timestamp: "2025-10-29T12:00:00.000Z",
          files: [".aligntrue/config.yaml"],
          created_by: "sync",
          notes: "Auto-backup before sync",
        },
      });

      mockBackupManager.cleanupOldBackups.mockImplementation(() => {
        throw new Error("Cleanup failed");
      });

      mockRegistry.list = vi.fn(() => ["cursor"]);
      mockSyncEngine.syncToAgents.mockResolvedValue({
        success: true,
        written: [".cursor/rules/aligntrue.mdc"],
        warnings: [],
      });

      await sync([]);

      // Should not throw and should not log cleanup errors
      expect(mockSyncEngine.syncToAgents).toHaveBeenCalled();
    });
  });

  describe("allow list validation", () => {
    let mockParseAllowList: any;
    let mockIsSourceAllowed: any;

    beforeEach(async () => {
      // Mock the team/allow module
      vi.doMock("@aligntrue/core/team/allow.js", () => ({
        parseAllowList: vi.fn(),
        isSourceAllowed: vi.fn(),
      }));

      const allowModule = await import("@aligntrue/core/team/allow.js");
      mockParseAllowList = allowModule.parseAllowList as any;
      mockIsSourceAllowed = allowModule.isSourceAllowed as any;
    });

    it("skips validation in solo mode", async () => {
      mockExistsSync.mockReturnValue(true);
      mockLoadConfig.mockReturnValue({
        version: "1",
        mode: "solo", // Solo mode
        exporters: ["cursor"],
      });

      await sync([]);

      // Allow list functions should not be called in solo mode
      expect(mockParseAllowList).not.toHaveBeenCalled();
    });

    it("shows info message when allow list does not exist in team mode", async () => {
      mockExistsSync.mockImplementation((path: string) => {
        if (path.includes("allow.yaml")) return false; // No allow list
        return true; // Config and other files exist
      });
      mockLoadConfig.mockReturnValue({
        version: "1",
        mode: "team",
        exporters: ["cursor"],
      });

      mockRegistry.list = vi.fn(() => ["cursor"]);
      mockSyncEngine.syncToAgents.mockResolvedValue({
        success: true,
        written: [".cursor/rules/aligntrue.mdc"],
        warnings: [],
      });

      await sync([]);

      // Check if info was called with the "No allow list found" message
      const infoCalls = vi.mocked(clack.log.info).mock.calls;
      const hasAllowListMessage = infoCalls.some((call) =>
        String(call[0]).includes("No allow list found"),
      );
      expect(hasAllowListMessage).toBe(true);
    });

    it("allows sync when all sources approved", async () => {
      mockExistsSync.mockReturnValue(true);
      mockLoadConfig.mockReturnValue({
        version: "1",
        mode: "team",
        exporters: ["cursor"],
        sources: [{ path: ".aligntrue/rules.md" }], // Default path, no validation needed
      });

      mockParseAllowList.mockReturnValue({
        version: 1,
        sources: [],
      });

      mockRegistry.list = vi.fn(() => ["cursor"]);
      mockSyncEngine.syncToAgents.mockResolvedValue({
        success: true,
        written: [".cursor/rules/aligntrue.mdc"],
        warnings: [],
      });

      await sync([]);

      // Should complete successfully
      expect(mockSyncEngine.syncToAgents).toHaveBeenCalled();
    });

    it("bypasses validation with --force flag", async () => {
      mockExistsSync.mockReturnValue(true);
      mockLoadConfig.mockReturnValue({
        version: "1",
        mode: "team",
        exporters: ["cursor"],
      });

      mockParseAllowList.mockReturnValue({
        version: 1,
        sources: [],
      });

      mockRegistry.list = vi.fn(() => ["cursor"]);
      mockSyncEngine.syncToAgents.mockResolvedValue({
        success: true,
        written: [".cursor/rules/aligntrue.mdc"],
        warnings: [],
      });

      await sync(["--force"]);

      // Should complete with warning
      expect(mockSyncEngine.syncToAgents).toHaveBeenCalled();
    });

    it("handles allow list parse errors gracefully", async () => {
      mockExistsSync.mockReturnValue(true);
      mockLoadConfig.mockReturnValue({
        version: "1",
        mode: "team",
        exporters: ["cursor"],
      });

      mockParseAllowList.mockImplementation(() => {
        throw new Error("Invalid YAML");
      });

      mockRegistry.list = vi.fn(() => ["cursor"]);
      mockSyncEngine.syncToAgents.mockResolvedValue({
        success: true,
        written: [".cursor/rules/aligntrue.mdc"],
        warnings: [],
      });

      await sync([]);

      // Should log warning but not fail
      expect(clack.log.warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to validate allow list"),
      );
      expect(mockSyncEngine.syncToAgents).toHaveBeenCalled();
    });
  });
});
