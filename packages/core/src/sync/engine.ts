/**
 * Core sync orchestration engine
 * Coordinates IR loading, scope resolution, exporter execution, and conflict detection
 */

import type { AlignPack, AlignRule } from '@aligntrue/schema'
import type { AlignTrueConfig } from '../config/index.js'
import type { ResolvedScope, Scope, MergeOrder } from '../scope.js'
import { loadConfig } from '../config/index.js'
import { resolveScopes, applyScopeMerge, groupRulesByLevel } from '../scope.js'
import { loadIR } from './ir-loader.js'
import { AtomicFileWriter } from './file-operations.js'
import { ConflictDetector, type Conflict } from './conflict-detector.js'

// Re-export types from exporters package
export interface ExporterPlugin {
  name: string
  version: string
  export(request: ScopedExportRequest, options: ExportOptions): Promise<ExportResult>
}

export interface ScopedExportRequest {
  scope: ResolvedScope
  rules: AlignRule[]
  outputPath: string
}

export interface ExportOptions {
  outputDir: string
  dryRun?: boolean
  backup?: boolean
}

export interface ExportResult {
  success: boolean
  filesWritten: string[]
  fidelityNotes?: string[]
  contentHash: string
}

/**
 * Options for sync operations
 */
export interface SyncOptions {
  acceptAgent?: string
  dryRun?: boolean
  backup?: boolean
  configPath?: string
  force?: boolean
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  success: boolean
  conflicts?: Conflict[]
  written: string[]
  warnings?: string[]
  exportResults?: Map<string, ExportResult>
}

/**
 * Sync engine coordinating the full sync pipeline
 */
export class SyncEngine {
  private config: AlignTrueConfig | null = null
  private ir: AlignPack | null = null
  private fileWriter: AtomicFileWriter
  private conflictDetector: ConflictDetector
  private exporters: Map<string, ExporterPlugin> = new Map()

  constructor() {
    this.fileWriter = new AtomicFileWriter()
    this.conflictDetector = new ConflictDetector()
  }

  /**
   * Register an exporter plugin
   */
  registerExporter(exporter: ExporterPlugin): void {
    this.exporters.set(exporter.name, exporter)
  }

  /**
   * Load configuration
   */
  async loadConfiguration(configPath?: string): Promise<void> {
    this.config = await loadConfig(configPath)
  }

  /**
   * Load IR from source
   */
  async loadIRFromSource(sourcePath: string): Promise<void> {
    this.ir = await loadIR(sourcePath)
  }

  /**
   * Sync IR to agents (default direction)
   */
  async syncToAgents(irPath: string, options: SyncOptions = {}): Promise<SyncResult> {
    const warnings: string[] = []
    const written: string[] = []
    const exportResults = new Map<string, ExportResult>()

    try {
      // Load config and IR
      await this.loadConfiguration(options.configPath)
      await this.loadIRFromSource(irPath)

      if (!this.config || !this.ir) {
        throw new Error('Configuration or IR not loaded')
      }

      // Resolve scopes
      const scopeConfig: { scopes: Scope[]; merge?: { strategy?: 'deep'; order?: MergeOrder } } = {
        scopes: this.config.scopes || [],
      }
      
      if (this.config.merge) {
        scopeConfig.merge = this.config.merge
      }

      const resolvedScopes = resolveScopes(process.cwd(), scopeConfig)

      // If no scopes defined, create default scope
      const scopes = resolvedScopes.length > 0
        ? resolvedScopes
        : [{
            path: '.',
            normalizedPath: '.',
            isDefault: true,
          } as ResolvedScope]

      // Get exporters to run
      const exporterNames = this.config.exporters || ['cursor', 'agents-md']
      const activeExporters: ExporterPlugin[] = []

      for (const name of exporterNames) {
        const exporter = this.exporters.get(name)
        if (exporter) {
          activeExporters.push(exporter)
        } else {
          warnings.push(`Exporter not found: ${name}`)
        }
      }

      if (activeExporters.length === 0) {
        throw new Error(
          `No active exporters found.\n` +
          `  Configured: ${exporterNames.join(', ')}\n` +
          `  Available: ${Array.from(this.exporters.keys()).join(', ')}`
        )
      }

      // For each scope, merge rules and call exporters
      for (const scope of scopes) {
        // For now, just use all rules from IR (scoped merge will be enhanced in later steps)
        // The current applyScopeMerge signature expects rule groups by level
        const mergeOrder = this.config.merge?.order || ['root', 'path', 'local']
        
        // Simple implementation: use all IR rules for now
        // TODO: Enhance this when per-scope rule filtering is needed
        const scopedRules = this.ir.rules || []

        // Call each exporter with scoped rules
        for (const exporter of activeExporters) {
          const request: ScopedExportRequest = {
            scope,
            rules: scopedRules,
            outputPath: `.${exporter.name}/${scope.path === '.' ? 'root' : scope.path}`,
          }

          const exportOptions: ExportOptions = {
            outputDir: process.cwd(),
            dryRun: options.dryRun || false,
            backup: options.backup || false,
          }

          try {
            const result = await exporter.export(request, exportOptions)
            exportResults.set(`${exporter.name}:${scope.path}`, result)

            if (result.success) {
              written.push(...result.filesWritten)

              // Track files for overwrite protection (if not dry-run)
              if (!options.dryRun) {
                for (const file of result.filesWritten) {
                  try {
                    this.fileWriter.trackFile(file)
                  } catch {
                    // Ignore tracking errors (file might not exist yet)
                  }
                }
              }

              // Collect fidelity notes as warnings
              if (result.fidelityNotes && result.fidelityNotes.length > 0) {
                warnings.push(
                  ...result.fidelityNotes.map(
                    (note: string) => `[${exporter.name}] ${note}`
                  )
                )
              }
            } else {
              throw new Error(`Exporter ${exporter.name} failed for scope ${scope.path}`)
            }
          } catch (err) {
            // Rollback on error
            if (!options.dryRun) {
              try {
                this.fileWriter.rollback()
              } catch (rollbackErr) {
                warnings.push(
                  `Rollback warning: ${rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)}`
                )
              }
            }

            throw new Error(
              `Export failed for ${exporter.name} (scope: ${scope.path})\n` +
              `  ${err instanceof Error ? err.message : String(err)}`
            )
          }
        }
      }

      const result: SyncResult = {
        success: true,
        written,
        exportResults,
      }
      
      if (warnings.length > 0) {
        result.warnings = warnings
      }
      
      return result
    } catch (err) {
      return {
        success: false,
        written: [],
        warnings: [err instanceof Error ? err.message : String(err)],
      }
    }
  }

  /**
   * Sync from agent to IR (pullback direction)
   * Requires explicit --accept-agent flag
   */
  async syncFromAgent(
    agent: string,
    irPath: string,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    // TODO: Implement in Step 17 (import from agents)
    // This is a skeleton for now
    return {
      success: false,
      written: [],
      warnings: ['Agent→IR sync not yet implemented. Coming in Step 17.'],
    }
  }

  /**
   * Detect conflicts between IR and agent state
   */
  detectConflicts(
    agentName: string,
    irRules: AlignRule[],
    agentRules: AlignRule[]
  ): Conflict[] {
    const result = this.conflictDetector.detectConflicts(agentName, irRules, agentRules)
    return result.conflicts
  }

  /**
   * Clear internal state
   */
  clear(): void {
    this.config = null
    this.ir = null
    this.fileWriter.clear()
  }
}

