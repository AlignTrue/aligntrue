/**
 * Cursor .mdc exporter
 * Exports AlignTrue rules to Cursor's .cursor/rules/*.mdc format
 */

import { join } from 'path'
import type { ExporterPlugin, ScopedExportRequest, ExportOptions, ExportResult, ResolvedScope } from '@aligntrue/plugin-contracts'
import type { AlignRule } from '@aligntrue/schema'
import { canonicalizeJson, computeHash } from '@aligntrue/schema'
import { AtomicFileWriter } from '@aligntrue/file-utils'

export class CursorExporter implements ExporterPlugin {
  name = 'cursor'
  version = '1.0.0'
  
  async export(request: ScopedExportRequest, options: ExportOptions): Promise<ExportResult> {
    const { scope, rules } = request
    const { outputDir, dryRun = false } = options

    // Validate inputs
    if (!rules || rules.length === 0) {
      throw new Error('CursorExporter requires at least one rule to export')
    }

    // Compute scope-specific filename
    const filename = this.getScopeFilename(scope)
    const outputPath = join(outputDir, '.cursor', 'rules', filename)

    // Generate .mdc content
    const content = this.generateMdcContent(scope, rules)

    // Compute content hash from canonical IR
    const irContent = JSON.stringify({ scope, rules })
    const contentHash = computeHash(canonicalizeJson(irContent))

    // Compute fidelity notes
    const fidelityNotes = this.computeFidelityNotes(rules)

    // Write file atomically if not dry-run
    if (!dryRun) {
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
   * Generate scope-specific filename
   * Default scope (path: ".") → "aligntrue.mdc"
   * Named scope → "{normalized-path}.mdc" (slashes → hyphens)
   */
  private getScopeFilename(scope: ResolvedScope): string {
    if (scope.isDefault || scope.path === '.' || scope.path === '') {
      return 'aligntrue.mdc'
    }

    // Normalize path: replace slashes with hyphens
    const normalized = scope.normalizedPath.replace(/\//g, '-')
    return `${normalized}.mdc`
  }

  /**
   * Generate complete .mdc file content
   */
  private generateMdcContent(scope: ResolvedScope, rules: AlignRule[]): string {
    const frontmatter = this.generateFrontmatter(scope, rules)
    const rulesSections = this.generateRulesSections(rules)
    const irContent = JSON.stringify({ scope, rules })
    const contentHash = computeHash(canonicalizeJson(irContent))
    const fidelityNotes = this.computeFidelityNotes(rules)
    const footer = generateMdcFooter(contentHash, fidelityNotes)

    return `${frontmatter}\n${rulesSections}\n${footer}`
  }

  /**
   * Generate YAML frontmatter from scope and rules
   */
  private generateFrontmatter(scope: ResolvedScope, rules: AlignRule[]): string {
    const lines: string[] = ['---']

    // Add description
    const scopeDesc = scope.isDefault 
      ? 'AlignTrue rules (default scope)' 
      : `AlignTrue rules for ${scope.path}`
    lines.push(`description: ${scopeDesc}`)

    // Add globs if present
    if (scope.include && scope.include.length > 0) {
      lines.push('globs:')
      scope.include.forEach(pattern => {
        lines.push(`  - "${pattern}"`)
      })
    }

    // Add alwaysApply for default scope
    if (scope.isDefault) {
      lines.push('alwaysApply: true')
    }

    // Extract vendor.cursor metadata from all rules
    const cursorMetadata: Record<string, any> = {}
    rules.forEach(rule => {
      const vendorCursor = this.extractVendorCursor(rule)
      if (Object.keys(vendorCursor).length > 0) {
        cursorMetadata[rule.id] = vendorCursor
      }
    })

    // Add cursor metadata if present
    if (Object.keys(cursorMetadata).length > 0) {
      lines.push('cursor:')
      Object.entries(cursorMetadata).forEach(([ruleId, metadata]) => {
        lines.push(`  ${ruleId}:`)
        Object.entries(metadata).forEach(([key, value]) => {
          if (typeof value === 'string') {
            lines.push(`    ${key}: "${value}"`)
          } else {
            lines.push(`    ${key}: ${JSON.stringify(value)}`)
          }
        })
      })
    }

    lines.push('---')
    return lines.join('\n')
  }

  /**
   * Generate rule sections with markdown headers
   */
  private generateRulesSections(rules: AlignRule[]): string {
    const sections: string[] = []

    rules.forEach(rule => {
      const lines: string[] = []
      
      // Rule header
      lines.push(`## Rule: ${rule.id}`)
      lines.push('')

      // Severity
      lines.push(`**Severity:** ${rule.severity}`)
      lines.push('')

      // Applies to patterns
      if (rule.applies_to && rule.applies_to.length > 0) {
        lines.push(`**Applies to:**`)
        rule.applies_to.forEach(pattern => {
          lines.push(`- \`${pattern}\``)
        })
        lines.push('')
      }

      // Guidance
      if (rule.guidance) {
        lines.push(rule.guidance.trim())
        lines.push('')
      }

      sections.push(lines.join('\n'))
    })

    return sections.join('\n')
  }

  /**
   * Extract vendor.cursor metadata from a rule
   */
  private extractVendorCursor(rule: AlignRule): Record<string, any> {
    if (!rule.vendor || !rule.vendor['cursor']) {
      return {}
    }

    const cursor = rule.vendor['cursor'] as Record<string, any>
    const metadata: Record<string, any> = {}

    // Extract all cursor-specific fields
    Object.entries(cursor).forEach(([key, value]) => {
      // Skip volatile metadata marker
      if (key === '_meta') return
      metadata[key] = value
    })

    return metadata
  }

  /**
   * Compute fidelity notes for unmapped fields
   */
  private computeFidelityNotes(rules: AlignRule[]): string[] {
    const notes: string[] = []
    const unmappedFields = new Set<string>()
    const crossAgentVendors = new Set<string>()

    rules.forEach(rule => {
      // Check for unmapped fields
      if (rule.check) {
        unmappedFields.add('check')
      }
      if (rule.autofix) {
        unmappedFields.add('autofix')
      }

      // Check for cross-agent vendor fields
      if (rule.vendor) {
        Object.keys(rule.vendor).forEach(agent => {
          if (agent !== 'cursor' && agent !== '_meta') {
            crossAgentVendors.add(agent)
          }
        })
      }
    })

    // Add notes for unmapped fields
    if (unmappedFields.has('check')) {
      notes.push('Machine-checkable rules (check) not represented in .mdc format')
    }
    if (unmappedFields.has('autofix')) {
      notes.push('Autofix hints not represented in .mdc format')
    }

    // Add notes for cross-agent vendor fields
    if (crossAgentVendors.size > 0) {
      const agents = Array.from(crossAgentVendors).sort().join(', ')
      notes.push(`Vendor metadata for other agents preserved but not active: ${agents}`)
    }

    // Add general scope limitation note
    notes.push('applies_to patterns preserved in metadata but not enforced by Cursor')

    return notes
  }
}

/**
 * Generate .mdc file footer with content hash and fidelity notes
 * @param contentHash - SHA-256 hash of the canonical IR content
 * @param fidelityNotes - Array of semantic mapping limitations
 */
export function generateMdcFooter(contentHash: string, fidelityNotes: string[]): string {
  const lines: string[] = ['---', '']
  
  lines.push('**Generated by AlignTrue**')
  lines.push(`Content Hash: ${contentHash}`)
  
  if (fidelityNotes.length > 0) {
    lines.push('')
    lines.push('**Fidelity Notes:**')
    fidelityNotes.forEach(note => {
      lines.push(`- ${note}`)
    })
  }

  lines.push('')
  return lines.join('\n')
}
