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
import { AtomicFileWriter } from '@aligntrue/file-utils'
import { ConflictDetector, type Conflict } from './conflict-detector.js'
import { posix, resolve as resolvePath } from 'path'
import {
  readLockfile,
  writeLockfile,
  validateLockfile,
  enforceLockfile,
  generateLockfile,
  type Lockfile,
} from '../lockfile/index.js'

// Import types from plugin-contracts package
import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult
} from '@aligntrue/plugin-contracts'

// Re-export for convenience
export type { ExporterPlugin, ScopedExportRequest, ExportOptions, ExportResult }

/**
 * Options for sync operations
 */
export interface SyncOptions {
  acceptAgent?: string
  dryRun?: boolean
  backup?: boolean
  configPath?: string
  force?: boolean
  interactive?: boolean
  defaultResolutionStrategy?: string
}

/**
 * Audit trail entry for sync operations
 */
export interface AuditEntry {
  action: 'create' | 'update' | 'delete' | 'conflict'
  target: string // file path or rule ID
  source?: string // where change came from
  hash?: string
  timestamp: string
  details: string
  // Full provenance tracking
  provenance?: {
    owner?: string
    source?: string
    source_sha?: string
  }
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
  auditTrail?: AuditEntry[]
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
    
    // Set checksum handler for interactive prompts
    this.fileWriter.setChecksumHandler(async (filePath, lastChecksum, currentChecksum, interactive, force) => {
      const { promptOnChecksumMismatch } = await import('./conflict-prompt.js')
      return promptOnChecksumMismatch(filePath, lastChecksum, currentChecksum, interactive, force)
    })
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
    const auditTrail: AuditEntry[] = []

    try {
      // Load config and IR
      await this.loadConfiguration(options.configPath)
      await this.loadIRFromSource(irPath)

      if (!this.config || !this.ir) {
        throw new Error('Configuration or IR not loaded')
      }

      // Audit trail: IR loaded with provenance
      auditTrail.push({
        action: 'update',
        target: irPath,
        source: 'IR',
        timestamp: new Date().toISOString(),
        details: `Loaded ${this.ir.rules?.length || 0} rules from IR`,
        provenance: {
          ...(this.ir.owner && { owner: this.ir.owner }),
          ...(this.ir.source && { source: this.ir.source }),
          ...(this.ir.source_sha && { source_sha: this.ir.source_sha }),
        },
      })

      // Lockfile validation (if team mode)
      const lockfilePath = resolvePath(process.cwd(), '.aligntrue.lock.json')
      const lockfileMode = this.config.lockfile?.mode || 'off'
      const isTeamMode = this.config.mode === 'team' || this.config.mode === 'enterprise'
      
      if (isTeamMode && this.config.modules?.lockfile) {
        const existingLockfile = readLockfile(lockfilePath)
        
        if (existingLockfile) {
          // Validate lockfile against current IR
          const validation = validateLockfile(existingLockfile, this.ir)
          const enforcement = enforceLockfile(lockfileMode, validation)
          
          // Audit trail: Lockfile validation
          auditTrail.push({
            action: validation.valid ? 'update' : 'conflict',
            target: lockfilePath,
            source: 'lockfile',
            timestamp: new Date().toISOString(),
            details: enforcement.message || 'Lockfile validation completed',
          })
          
          // Abort sync if strict mode failed
          if (!enforcement.success) {
            return {
              success: false,
              written: [],
              warnings: [enforcement.message || 'Lockfile validation failed in strict mode'],
              auditTrail,
            }
          }
        } else {
          // No lockfile exists - will be generated after sync
          auditTrail.push({
            action: 'create',
            target: lockfilePath,
            source: 'lockfile',
            timestamp: new Date().toISOString(),
            details: 'No existing lockfile found, will generate after sync',
          })
        }
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
          const outputPath = `.${exporter.name}/${scope.path === '.' ? 'root' : scope.path}`
          
          // Security: Validate output paths don't escape workspace
          if (outputPath.includes('..') || posix.isAbsolute(outputPath)) {
            warnings.push(
              `Skipped ${exporter.name} for scope ${scope.path}: invalid output path "${outputPath}"`
            )
            continue
          }
          
          const request: ScopedExportRequest = {
            scope,
            rules: scopedRules,
            outputPath,
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

              // Audit trail: Files written
              for (const file of result.filesWritten) {
                auditTrail.push({
                  action: options.dryRun ? 'update' : 'create',
                  target: file,
                  source: `${exporter.name} exporter`,
                  hash: result.contentHash,
                  timestamp: new Date().toISOString(),
                  details: options.dryRun 
                    ? `Would write file (dry-run)` 
                    : `Wrote file successfully`,
                })
              }

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

      // Generate/update lockfile after successful sync (if team mode and not dry-run)
      if (isTeamMode && this.config.modules?.lockfile && !options.dryRun) {
        try {
          const lockfile = generateLockfile(this.ir, this.config.mode as 'team' | 'enterprise')
          writeLockfile(lockfilePath, lockfile)
          written.push(lockfilePath)
          
          // Audit trail: Lockfile generated
          auditTrail.push({
            action: 'update',
            target: lockfilePath,
            source: 'lockfile',
            hash: lockfile.bundle_hash,
            timestamp: new Date().toISOString(),
            details: `Generated lockfile with ${lockfile.rules.length} rule hashes`,
          })
        } catch (err) {
          warnings.push(
            `Failed to generate lockfile: ${err instanceof Error ? err.message : String(err)}`
          )
        }
      }

      const result: SyncResult = {
        success: true,
        written,
        exportResults,
        auditTrail,
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
   * Note: Uses mock data in Step 14; real parsers in Step 17
   */
  async syncFromAgent(
    agent: string,
    irPath: string,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const warnings: string[] = []
    const written: string[] = []
    const auditTrail: AuditEntry[] = []

    try {
      // Load config and IR
      await this.loadConfiguration(options.configPath)
      await this.loadIRFromSource(irPath)

      if (!this.config || !this.ir) {
        throw new Error('Configuration or IR not loaded')
      }

      // Audit trail: Starting agent→IR sync
      auditTrail.push({
        action: 'update',
        target: irPath,
        source: agent,
        timestamp: new Date().toISOString(),
        details: `Starting agent→IR sync from ${agent}`,
      })

      // Load agent rules (mock implementation for Step 14)
      // In Step 17, this will use real parsers for .cursor/*.mdc, AGENTS.md, etc.
      const agentRules = await this.loadAgentRules(agent, options)
      
      if (!agentRules || agentRules.length === 0) {
        warnings.push(`No rules found in agent ${agent}`)
        return {
          success: true,
          written: [],
          warnings,
          auditTrail,
        }
      }

      // Audit trail: Agent rules loaded
      auditTrail.push({
        action: 'update',
        target: agent,
        source: agent,
        timestamp: new Date().toISOString(),
        details: `Loaded ${agentRules.length} rules from agent`,
      })

      // Check if we should use solo mode fast path
      const { shouldUseSoloFastPath } = await import('./conflict-detector.js')
      const useFastPath = this.config && shouldUseSoloFastPath(this.config, agent)
      
      // Solo mode fast path: skip conflict detection, directly accept agent rules
      if (useFastPath) {
        auditTrail.push({
          action: 'update',
          target: irPath,
          source: agent,
          timestamp: new Date().toISOString(),
          details: `Solo mode fast path: accepting all changes from ${agent}`,
        })
        
        // Directly update IR with agent rules
        this.ir.rules = agentRules
        
        // Write updated IR if not dry-run
        if (!options.dryRun) {
          const { writeFile } = await import('fs/promises')
          const { extname } = await import('path')
          const yaml = await import('js-yaml')
          
          // Detect source format and preserve it
          const ext = extname(irPath).toLowerCase()
          let content: string
          
          if (ext === '.md' || ext === '.markdown') {
            // Preserve markdown format with fenced blocks
            const yamlContent = yaml.dump(this.ir, { lineWidth: -1 })
            content = `# AlignTrue Rules\n\n\`\`\`aligntrue\n${yamlContent}\`\`\`\n`
          } else {
            // Write as YAML
            content = yaml.dump(this.ir)
          }
          
          await writeFile(irPath, content, 'utf-8')
          written.push(irPath)
        }
        
        return {
          success: true,
          written,
          warnings,
          auditTrail,
        }
      }
      
      // Team mode: full conflict detection
      const irRules = this.ir.rules || []
      const conflictResult = this.conflictDetector.detectConflicts(agent, irRules, agentRules)

      if (conflictResult.hasConflicts) {
        // Audit trail: Conflicts detected
        auditTrail.push({
          action: 'conflict',
          target: irPath,
          source: agent,
          timestamp: new Date().toISOString(),
          details: `Detected ${conflictResult.conflicts.length} conflict(s)`,
        })

        // If dry-run, just return conflicts
        if (options.dryRun) {
          return {
            success: true,
            conflicts: conflictResult.conflicts,
            written: [],
            warnings,
            auditTrail,
          }
        }

        // Handle conflicts (interactive or default strategy)
        const resolutions = await this.resolveConflicts(
          conflictResult.conflicts,
          options
        )

        // Apply resolutions to IR
        const updatedRules = this.conflictDetector.applyResolutions(
          irRules,
          Array.from(resolutions.values())
        )

        // Update IR with resolved rules
        this.ir.rules = updatedRules

        // Audit trail: Resolutions applied
        for (const resolution of resolutions.values()) {
          auditTrail.push({
            action: 'update',
            target: resolution.ruleId,
            source: agent,
            timestamp: resolution.timestamp,
            details: `Applied ${resolution.strategy} for field ${resolution.field}`,
          })
        }
      }

      // Write updated IR (if not dry-run)
      if (!options.dryRun) {
        // In a real implementation, we'd use a proper IR writer
        // For now, just track that we would write
        written.push(irPath)

        auditTrail.push({
          action: 'update',
          target: irPath,
          source: agent,
          timestamp: new Date().toISOString(),
          details: `Updated IR with ${agentRules.length} rules from agent`,
        })
      }

      return {
        success: true,
        conflicts: conflictResult.conflicts,
        written,
        warnings,
        auditTrail,
      }
    } catch (err) {
      return {
        success: false,
        written: [],
        warnings: [err instanceof Error ? err.message : String(err)],
        auditTrail,
      }
    }
  }

  /**
   * Load agent rules (mock implementation for Step 14)
   * In Step 17, this will use real parsers
   */
  private async loadAgentRules(
    agent: string,
    options: SyncOptions
  ): Promise<AlignRule[]> {
    // Import from agent-specific format using parsers
    const { importFromAgent, canImportFromAgent } = await import('./import.js')
    
    if (!canImportFromAgent(agent)) {
      throw new Error(`Agent ${agent} does not support import`)
    }
    
    return await importFromAgent(agent, process.cwd())
  }

  /**
   * Resolve conflicts using interactive prompts or default strategy
   */
  private async resolveConflicts(
    conflicts: Conflict[],
    options: SyncOptions
  ): Promise<Map<string, import('./conflict-detector.js').ConflictResolution>> {
    const resolutions = new Map<string, import('./conflict-detector.js').ConflictResolution>()

    // Import ConflictResolutionStrategy dynamically to avoid circular dependency
    const { ConflictResolutionStrategy } = await import('./conflict-detector.js')
    const { promptForConflicts, isInteractive } = await import('./conflict-prompt.js')

    // Determine if interactive
    const interactive = options.interactive ?? isInteractive()

    // Determine default strategy
    const defaultStrategyStr = options.defaultResolutionStrategy || 'keep_ir'
    const defaultStrategy = defaultStrategyStr === 'accept_agent'
      ? ConflictResolutionStrategy.ACCEPT_AGENT
      : ConflictResolutionStrategy.KEEP_IR

    // Use conflict prompts to resolve
    try {
      const strategyMap = await promptForConflicts(conflicts, {
        interactive,
        defaultStrategy,
        batchMode: true,
      })

      // Convert strategy map to resolution map
      for (const conflict of conflicts) {
        const key = `${conflict.ruleId}:${conflict.field}`
        const strategy = strategyMap.get(key) || defaultStrategy
        const resolution = this.conflictDetector.resolveConflict(conflict, strategy)
        resolutions.set(key, resolution)
      }
    } catch (err) {
      // User aborted or error in prompts
      throw new Error(`Conflict resolution failed: ${err instanceof Error ? err.message : String(err)}`)
    }

    return resolutions
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

