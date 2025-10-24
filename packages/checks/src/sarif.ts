/**
 * SARIF 2.1.0 emitter
 * 
 * Converts check findings to SARIF format for CI and editor integration.
 * Reference: https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html
 */

import type { CheckResult } from './types.js'

/**
 * SARIF 2.1.0 log format
 */
export interface SarifLog {
  version: '2.1.0'
  $schema: string
  runs: SarifRun[]
}

export interface SarifRun {
  tool: SarifTool
  results: SarifResult[]
}

export interface SarifTool {
  driver: SarifToolComponent
}

export interface SarifToolComponent {
  name: string
  version: string
  informationUri?: string
  rules?: SarifRule[]
}

export interface SarifRule {
  id: string
  shortDescription?: {
    text: string
  }
  fullDescription?: {
    text: string
  }
  helpUri?: string
}

export interface SarifResult {
  ruleId: string
  level: 'error' | 'warning' | 'note'
  message: {
    text: string
  }
  locations?: SarifLocation[]
}

export interface SarifLocation {
  physicalLocation: {
    artifactLocation: {
      uri: string
      uriBaseId?: string
    }
    region?: {
      startLine?: number
      startColumn?: number
      endLine?: number
      endColumn?: number
    }
  }
}

/**
 * Convert check results to SARIF 2.1.0 format
 */
export function emitSarif(results: CheckResult[], toolVersion: string = '0.1.0'): SarifLog {
  // Collect all unique rules
  const rulesMap = new Map<string, SarifRule>()
  const sarifResults: SarifResult[] = []

  for (const result of results) {
    const ruleId = `${result.packId}/${result.rule.id}`

    // Add rule definition if not already present
    if (!rulesMap.has(ruleId)) {
      rulesMap.set(ruleId, {
        id: ruleId,
        shortDescription: {
          text: result.rule.check.evidence,
        },
      })
    }

    // Add findings as SARIF results
    for (const finding of result.findings) {
      sarifResults.push({
        ruleId,
        level: severityToLevel(finding.severity),
        message: {
          text: finding.message,
        },
        locations: [
          {
            physicalLocation: {
              artifactLocation: {
                uri: finding.location.path,
              },
              ...(finding.location.line
                ? {
                    region: {
                      startLine: finding.location.line,
                      ...(finding.location.column ? { startColumn: finding.location.column } : {}),
                      ...(finding.location.endLine ? { endLine: finding.location.endLine } : {}),
                      ...(finding.location.endColumn ? { endColumn: finding.location.endColumn } : {}),
                    },
                  }
                : {}),
            },
          },
        ],
      })
    }
  }

  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [
      {
        tool: {
          driver: {
            name: 'AlignTrue Checks',
            version: toolVersion,
            informationUri: 'https://aligntrue.com',
            rules: Array.from(rulesMap.values()),
          },
        },
        results: sarifResults,
      },
    ],
  }
}

/**
 * Map severity to SARIF level
 */
function severityToLevel(severity: 'MUST' | 'SHOULD' | 'MAY'): 'error' | 'warning' | 'note' {
  switch (severity) {
    case 'MUST':
      return 'error'
    case 'SHOULD':
      return 'warning'
    case 'MAY':
      return 'note'
  }
}

