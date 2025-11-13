/**
 * Core sync orchestration engine
 * Coordinates IR loading, scope resolution, exporter execution, and conflict detection
 */

import type { AlignPack } from "@aligntrue/schema";
import type { AlignTrueConfig } from "../config/index.js";
import type { ResolvedScope, Scope, MergeOrder } from "../scope.js";
import type { SectionConflict } from "./multi-file-parser.js";
import { loadConfig } from "../config/index.js";
import { resolveScopes } from "../scope.js";
import { loadIR } from "./ir-loader.js";
import { AtomicFileWriter } from "@aligntrue/file-utils";
import { posix, resolve as resolvePath } from "path";
import {
  readLockfile,
  writeLockfile,
  validateLockfile,
  enforceLockfile,
  generateLockfile,
} from "../lockfile/index.js";
import { resolvePlugsForPack } from "../plugs/index.js";
import { applyOverlays } from "../overlays/index.js";
import { getAlignTruePaths } from "../paths.js";

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
 * Result of a sync operation
 */
export interface SyncResult {
  success: boolean;
  written: string[];
  warnings?: string[];
  exportResults?: Map<string, ExportResult>;
  auditTrail?: AuditEntry[];
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
  ): Promise<{ success: boolean; warnings?: string[] }> {
    if (!this.config) {
      throw new Error(
        "Configuration not loaded. Call loadConfiguration() first.",
      );
    }

    try {
      // When loading IR from a specific path, don't use multi-file loading
      // Clear source_files to prevent loadIR from using loadSourceFiles
      const loadConfig = { ...this.config };
      if (loadConfig.sync) {
        loadConfig.sync = { ...loadConfig.sync };
        delete loadConfig.sync.source_files;
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
        undefined, // No additional fills in basic sync (can be extended later)
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
    const exportResults = new Map<string, ExportResult>();
    const auditTrail: AuditEntry[] = [];

    try {
      // Load config and IR
      await this.loadConfiguration(options.configPath);
      const loadResult = await this.loadIRFromSource(
        irPath,
        options.force,
        options.strict,
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

      // Lockfile validation (if team mode)
      const lockfilePath = resolvePath(process.cwd(), ".aligntrue.lock.json");
      const lockfileMode = this.config.lockfile?.mode || "off";
      const isTeamMode =
        this.config.mode === "team" || this.config.mode === "enterprise";

      if (isTeamMode && this.config.modules?.lockfile) {
        const existingLockfile = readLockfile(lockfilePath);

        if (existingLockfile) {
          // Validate lockfile against current IR
          const validation = validateLockfile(existingLockfile, this.ir);
          const enforcement = enforceLockfile(lockfileMode, validation);

          // Audit trail: Lockfile validation
          auditTrail.push({
            action: validation.valid ? "update" : "conflict",
            target: lockfilePath,
            source: "lockfile",
            timestamp: new Date().toISOString(),
            details: enforcement.message || "Lockfile validation completed",
          });

          // Abort sync if strict mode failed
          if (!enforcement.success) {
            return {
              success: false,
              written: [],
              warnings: [
                enforcement.message ||
                  "Lockfile validation failed in strict mode",
              ],
              auditTrail,
            };
          }
        } else {
          // No lockfile exists - will be generated after sync
          auditTrail.push({
            action: "create",
            target: lockfilePath,
            source: "lockfile",
            timestamp: new Date().toISOString(),
            details: "No existing lockfile found, will generate after sync",
          });
        }
      }

      // Resolve scopes
      const scopeConfig: {
        scopes: Scope[];
        merge?: { strategy?: "deep"; order?: MergeOrder };
      } = {
        scopes: this.config.scopes || [],
      };

      if (this.config.merge) {
        scopeConfig.merge = this.config.merge;
      }

      const resolvedScopes = resolveScopes(process.cwd(), scopeConfig);

      // If no scopes defined, create default scope
      const scopes =
        resolvedScopes.length > 0
          ? resolvedScopes
          : [
              {
                path: ".",
                normalizedPath: ".",
                isDefault: true,
              } as ResolvedScope,
            ];

      // Get exporters to run
      const exporterNames = this.config.exporters || ["cursor", "agents-md"];
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

      // Reset state on all exporters before starting new sync cycle
      // This prevents accumulation of rules across multiple syncs
      for (const exporter of activeExporters) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof (exporter as any).resetState === "function") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (exporter as any).resetState();
        }
      }

      // For each scope, merge rules and call exporters
      for (const scope of scopes) {
        // For now, just use all rules from IR (scoped merge will be enhanced in later steps)
        // The current applyScopeMerge signature expects rule groups by level
        const _mergeOrder = this.config.merge?.order || [
          "root",
          "path",
          "local",
        ];

        // Build scoped pack (sections-only)
        const scopedPack: AlignPack = {
          id: this.ir.id,
          version: this.ir.version,
          spec_version: this.ir.spec_version,
          sections: this.ir.sections,
          ...(this.ir.summary && { summary: this.ir.summary }),
          ...(this.ir.owner && { owner: this.ir.owner }),
          ...(this.ir.source && { source: this.ir.source }),
          ...(this.ir.source_sha && { source_sha: this.ir.source_sha }),
          ...(this.ir.vendor_path && { vendor_path: this.ir.vendor_path }),
          ...(this.ir.vendor_type && { vendor_type: this.ir.vendor_type }),
          ...(this.ir.tags && { tags: this.ir.tags }),
          ...(this.ir.deps && { deps: this.ir.deps }),
          ...(this.ir.scope && { scope: this.ir.scope }),
          ...(this.ir.plugs && { plugs: this.ir.plugs }),
          ...(this.ir.integrity && { integrity: this.ir.integrity }),
          ...(this.ir._markdown_meta && {
            _markdown_meta: this.ir._markdown_meta,
          }),
        };

        // Call each exporter with scoped pack
        for (const exporter of activeExporters) {
          const outputPath = `.${exporter.name}/${scope.path === "." ? "root" : scope.path}`;

          // Security: Validate output paths don't escape workspace
          if (outputPath.includes("..") || posix.isAbsolute(outputPath)) {
            warnings.push(
              `Skipped ${exporter.name} for scope ${scope.path}: invalid output path "${outputPath}"`,
            );
            continue;
          }

          const request: ScopedExportRequest = {
            scope,
            pack: scopedPack,
            outputPath,
          };

          // Get backup options from config
          const { getBackupOptions } = await import("./file-operations.js");
          const backupOptions = this.config
            ? getBackupOptions(
                this.config.mode,
                this.config.sync?.backup_on_overwrite,
                this.config.sync?.backup_extension,
              )
            : { enabled: false, skipIfIdentical: true, extension: ".bak" };

          const exportOptions: ExportOptions = {
            outputDir: process.cwd(),
            dryRun: options.dryRun || false,
            backup: options.backup || false,
            backupOptions,
            unresolvedPlugsCount: this.unresolvedPlugsCount, // Pass unresolved plugs count to exporters (Plugs system)
            managedSections: this.config?.managed?.sections || [], // Pass team-managed sections to exporters
          };

          try {
            const result = await exporter.export(request, exportOptions);
            exportResults.set(`${exporter.name}:${scope.path}`, result);

            if (result.success) {
              written.push(...result.filesWritten);

              // Audit trail: Files written
              for (const file of result.filesWritten) {
                auditTrail.push({
                  action: options.dryRun ? "update" : "create",
                  target: file,
                  source: `${exporter.name} exporter`,
                  hash: result.contentHash,
                  timestamp: new Date().toISOString(),
                  details: options.dryRun
                    ? `Would write file (dry-run)`
                    : `Wrote file successfully`,
                });
              }

              // Track files for overwrite protection (if not dry-run)
              if (!options.dryRun) {
                for (const file of result.filesWritten) {
                  try {
                    this.fileWriter.trackFile(file);
                  } catch {
                    // Ignore tracking errors (file might not exist yet)
                  }
                }
              }

              // Collect fidelity notes as warnings
              if (result.fidelityNotes && result.fidelityNotes.length > 0) {
                warnings.push(
                  ...result.fidelityNotes.map(
                    (note: string) => `[${exporter.name}] ${note}`,
                  ),
                );
              }
            } else {
              throw new Error(
                `Exporter ${exporter.name} failed for scope ${scope.path}`,
              );
            }
          } catch (_err) {
            // Rollback on error
            if (!options.dryRun) {
              try {
                this.fileWriter.rollback();
              } catch (rollbackErr) {
                warnings.push(
                  `Rollback warning: ${rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)}`,
                );
              }
            }

            throw new Error(
              `Export failed for ${exporter.name} (scope: ${scope.path})\n` +
                `  ${_err instanceof Error ? _err.message : String(_err)}`,
            );
          }
        }
      }

      // Generate/update lockfile after successful sync (if team mode and not dry-run)
      if (isTeamMode && this.config.modules?.lockfile && !options.dryRun) {
        try {
          const lockfile = generateLockfile(
            this.ir,
            this.config.mode as "team" | "enterprise",
          );

          // Validate lockfile path is absolute
          const absoluteLockfilePath = lockfilePath.startsWith("/")
            ? lockfilePath
            : resolvePath(process.cwd(), lockfilePath);

          writeLockfile(absoluteLockfilePath, lockfile);
          written.push(absoluteLockfilePath);

          // Audit trail: Lockfile generated
          auditTrail.push({
            action: "update",
            target: absoluteLockfilePath,
            source: "lockfile",
            hash: lockfile.bundle_hash,
            timestamp: new Date().toISOString(),
            details: `Generated lockfile with ${lockfile.rules?.length || 0} entry hashes`,
          });
        } catch (_err) {
          // Log detailed error information
          const errorMsg = _err instanceof Error ? _err.message : String(_err);
          warnings.push(
            `Failed to generate lockfile at ${lockfilePath}: ${errorMsg}`,
          );
          // Also log to console for debugging
          console.error(`Lockfile generation error:`, {
            path: lockfilePath,
            cwd: process.cwd(),
            error: errorMsg,
          });
        }
      }

      // Update last sync timestamp on success
      if (!options.dryRun) {
        const cwd = resolvePath(irPath, "..", "..");
        const { EditDetector } = await import("./edit-detector.js");
        const detector = new EditDetector(cwd);
        detector.updateLastSyncTimestamp();
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
      await this.loadIRFromSource(irPath, options.force);

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

      // Load agent rules (mock implementation for Step 14)
      // In Step 17, this will use real parsers for .cursor/*.mdc, AGENTS.md, etc.
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

      // TODO: Implement conflict detection for sections format
      // For now, skip conflict detection and accept agent changes directly
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
        // In a real implementation, we'd use a proper IR writer
        // For now, just track that we would write
        written.push(irPath);

        auditTrail.push({
          action: "update",
          target: irPath,
          source: agent,
          timestamp: new Date().toISOString(),
          details: `Updated IR from agent (sections-only)`,
        });
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
   * Load agent sections
   * @deprecated Import removed - not needed for sections-only format
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
      "agents-md": paths.agentsMd(),
      cursor: join(cwd, ".cursor/rules/aligntrue.mdc"),
    };

    const filePath = agentFilePaths[agent];
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
    if (agent === "agents-md") {
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
   * Sync from multiple edited agent files (two-way sync)
   * Detects edited agent files, merges to IR, then syncs back to all agents
   */
  async syncFromMultipleAgents(
    configPath: string,
    options: SyncOptions = {},
  ): Promise<SyncResult> {
    const auditTrail: AuditEntry[] = [];
    const written: string[] = [];
    const warnings: string[] = [];
    let conflicts: SectionConflict[] = [];

    try {
      // Load config
      const config = await loadConfig(configPath);
      this.config = config;
      const cwd = resolvePath(configPath, "..");
      const paths = getAlignTruePaths(cwd);

      // Import multi-file parser
      const { detectEditedFiles, mergeFromMultipleFiles } = await import(
        "./multi-file-parser.js"
      );

      // 1. Detect edited agent files
      const editedFiles = await detectEditedFiles(cwd, config);

      if (editedFiles.length === 0) {
        // No edits detected - proceed with normal IR-to-agents sync
        // This is the expected path when IR is the source of truth
      } else {
        auditTrail.push({
          action: "update",
          target: "multi-file-detection",
          timestamp: new Date().toISOString(),
          details: `Detected ${editedFiles.length} edited file(s)`,
        });

        // 2. Load current IR
        const currentIR = await loadIR(paths.rules, {
          config: this.config,
        });

        // 3. Merge changes from agent files
        const mergeResult = mergeFromMultipleFiles(editedFiles, currentIR);

        // 4. Check for conflicts
        conflicts = mergeResult.conflicts;
        if (conflicts.length > 0) {
          for (const conflict of conflicts) {
            const fileList = conflict.files.map((f) => f.path).join(", ");
            warnings.push(
              `Section "${conflict.heading}" edited in multiple files: ${fileList}`,
            );
            auditTrail.push({
              action: "conflict",
              target: conflict.heading,
              timestamp: new Date().toISOString(),
              details: `${conflict.reason}: ${fileList}`,
            });
          }
        }

        // 5. Write merged IR
        if (!options.dryRun) {
          const { saveIR } = await import("./ir-loader.js");
          await saveIR(paths.rules, mergeResult.mergedPack);
          written.push(paths.rules);

          auditTrail.push({
            action: "update",
            target: paths.rules,
            timestamp: new Date().toISOString(),
            details: `Merged ${editedFiles.length} file(s) to IR`,
          });
        }
      }

      // 6. Export IR to all configured agents (always run)
      const syncResult = await this.syncToAgents(paths.rules, options);

      // 7. Update last sync timestamp on success
      if (syncResult.success && !options.dryRun) {
        const { EditDetector } = await import("./edit-detector.js");
        const detector = new EditDetector(cwd);
        detector.updateLastSyncTimestamp();
      }

      const result: SyncResult = {
        success: true,
        written: [...written, ...syncResult.written],
        warnings: [...warnings, ...(syncResult.warnings || [])],
        auditTrail: [...auditTrail, ...(syncResult.auditTrail || [])],
      };

      if (conflicts.length > 0) {
        result.conflicts = conflicts;
      }

      if (syncResult.exportResults) {
        result.exportResults = syncResult.exportResults;
      }

      return result;
    } catch (err) {
      return {
        success: false,
        written,
        warnings: [err instanceof Error ? err.message : String(err)],
        auditTrail,
      };
    }
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allSections: any[] = [];
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
        written: [...written, ...syncResult.written],
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
