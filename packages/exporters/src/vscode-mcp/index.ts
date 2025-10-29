/**
 * VS Code MCP config exporter
 * Exports AlignTrue rules to .vscode/mcp.json format
 * 
 * Format: Single root-level .vscode/mcp.json file with v1 JSON structure
 * Target: VS Code with Model Context Protocol (MCP) support
 */

import { dirname } from 'path'
import { mkdirSync } from 'fs'
import type { ExporterPlugin, ScopedExportRequest, ExportOptions, ExportResult, ResolvedScope } from '@aligntrue/plugin-contracts'
import type { AlignRule } from '@aligntrue/schema'
import { canonicalizeJson, computeHash } from '@aligntrue/schema'
import { AtomicFileWriter } from '@aligntrue/file-utils'
import { getAlignTruePaths } from '@aligntrue/core'

/**
 * State for collecting all scopes before generating single merged file
 */
interface ExporterState {
  allRules: Array<{ rule: AlignRule; scopePath: string }>
  seenScopes: Set<string>
}

/**
 * MCP configuration JSON structure
 */
interface McpConfig {
  version: string
  generated_by: string
  content_hash: string
  rules: McpRule[]
  fidelity_notes?: string[]
}

/**
 * MCP rule with vendor.vscode fields flattened to top level
 */
interface McpRule {
  id: string
  severity: 'error' | 'warn' | 'info'
  guidance: string
  scope?: string
  applies_to?: string[]
  [key: string]: any // Additional vendor.vscode fields
}

export class VsCodeMcpExporter implements ExporterPlugin {
  name = 'vscode-mcp'
  version = '1.0.0'
  
  // State for accumulating rules across multiple scope calls
  private state: ExporterState = {
    allRules: [],
    seenScopes: new Set(),
  }

  async export(request: ScopedExportRequest, options: ExportOptions): Promise<ExportResult> {
    const { scope, rules } = request
    const { outputDir, dryRun = false } = options

    // Validate inputs
    if (!rules || rules.length === 0) {
      // Empty scope is allowed, just skip accumulation
      return {
        success: true,
        filesWritten: [],
        contentHash: '',
      }
    }

    // Accumulate rules with their scope information
    const scopePath = this.formatScopePath(scope)
    rules.forEach(rule => {
      this.state.allRules.push({ rule, scopePath })
    })
    this.state.seenScopes.add(scopePath)

    // Generate .vscode/mcp.json with all accumulated rules
    const paths = getAlignTruePaths(outputDir)
    const outputPath = paths.vscodeMcp()
    
    // Generate MCP config JSON
    const mcpConfig = this.generateMcpConfig()
    const content = JSON.stringify(mcpConfig, null, 2) + '\n'
    
    // Compute content hash from canonical IR of all rules
    const allRulesIR = this.state.allRules.map(({ rule }) => rule)
    const irContent = JSON.stringify({ rules: allRulesIR })
    const contentHash = computeHash(canonicalizeJson(irContent))
    
    // Compute fidelity notes
    const fidelityNotes = this.computeFidelityNotes(allRulesIR)
    
    // Write file atomically if not dry-run
    if (!dryRun) {
      // Ensure .vscode directory exists
      const vscodeDirPath = dirname(outputPath)
      mkdirSync(vscodeDirPath, { recursive: true })
      
      const writer = new AtomicFileWriter()
      writer.write(outputPath, content)
    }

    const result: ExportResult = {
      success: true,
      filesWritten: dryRun ? [] : [outputPath],
      contentHash,
    }

    if (fidelityNotes.length > 0) {
      result.fidelityNotes = fidelityNotes
    }

    return result
  }

  /**
   * Format scope path for display in MCP config
   * Default scope (path: ".") → "all files"
   * Named scope → actual path
   */
  private formatScopePath(scope: ResolvedScope): string {
    if (scope.isDefault || scope.path === '.' || scope.path === '') {
      return 'all files'
    }
    return scope.path
  }

  /**
   * Generate complete MCP configuration object
   */
  private generateMcpConfig(): McpConfig {
    const allRulesIR = this.state.allRules.map(({ rule }) => rule)
    const irContent = JSON.stringify({ rules: allRulesIR })
    const contentHash = computeHash(canonicalizeJson(irContent))
    const fidelityNotes = this.computeFidelityNotes(allRulesIR)

    const mcpRules = this.state.allRules.map(({ rule, scopePath }) => 
      this.mapRuleToMcpFormat(rule, scopePath)
    )

    const config: McpConfig = {
      version: 'v1',
      generated_by: 'AlignTrue',
      content_hash: contentHash,
      rules: mcpRules,
    }

    if (fidelityNotes.length > 0) {
      config.fidelity_notes = fidelityNotes
    }

    return config
  }

  /**
   * Map AlignRule to MCP format with vendor.vscode extraction
   */
  private mapRuleToMcpFormat(rule: AlignRule, scopePath: string): McpRule {
    const mcpRule: McpRule = {
      id: rule.id,
      severity: rule.severity,
      guidance: rule.guidance || '',
    }

    // Add scope if not default
    if (scopePath !== 'all files') {
      mcpRule.scope = scopePath
    }

    // Add applies_to patterns if present
    if (rule.applies_to && rule.applies_to.length > 0) {
      mcpRule.applies_to = rule.applies_to
    }

    // Extract vendor.vscode fields to top level
    const vscodeFields = this.extractVendorVscode(rule)
    Object.assign(mcpRule, vscodeFields)

    return mcpRule
  }

  /**
   * Extract and flatten vendor.vscode fields
   * Returns object with vendor.vscode fields at top level
   */
  private extractVendorVscode(rule: AlignRule): Record<string, any> {
    if (!rule.vendor || !rule.vendor['vscode']) {
      return {}
    }

    const vscodeFields: Record<string, any> = {}
    const vscodeVendor = rule.vendor['vscode']

    // Flatten all vendor.vscode fields to top level
    for (const [key, value] of Object.entries(vscodeVendor)) {
      vscodeFields[key] = value
    }

    return vscodeFields
  }

  /**
   * Compute fidelity notes for unmapped fields
   * MCP config extracts vendor.vscode - note what's not represented
   */
  private computeFidelityNotes(rules: AlignRule[]): string[] {
    const notes: string[] = []
    const unmappedFields = new Set<string>()
    const vendorAgents = new Set<string>()

    rules.forEach(rule => {
      // Check for unmapped fields
      if (rule.check) {
        unmappedFields.add('check')
      }
      if (rule.autofix) {
        unmappedFields.add('autofix')
      }

      // Check for vendor-specific metadata (excluding vscode since we extract it)
      if (rule.vendor) {
        Object.keys(rule.vendor).forEach(agent => {
          if (agent !== '_meta' && agent !== 'vscode') {
            vendorAgents.add(agent)
          }
        })
      }
    })

    // Add notes for unmapped fields
    if (unmappedFields.has('check')) {
      notes.push('Machine-checkable rules (check) not represented in MCP config format')
    }
    if (unmappedFields.has('autofix')) {
      notes.push('Autofix hints not represented in MCP config format')
    }

    // Add notes for non-vscode vendor metadata
    if (vendorAgents.size > 0) {
      const agents = Array.from(vendorAgents).sort().join(', ')
      notes.push(`Vendor-specific metadata for other agents not extracted to MCP config: ${agents}`)
    }

    return notes
  }

  /**
   * Reset internal state (useful for testing)
   */
  resetState(): void {
    this.state = {
      allRules: [],
      seenScopes: new Set(),
    }
  }
}
