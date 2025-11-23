/**
 * Core sync orchestration engine
 * Coordinates IR loading, scope resolution, exporter execution, and conflict detection
 */

import type { AlignPack, AlignSection } from "@aligntrue/schema";
import type { AlignTrueConfig } from "../config/index.js";
import { loadConfig } from "../config/index.js";
import { loadIR } from "./ir-loader.js";
import { AtomicFileWriter } from "@aligntrue/file-utils";
import { resolve as resolvePath } from "path";
import { resolvePlugsForPack } from "../plugs/index.js";
import { applyOverlays } from "../overlays/index.js";
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
} from "@aligntrue/plugin-contracts";

// Re-export for convenience
export type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
};

/**
 * Options for sync operations
 */
export interface SyncOptions {
  acceptAgent?: string;
  dryRun?: boolean;
  backup?: boolean;
  configPath?: string;
  force?: boolean;
  interactive?: boolean;
  defaultResolutionStrategy?: string;
  strict?: boolean; // Fail if required plugs are unresolved
}

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
  private ir: AlignPack | null = null;
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
      // When loading IR from a specific path, don't use multi-file loading
      // Clear edit_source to prevent loadIR from using loadSourceFiles
      const loadConfig = { ...this.config };
      if (loadConfig.sync) {
        loadConfig.sync = { ...loadConfig.sync };
        // Explicitly remove edit_source to force single-file loading
        delete loadConfig.sync.edit_source;
      }

      this.ir = await loadIR(sourcePath, {
        mode: this.config.mode,
        maxFileSizeMb: this.config.performance?.max_file_size_mb || 10,
        force: force || false,
        config: loadConfig,
      });
    } catch (err) {
      return {
        success: false,
        warnings: [err instanceof Error ? err.message : String(err)],
      };
    }

    if (!this.ir) {
      return { success: false, warnings: ["Failed to load IR"] };
    }

    const warnings: string[] = [];

    // Resolve plugs (Plugs system)
    if (this.ir.plugs) {
      const plugsResult = resolvePlugsForPack(
        this.ir,
        configFills, // Pass config fills so they're available during resolution
        strict ? { failOnUnresolved: true } : {},
      );

      if (!plugsResult.success) {
        return {
          success: false,
          warnings: plugsResult.errors || ["Plugs resolution failed"],
        };
      }

      // Update sections with resolved guidance (only if sections exist)
      if (this.ir.sections) {
        for (const resolvedRule of plugsResult.rules) {
          const section = this.ir.sections.find(
            (s) => s.heading === resolvedRule.ruleId,
          );
          if (section && resolvedRule.guidance) {
            // Guidance in sections is embedded in content, not a separate field
            // This is a no-op for sections format
          }
        }
      }

      // Add unresolved plugs as warnings and track count
      if (plugsResult.unresolvedRequired.length > 0) {
        this.unresolvedPlugsCount = plugsResult.unresolvedRequired.length;
        warnings.push(
          `Unresolved required plugs: ${plugsResult.unresolvedRequired.join(", ")}`,
        );
      } else {
        this.unresolvedPlugsCount = 0;
      }
    } else {
      this.unresolvedPlugsCount = 0;
    }

    if (warnings.length > 0) {
      return { success: true, warnings };
    }

    return { success: true };
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
          this.ir = overlayResult.modifiedIR as AlignPack;
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
      const lockfileValidation = validateAndEnforceLockfile(
        this.ir,
        this.config,
        process.cwd(),
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

      // Get active exporters
      const exporterNames = this.config.exporters || ["cursor", "agents"];
      const activeExporters: ExporterPlugin[] = [];

      for (const name of exporterNames) {
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
        },
      );

      written.push(...executionResult.written);
      warnings.push(...executionResult.warnings);
      auditTrail.push(...executionResult.auditTrail);
      exportResults = executionResult.exportResults;

      // Generate/update lockfile (delegated)
      const lockfileGeneration = generateAndWriteLockfile(
        this.ir,
        this.config,
        process.cwd(),
        options.dryRun || false,
      );
      written.push(...lockfileGeneration.written);
      warnings.push(...lockfileGeneration.warnings);
      auditTrail.push(...lockfileGeneration.auditTrail);

      // Cleanup old backups
      if (!options.dryRun) {
        try {
          const { BackupManager } = await import("../backup/manager.js");
          BackupManager.cleanupOldBackups({
            cwd: resolvePath(irPath, "..", ".."),
            keepCount: this.config.backup?.keep_count || 20,
          });
        } catch {
          // Ignore cleanup errors
        }
      }

      // Update last sync timestamp on success
      if (!options.dryRun) {
        const cwd = resolvePath(irPath, "..", "..");
        const { updateLastSyncTimestamp } = await import(
          "./last-sync-tracker.js"
        );
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
   * Sync from agent to IR (pullback direction)
   * Requires explicit --accept-agent flag
   * Note: Uses mock data in Step 14; real parsers in Step 17
   */
  async syncFromAgent(
    agent: string,
    irPath: string,
    options: SyncOptions = {},
  ): Promise<SyncResult> {
    const warnings: string[] = [];
    const written: string[] = [];
    const auditTrail: AuditEntry[] = [];

    try {
      // Load config and IR
      await this.loadConfiguration(options.configPath);
      await this.loadIRFromSource(
        irPath,
        options.force,
        false,
        this.config?.plugs?.fills,
      );

      if (!this.config || !this.ir) {
        throw new Error("Configuration or IR not loaded");
      }

      // Audit trail: Starting agent→IR sync
      auditTrail.push({
        action: "update",
        target: irPath,
        source: agent,
        timestamp: new Date().toISOString(),
        details: `Starting agent→IR sync from ${agent}`,
      });

      // Load agent rules for explicit --accept-agent pullback
      const agentRules = await this.loadAgentRules(agent, options);

      if (!agentRules || agentRules.length === 0) {
        warnings.push(`No rules found in agent ${agent}`);
        return {
          success: true,
          written: [],
          warnings,
          auditTrail,
        };
      }

      // Audit trail: Agent rules loaded
      auditTrail.push({
        action: "update",
        target: agent,
        source: agent,
        timestamp: new Date().toISOString(),
        details: `Loaded ${agentRules.length} rules from agent`,
      });

      // Conflict detection happens at multi-file-parser level
      // This is the correct approach for sections-only format
      auditTrail.push({
        action: "update",
        target: irPath,
        source: agent,
        timestamp: new Date().toISOString(),
        details: `Accepting all changes from ${agent} (conflict detection not yet implemented for sections)`,
      });

      // Team mode: full conflict detection
      // Sections are used now instead of rules
      const conflictResult = {
        status: "success" as const,
        conflicts: [],
      };

      if (conflictResult.conflicts.length > 0) {
        // Audit trail: Conflicts detected
        auditTrail.push({
          action: "conflict",
          target: irPath,
          source: agent,
          timestamp: new Date().toISOString(),
          details: `Detected ${conflictResult.conflicts.length} conflict(s)`,
        });

        // Conflict detection removed - not needed for sections-only format
        // In sections-only format, we use last-write-wins (auto-pull)
      }

      // Write updated IR (if not dry-run)
      if (!options.dryRun) {
        // Update IR with agent sections
        this.ir!.sections = agentRules;

        // Write IR to file
        const { stringify } = await import("yaml");
        const { writeFileSync } = await import("fs");
        const irContent = stringify(this.ir);
        writeFileSync(irPath, irContent, "utf-8");
        written.push(irPath);

        auditTrail.push({
          action: "update",
          target: irPath,
          source: agent,
          timestamp: new Date().toISOString(),
          details: `Updated IR from agent with ${agentRules.length} sections`,
        });

        // Generate/update lockfile (delegated)
        // This ensures lockfile stays in sync with updated IR
        const lockfileGeneration = generateAndWriteLockfile(
          this.ir!,
          this.config!,
          process.cwd(),
          options.dryRun || false,
        );
        written.push(...lockfileGeneration.written);
        if (lockfileGeneration.warnings) {
          warnings.push(...lockfileGeneration.warnings);
        }
        if (lockfileGeneration.auditTrail) {
          auditTrail.push(...lockfileGeneration.auditTrail);
        }

        // Update last sync timestamp after accepting agent changes
        // This ensures drift detection doesn't report the agent file as modified
        const cwd = resolvePath(irPath, "..", "..");
        const { updateLastSyncTimestamp } = await import(
          "./last-sync-tracker.js"
        );
        updateLastSyncTimestamp(cwd);
      }

      return {
        success: true,
        written,
        warnings,
        auditTrail,
      };
    } catch (_err) {
      return {
        success: false,
        written: [],
        warnings: [_err instanceof Error ? _err.message : String(_err)],
        auditTrail,
      };
    }
  }

  /**
   * Load agent sections from an on-disk agent file (cursor, AGENTS.md, etc.)
   * Used by syncFromAgent when --accept-agent is passed.
   */
  private async loadAgentRules(
    agent: string,
    _options: SyncOptions,
  ): Promise<import("@aligntrue/schema").AlignSection[]> {
    const cwd = process.cwd();
    const paths = getAlignTruePaths(cwd);
    const { join } = await import("path");
    const { existsSync, readFileSync } = await import("fs");

    // Map agent name to file path
    const agentFilePaths: Record<string, string> = {
      agents: paths.agentsMd(),
    };

    let filePath = agentFilePaths[agent];

    // Special handling for Cursor: check config for edit_source pattern
    if (agent === "cursor") {
      const config = this.config || (await loadConfig());
      const editSource = config.sync?.edit_source;

      // Use configured pattern if available, otherwise default
      const cursorPattern = Array.isArray(editSource)
        ? editSource.find((p) => p.includes(".cursor") || p.includes(".mdc"))
        : editSource &&
            (editSource.includes(".cursor") || editSource.includes(".mdc"))
          ? editSource
          : join(cwd, ".cursor/rules/aligntrue.mdc"); // Fallback to default

      if (cursorPattern && cursorPattern.includes("*")) {
        // It's a glob pattern - we need to find matching files
        // For accept-agent, we prioritize aligntrue.mdc if it exists, otherwise first match
        const { glob } = await import("glob");
        const matches = await glob(cursorPattern, { cwd, absolute: true });

        if (matches.length > 0) {
          // Prefer aligntrue.mdc if present in matches
          const preferred = matches.find((p) => p.endsWith("aligntrue.mdc"));
          filePath = preferred || matches[0];
        } else {
          // No matches found for glob
          filePath = join(cwd, ".cursor/rules/aligntrue.mdc");
        }
      } else {
        // Direct path
        filePath = cursorPattern
          ? resolvePath(cwd, cursorPattern)
          : join(cwd, ".cursor/rules/aligntrue.mdc");
      }
    }

    if (!filePath || !existsSync(filePath)) {
      throw new Error(`Agent file not found: ${agent}`);
    }

    // For explicit --accept-agent, parse directly (bypass edit_source check)
    const content = readFileSync(filePath, "utf-8");
    const { generateFingerprint } = await import("./multi-file-parser.js");

    // Dynamic import of parser from exporters package
    const parseModule = "@aligntrue/exporters/utils/section-parser";
    // @ts-ignore - Dynamic import of peer dependency (resolved at runtime)
    const parsers = await import(parseModule);

    let parsed: {
      sections: Array<{
        heading: string;
        content: string;
        level: number;
        hash: string;
      }>;
    };
    if (agent === "agents") {
      parsed = parsers.parseAgentsMd(content);
    } else if (agent === "cursor") {
      parsed = parsers.parseCursorMdc(content);
    } else {
      throw new Error(`Unsupported agent for import: ${agent}`);
    }

    // Convert parsed sections to AlignSection format
    return parsed.sections.map((s) => ({
      heading: s.heading,
      content: s.content,
      level: s.level,
      fingerprint: generateFingerprint(s.heading),
    }));
  }

  /**
   * Scope-aware sync for team mode

   * Reads from multiple storage backends, merges by scope, and writes back
   */
  async syncWithScopes(options: SyncOptions = {}): Promise<SyncResult> {
    const warnings: string[] = [];
    const written: string[] = [];
    const exportResults = new Map<string, ExportResult>();
    const auditTrail: AuditEntry[] = [];

    try {
      // Load config
      await this.loadConfiguration(options.configPath);
      if (!this.config) {
        throw new Error("Configuration not loaded");
      }

      // Check if scope configuration exists
      const scopesArray =
        this.config.scopes || this.config.resources?.rules?.scopes;
      const storageConfig =
        this.config.storage || this.config.resources?.rules?.storage;

      if (!scopesArray || !storageConfig) {
        // Fall back to regular sync if no scope config
        const irPath = resolvePath(process.cwd(), ".aligntrue/.rules.yaml");
        return this.syncToAgents(irPath, options);
      }

      // Import scope filtering functions
      const { filterSectionsByScope, mergeScopedSections } = await import(
        "./multi-file-parser.js"
      );
      const { StorageManager } = await import("../storage/manager.js");

      // Initialize storage manager
      const storageManager = new StorageManager(process.cwd(), storageConfig);

      // Read from all storage backends
      const allRules = await storageManager.readAll();

      // Merge all sections
      const allSections: AlignSection[] = [];
      for (const rules of Object.values(allRules)) {
        allSections.push(...rules);
      }

      // Convert scopes array to scope config Record format
      const scopeConfig: Record<string, { sections: string[] | "*" }> =
        Array.isArray(scopesArray)
          ? Object.fromEntries(
              scopesArray.map((scope) => [scope.path, { sections: "*" }]),
            )
          : scopesArray;

      // Filter sections by scope
      const scopedSections = filterSectionsByScope(allSections, scopeConfig);

      // Determine scope order (team first, then personal, then others)
      const scopeOrder = [
        "team",
        "personal",
        ...Object.keys(scopeConfig).filter(
          (s) => s !== "team" && s !== "personal",
        ),
      ];

      // Merge sections (later scopes override earlier ones)
      const mergedSections = mergeScopedSections(scopedSections, scopeOrder);

      // Create IR from merged sections
      this.ir = {
        id: "merged-scopes",
        version: "1.0",
        spec_version: "1",
        sections: mergedSections,
      };

      auditTrail.push({
        action: "update",
        target: "IR",
        source: "multi-scope",
        timestamp: new Date().toISOString(),
        details: `Merged ${mergedSections.length} sections from ${Object.keys(scopeConfig).length} scopes`,
      });

      // Now sync to agents using the merged IR
      const irPath = resolvePath(process.cwd(), ".aligntrue/.rules.yaml");
      const syncResult = await this.syncToAgents(irPath, options);

      // Write back to respective storage backends (only team scope in team mode)
      if (!options.dryRun && this.config.mode === "team") {
        const teamSections = scopedSections["team"] || [];
        await storageManager.getBackend("team").write(teamSections);
        written.push("team storage");

        auditTrail.push({
          action: "update",
          target: "team storage",
          source: "sync",
          timestamp: new Date().toISOString(),
          details: `Wrote ${teamSections.length} team sections to storage`,
        });
      }

      // Sync to remote if configured
      if (!options.dryRun) {
        await storageManager.syncAll();
        auditTrail.push({
          action: "update",
          target: "remote storage",
          source: "sync",
          timestamp: new Date().toISOString(),
          details: "Synced all storage backends to remote",
        });
      }

      return {
        success: syncResult.success,
        written: [...written, ...(syncResult.written || [])],
        warnings: [...warnings, ...(syncResult.warnings || [])],
        exportResults,
        auditTrail: [...auditTrail, ...(syncResult.auditTrail || [])],
      };
    } catch (err) {
      return {
        success: false,
        written: [],
        warnings: [err instanceof Error ? err.message : String(err)],
        auditTrail,
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
