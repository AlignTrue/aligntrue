/**
 * Firebender exporter
 * Exports AlignTrue rules to Firebender firebender.json format
 */

import { join } from 'path'
import type { ExporterPlugin, ScopedExportRequest, ExportOptions, ExportResult, ResolvedScope } from '../types.js'
import type { AlignRule } from '@aligntrue/schema'
import { canonicalizeJson, computeHash } from '@aligntrue/schema'
import { AtomicFileWriter } from '@aligntrue/file-utils'

interface ExporterState {
  allRules: Array<{ rule: AlignRule; scopePath: string }>
}

export class FirebenderExporter implements ExporterPlugin {
  name = 'firebender'
  version = '1.0.0'
  
  private state: ExporterState = {
    allRules: [],
  }

  async export(request: ScopedExportRequest, options: ExportOptions): Promise<ExportResult> {
    const { scope, rules } = request
    const { outputDir, dryRun = false } = options

    if (!rules || rules.length === 0) {
      return {
        success: true,
        filesWritten: [],
        contentHash: '',
      }
    }

    const scopePath = this.formatScopePath(scope)
    rules.forEach(rule => {
      this.state.allRules.push({ rule, scopePath })
    })

    const outputPath = join(outputDir, 'firebender.json')
    const content = this.generateFirebenderJsonContent()
    
    const allRulesIR = this.state.allRules.map(({ rule }) => rule)
    const irContent = JSON.stringify({ rules: allRulesIR })
    const contentHash = computeHash(canonicalizeJson(irContent))
    
    const fidelityNotes = this.computeFidelityNotes(allRulesIR)
    
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

  resetState(): void {
    this.state = {
      allRules: [],
    }
  }

  private formatScopePath(scope: ResolvedScope): string {
    if (scope.isDefault || scope.path === '.' || scope.path === '') {
      return 'all files'
    }
    return scope.path
  }

  private generateFirebenderJsonContent(): string {
    const rules = this.state.allRules.map(({ rule, scopePath }) => ({
      id: rule.id,
      severity: rule.severity,
      scope: scopePath,
      guidance: rule.guidance || '',
      applies_to: rule.applies_to || [],
    }))

    const allRulesIR = this.state.allRules.map(({ rule }) => rule)
    const irContent = JSON.stringify({ rules: allRulesIR })
    const contentHash = computeHash(canonicalizeJson(irContent))
    const fidelityNotes = this.computeFidelityNotes(allRulesIR)

    const output = {
      version: 'v1',
      generated_by: 'AlignTrue',
      content_hash: contentHash,
      rules,
      fidelity_notes: fidelityNotes.length > 0 ? fidelityNotes : undefined,
    }

    return JSON.stringify(output, null, 2)
  }

  private computeFidelityNotes(rules: AlignRule[]): string[] {
    const notes: string[] = []
    const unmappedFields = new Set<string>()
    const vendorFields = new Set<string>()

    rules.forEach(rule => {
      if (rule.check) {
        unmappedFields.add('check')
      }
      if (rule.autofix) {
        unmappedFields.add('autofix')
      }
      if (rule.vendor) {
        Object.keys(rule.vendor).forEach(agent => {
          if (agent !== '_meta') {
            vendorFields.add(agent)
          }
        })
      }
    })

    if (unmappedFields.has('check')) {
      notes.push('Machine-checkable rules (check) not represented in firebender.json format')
    }
    if (unmappedFields.has('autofix')) {
      notes.push('Autofix hints not represented in firebender.json format')
    }
    if (vendorFields.size > 0) {
      const agents = Array.from(vendorFields).sort().join(', ')
      notes.push(`Vendor metadata for agents preserved but not extracted: ${agents}`)
    }

    return notes
  }
}

export default FirebenderExporter

