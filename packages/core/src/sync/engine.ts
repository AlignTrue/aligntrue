/**
 * Core sync orchestration engine
 *
 * Coordinates unidirectional sync from .aligntrue/rules/*.md to agent-specific formats.
 * The .aligntrue/rules/ directory is the single source of truth.
 */

import type { Align } from "@aligntrue/schema";
import type { AlignTrueConfig, AlignTrueMode } from "../config/index.js";
import {
  loadConfig,
  normalizeExporterConfig,
  getExporterNames,
} from "../config/index.js";
import { loadIRAndResolvePlugs } from "./ir-loader.js";
import { AtomicFileWriter } from "@aligntrue/file-utils";
import { resolve as resolvePath } from "path";
import { applyOverlays } from "../overlays/index.js";
import { loadRulesDirectory } from "../rules/file-io.js";
import { getAlignTruePaths } from "../paths.js";

// New helper modules
import {
  validateAndEnforceLockfile,
  generateAndWriteLockfile,
} from "./lockfile-manager.js";
import { resolveSyncScopes } from "./scope-resolver.js";
import { executeExporters } from "./exporter-executor.js";

// Import types from plugin-contracts package
import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  SyncOptions,
} from "@aligntrue/plugin-contracts";

// Re-export for convenience
export type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  SyncOptions,
};

/**
 * Audit trail entry for sync operations
 */
export interface AuditEntry {
  action: "create" | "update" | "delete" | "conflict";
  target: string; // file path or rule ID
  source?: string; // where change came from
  hash?: string;
  timestamp: string;
  details: string;
  // Full provenance tracking
  provenance?: {
    owner?: string;
    source?: string;
    source_sha?: string;
  };
}

/**
 * Base result for sync operations that write files
 */
export interface OperationResult {
  written: string[];
  warnings: string[];
  auditTrail: AuditEntry[];
}

/**
 * Result of a sync operation
 */
export interface SyncResult extends Partial<OperationResult> {
  success: boolean;
  exportResults?: Map<string, ExportResult>;
  conflicts?: Array<{
    heading: string;
    files: Array<{ path: string; mtime: Date }>;
    reason: string;
    winner: string;
  }>;
}

/**
 * Sync engine coordinating the full sync pipeline
 */
export class SyncEngine {
  private config: AlignTrueConfig | null = null;
  private ir: Align | null = null;
  private fileWriter: AtomicFileWriter;
  private exporters: Map<string, ExporterPlugin> = new Map();
  private unresolvedPlugsCount: number = 0; // Track unresolved required plugs count (Plugs system)

  constructor() {
    this.fileWriter = new AtomicFileWriter();

    // Set checksum handler for interactive prompts
    this.fileWriter.setChecksumHandler(
      async (
        _filePath,
        _lastChecksum,
        _currentChecksum,
        interactive,
        force,
      ) => {
        // Simplified: always overwrite in non-interactive mode, prompt in interactive
        if (!interactive || force) {
          return "overwrite";
        }
        // In interactive mode without force, default to safe (don't overwrite)
        return "keep";
      },
    );
  }

  /**
   * Register an exporter plugin
   */
  registerExporter(exporter: ExporterPlugin): void {
    this.exporters.set(exporter.name, exporter);
  }

  /**
   * Load configuration
   */
  async loadConfiguration(configPath?: string): Promise<void> {
    this.config = await loadConfig(configPath);
  }

  /**
   * Load IR from source and resolve plugs
   */
  async loadIRFromSource(
    sourcePath: string,
    force?: boolean,
    strict?: boolean,
    configFills?: Record<string, string>,
  ): Promise<{ success: boolean; warnings?: string[] }> {
    if (!this.config) {
      throw new Error(
        "Configuration not loaded. Call loadConfiguration() first.",
      );
    }

    try {
      const loadOptions: {
        mode: AlignTrueMode;
        maxFileSizeMb: number;
        force: boolean;
        config: AlignTrueConfig;
        strictPlugs?: boolean;
        plugFills?: Record<string, string>;
      } = {
        mode: this.config.mode,
        maxFileSizeMb: this.config.performance?.max_file_size_mb || 10,
        force: force || false,
        config: this.config,
      };

      // Only include optional properties if they have defined values
      if (strict !== undefined) {
        loadOptions.strictPlugs = strict;
      }
      if (configFills !== undefined) {
        loadOptions.plugFills = configFills;
      }

      const result = await loadIRAndResolvePlugs(sourcePath, loadOptions);

      if (!result.success) {
        return {
          success: false,
          warnings: result.warnings,
        };
      }

      this.ir = result.ir;
      this.unresolvedPlugsCount = result.unresolvedPlugsCount;

      if (result.warnings.length > 0) {
        return { success: true, warnings: result.warnings };
      }

      return { success: true };
    } catch (err) {
      return {
        success: false,
        warnings: [err instanceof Error ? err.message : String(err)],
      };
    }
  }

  /**
   * Sync IR to agents (default direction)
   */
  async syncToAgents(
    irPath: string,
    options: SyncOptions = {},
  ): Promise<SyncResult> {
    const warnings: string[] = [];
    const written: string[] = [];
    let exportResults: Map<string, ExportResult>;
    const auditTrail: AuditEntry[] = [];

    try {
      // Load config and IR
      await this.loadConfiguration(options.configPath);
      const loadResult = await this.loadIRFromSource(
        irPath,
        options.force,
        options.strict,
        this.config?.plugs?.fills,
      );

      if (!loadResult.success || !this.config || !this.ir) {
        return {
          success: false,
          written: [],
          warnings: loadResult.warnings || ["Configuration or IR not loaded"],
        };
      }

      // Merge load warnings into sync warnings
      if (loadResult.warnings) {
        warnings.push(...loadResult.warnings);
      }

      // Audit trail: IR loaded with provenance
      const sectionsCount = this.ir.sections?.length || 0;
      const contentType = `${sectionsCount} sections`;

      auditTrail.push({
        action: "update",
        target: irPath,
        source: "IR",
        timestamp: new Date().toISOString(),
        details: `Loaded ${contentType} from IR`,
        provenance: {
          ...(this.ir.owner && { owner: this.ir.owner }),
          ...(this.ir.source && { source: this.ir.source }),
          ...(this.ir.source_sha && { source_sha: this.ir.source_sha }),
        },
      });

      // Apply overlays (Overlays system) - before export, after plugs resolution
      if (
        this.ir &&
        this.config.overlays?.overrides &&
        this.config.overlays.overrides.length > 0
      ) {
        const overlayOptions: {
          maxOverrides?: number;
          maxOperationsPerOverride?: number;
        } = {};
        if (this.config.overlays.limits?.max_overrides) {
          overlayOptions.maxOverrides =
            this.config.overlays.limits.max_overrides;
        }
        if (this.config.overlays.limits?.max_operations_per_override) {
          overlayOptions.maxOperationsPerOverride =
            this.config.overlays.limits.max_operations_per_override;
        }

        const overlayResult = applyOverlays(
          this.ir,
          this.config.overlays.overrides,
          Object.keys(overlayOptions).length > 0 ? overlayOptions : undefined,
        );

        if (!overlayResult.success) {
          return {
            success: false,
            written: [],
            warnings: overlayResult.errors || ["Overlay application failed"],
          };
        }

        // Update IR with modified version
        if (overlayResult.modifiedIR) {
          this.ir = overlayResult.modifiedIR as Align;
        }

        // Add overlay warnings
        if (overlayResult.warnings) {
          warnings.push(...overlayResult.warnings);
        }

        // Audit trail: Overlays applied
        auditTrail.push({
          action: "update",
          target: "overlays",
          source: "config",
          timestamp: new Date().toISOString(),
          details: `Applied ${overlayResult.appliedCount || 0} overlays`,
        });
      }

      // Lockfile validation (delegated)
      // Load rules from .aligntrue/rules/ directory for validation
      const cwd = process.cwd();
      const paths = getAlignTruePaths(cwd);
      const rules = await loadRulesDirectory(paths.rules, cwd);
      const lockfileValidation = validateAndEnforceLockfile(
        rules,
        this.config,
        cwd,
      );
      if (lockfileValidation.auditTrail) {
        auditTrail.push(...lockfileValidation.auditTrail);
      }
      if (!lockfileValidation.success) {
        return {
          success: false,
          written: [],
          warnings: lockfileValidation.warnings || [],
          auditTrail,
        };
      }

      // Resolve scopes (delegated)
      const scopes = resolveSyncScopes(this.config, process.cwd());

      // Get active exporters (normalized from array or object format)
      const normalizedExporters = normalizeExporterConfig(
        this.config.exporters,
      );
      const exporterNames = getExporterNames(this.config.exporters);

      // Fall back to defaults if no exporters configured
      const effectiveExporterNames =
        exporterNames.length > 0 ? exporterNames : ["cursor", "agents"];

      const activeExporters: ExporterPlugin[] = [];

      for (const name of effectiveExporterNames) {
        // Check format setting - if "agents-md", skip native exporter
        // (the agents exporter will handle this agent's rules in AGENTS.md)
        const exporterConfig = normalizedExporters[name] || {};
        if (exporterConfig.format === "agents-md" && name !== "agents") {
          // Skip native exporter when format is agents-md
          // Ensure "agents" exporter is included instead
          if (!effectiveExporterNames.includes("agents")) {
            const agentsExporter = this.exporters.get("agents");
            if (agentsExporter && !activeExporters.includes(agentsExporter)) {
              activeExporters.push(agentsExporter);
            }
          }
          continue;
        }

        const exporter = this.exporters.get(name);
        if (exporter) {
          activeExporters.push(exporter);
        } else {
          warnings.push(`Exporter not found: ${name}`);
        }
      }

      if (activeExporters.length === 0) {
        throw new Error(
          `No active exporters found.\n` +
            `  Configured: ${exporterNames.join(", ")}\n` +
            `  Available: ${Array.from(this.exporters.keys()).join(", ")}`,
        );
      }

      // Execute exporters (delegated)
      const executionResult = await executeExporters(
        activeExporters,
        scopes,
        this.ir,
        this.config,
        this.fileWriter,
        {
          dryRun: options.dryRun || false,
          interactive: options.interactive || false,
          force: options.force || false,
          unresolvedPlugsCount: this.unresolvedPlugsCount,
          ...(options.contentMode && {
            contentMode: options.contentMode,
          }),
        },
      );

      written.push(...executionResult.written);
      warnings.push(...executionResult.warnings);
      auditTrail.push(...executionResult.auditTrail);
      exportResults = executionResult.exportResults;

      // Generate/update lockfile (delegated)
      // Skip if caller has already handled lockfile generation (e.g., CLI with bundleResult.align)
      if (!options.skipLockfileGeneration) {
        // Use the same rules loaded for validation
        const lockfileGeneration = generateAndWriteLockfile(
          rules,
          this.config,
          cwd,
          options.dryRun || false,
        );
        written.push(...lockfileGeneration.written);
        warnings.push(...lockfileGeneration.warnings);
        auditTrail.push(...lockfileGeneration.auditTrail);
      }

      // Cleanup old backups
      if (!options.dryRun) {
        try {
          const { BackupManager } = await import("../backup/manager.js");
          BackupManager.cleanupOldBackups({
            cwd: resolvePath(irPath, "..", ".."),
            retentionDays: this.config.backup?.retention_days ?? 30,
            minimumKeep: this.config.backup?.minimum_keep ?? 3,
          });
        } catch {
          // Ignore cleanup errors
        }
      }

      // Update last sync timestamp on success
      if (!options.dryRun) {
        const cwd = resolvePath(irPath, "..", "..");
        const { updateLastSyncTimestamp } = await import("./tracking.js");
        updateLastSyncTimestamp(cwd);
      }

      const result: SyncResult = {
        success: true,
        written,
        exportResults,
        auditTrail,
      };

      if (warnings.length > 0) {
        result.warnings = warnings;
      }

      return result;
    } catch (_err) {
      return {
        success: false,
        written: [],
        warnings: [_err instanceof Error ? _err.message : String(_err)],
      };
    }
  }

  /**
   * Clear internal state
   */
  clear(): void {
    this.config = null;
    this.ir = null;
    this.fileWriter.clear();
  }
}
