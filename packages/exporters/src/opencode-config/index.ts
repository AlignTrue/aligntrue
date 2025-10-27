/**
 * opencode Config exporter
 * Exports AlignTrue rules to opencode.json format
 */

import { join } from 'path'
import type { ExporterPlugin, ScopedExportRequest, ExportOptions, ExportResult } from '../types.js'
import type { AlignRule } from '@aligntrue/schema'
import { canonicalizeJson, computeHash } from '@aligntrue/schema'
import { AtomicFileWriter } from '@aligntrue/core'

interface ExporterState {
  allRules: Array<{ rule: AlignRule; scopePath: string }>
}

export class OpencodeConfigExporter implements ExporterPlugin {
  name = 'opencode-config'
  version = '1.0.0'
  
  private state: ExporterState = {
    allRules: [],
  }

  async export(request: ScopedExportRequest, options: ExportOptions): Promise<ExportResult> {
    const { scope, rules } = request
    const { outputDir, dryRun = false } = options

    if (!rules || rules.length === 0) {
      return { success: true, filesWritten: [], contentHash: '' }
    }

    const scopePath = (scope.isDefault || scope.path === '.' || scope.path === '') ? 'all files' : scope.path
    rules.forEach(rule => this.state.allRules.push({ rule, scopePath }))

    const outputPath = join(outputDir, 'opencode.json')
    const config = {
      version: 'v1',
      generated_by: 'AlignTrue',
      content_hash: computeHash(canonicalizeJson(JSON.stringify({ rules: this.state.allRules.map(({ rule }) => rule) }))),
      rules: this.state.allRules.map(({ rule, scopePath: sp }) => ({
        id: rule.id,
        severity: rule.severity,
        guidance: rule.guidance || '',
        scope: sp,
        applies_to: rule.applies_to || [],
      })),
    }

    const content = JSON.stringify(config, null, 2) + '\n'
    
    if (!dryRun) {
      new AtomicFileWriter().write(outputPath, content)
    }

    return { success: true, filesWritten: dryRun ? [] : [outputPath], contentHash: config.content_hash }
  }

  resetState(): void {
    this.state = { allRules: [] }
  }
}

export default OpencodeConfigExporter

