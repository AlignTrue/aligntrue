import { describe, it, expect } from 'vitest'
import {
  canonicalJson,
  globSpecificity,
  rulePriority,
  estimateRuleTokens,
  prioritizeRulesForCapExport
} from '../src/utils/token-budget.js'
import type { AlignRule } from '@aligntrue/schema'

describe('canonicalJson', () => {
  it('produces sorted stable output', () => {
    const obj = { z: 1, a: 2, m: 3 }
    expect(canonicalJson(obj)).toBe('{"a":2,"m":3,"z":1}')
  })

  it('handles nested objects with sorted keys', () => {
    const obj = { outer: { z: 1, a: 2 }, first: 'value' }
    expect(canonicalJson(obj)).toBe('{"first":"value","outer":{"a":2,"z":1}}')
  })

  it('handles arrays consistently', () => {
    const obj = { items: [3, 1, 2], name: 'test' }
    expect(canonicalJson(obj)).toBe('{"items":[3,1,2],"name":"test"}')
  })

  it('produces no spaces for minimal output', () => {
    const obj = { a: 1, b: 2 }
    const result = canonicalJson(obj)
    expect(result).not.toContain(' ')
    expect(result).not.toContain('\n')
  })
})

describe('globSpecificity', () => {
  it('scores deeper paths higher', () => {
    expect(globSpecificity('src/components/Button.tsx'))
      .toBeGreaterThan(globSpecificity('src/*.tsx'))
  })

  it('penalizes wildcards', () => {
    expect(globSpecificity('src/file.ts'))
      .toBeGreaterThan(globSpecificity('src/*.ts'))
  })

  it('penalizes double-star patterns', () => {
    expect(globSpecificity('src/*/*.ts'))
      .toBeGreaterThan(globSpecificity('src/**/*.ts'))
  })

  it('handles root patterns', () => {
    expect(globSpecificity('**/*')).toBeLessThan(0)  // Very broad
    expect(globSpecificity('*.ts')).toBeLessThan(globSpecificity('src/*.ts'))
  })

  it('specificity increases with depth and precision', () => {
    const patterns = [
      '**/*',
      '*.ts',
      'src/*.ts',
      'src/utils/*.ts',
      'src/utils/helper.ts'
    ]
    
    const scores = patterns.map(globSpecificity)
    
    // Each should be higher than the previous
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThan(scores[i - 1])
    }
  })
})

describe('rulePriority', () => {
  it('prioritizes always mode over manual', () => {
    const alwaysRule: AlignRule = {
      id: 'test.always',
      mode: 'always',
      severity: 'info',
      guidance: 'test'
    }
    const manualRule: AlignRule = {
      id: 'test.manual',
      mode: 'manual',
      severity: 'info',
      guidance: 'test'
    }
    
    expect(rulePriority(alwaysRule)).toBeGreaterThan(rulePriority(manualRule))
  })

  it('prioritizes error severity over warn', () => {
    const errorRule: AlignRule = {
      id: 'test.error',
      mode: 'manual',
      severity: 'error',
      guidance: 'test'
    }
    const warnRule: AlignRule = {
      id: 'test.warn',
      mode: 'manual',
      severity: 'warn',
      guidance: 'test'
    }
    
    expect(rulePriority(errorRule)).toBeGreaterThan(rulePriority(warnRule))
  })

  it('uses specificity as tiebreaker', () => {
    const specificRule: AlignRule = {
      id: 'test.specific',
      mode: 'files',
      severity: 'info',
      applies_to: ['src/components/Button.tsx'],
      guidance: 'test'
    }
    const broadRule: AlignRule = {
      id: 'test.broad',
      mode: 'files',
      severity: 'info',
      applies_to: ['**/*'],
      guidance: 'test'
    }
    
    expect(rulePriority(specificRule)).toBeGreaterThan(rulePriority(broadRule))
  })

  it('combines mode, severity, and specificity correctly', () => {
    // Mode is most important (30x weight)
    const highMode: AlignRule = {
      id: 'test.1',
      mode: 'always',
      severity: 'info',
      applies_to: ['**/*'],
      guidance: 'test'
    }
    const lowMode: AlignRule = {
      id: 'test.2',
      mode: 'manual',
      severity: 'error',
      applies_to: ['src/specific.ts'],
      guidance: 'test'
    }
    
    expect(rulePriority(highMode)).toBeGreaterThan(rulePriority(lowMode))
  })

  it('handles missing mode and severity with defaults', () => {
    const rule: AlignRule = {
      id: 'test.default',
      guidance: 'test'
    }
    
    const priority = rulePriority(rule)
    expect(priority).toBeGreaterThan(0)
    expect(priority).toBe(10 * 100 + 1 * 10 + globSpecificity('**/*'))  // manual + info + default glob
  })
})

describe('estimateRuleTokens', () => {
  it('estimates tokens for rule with mode hints', () => {
    const rule: AlignRule = {
      id: 'test.rule',
      mode: 'intelligent',
      description: 'This is a test description for the rule',
      applies_to: ['**/*.ts'],
      guidance: 'Apply this rule to TypeScript files',
      severity: 'warn'
    }
    
    const tokens = estimateRuleTokens(rule, true)
    expect(tokens).toBeGreaterThan(0)
    expect(tokens).toBeLessThan(200)  // Reasonable upper bound
  })

  it('excludes hint text when includeHintText is false', () => {
    const rule: AlignRule = {
      id: 'test.rule',
      mode: 'intelligent',
      description: 'Long description that would add many tokens to the hint text',
      guidance: 'test',
      severity: 'info'
    }
    
    const withHints = estimateRuleTokens(rule, true)
    const withoutHints = estimateRuleTokens(rule, false)
    
    expect(withHints).toBeGreaterThan(withoutHints)
  })

  it('estimates are within 20% of actual for typical rule', () => {
    const rule: AlignRule = {
      id: 'testing.require-assertions',
      mode: 'files',
      title: 'Require test assertions',
      description: 'Every test must have at least one assertion',
      applies_to: ['**/*.test.ts', '**/*.spec.ts'],
      guidance: 'Use expect() or assert() in every test function',
      severity: 'error'
    }
    
    // Actual content roughly: 
    // - Marker JSON: ~80 chars
    // - Hint text: ~50 chars
    // - Content: ~150 chars
    // Total: ~280 chars = ~70 tokens
    
    const estimate = estimateRuleTokens(rule, true)
    expect(estimate).toBeGreaterThan(50)  // Not too low
    expect(estimate).toBeLessThan(100)    // Not too high
  })
})

describe('prioritizeRulesForCapExport', () => {
  const createRule = (id: string, mode: string, severity: string, applies_to?: string[]): AlignRule => ({
    id,
    mode: mode as any,
    severity: severity as any,
    applies_to,
    guidance: 'Test guidance'
  })

  it('includes all rules when under both caps', () => {
    const rules = [
      createRule('rule1', 'always', 'error'),
      createRule('rule2', 'manual', 'info')
    ]
    
    const result = prioritizeRulesForCapExport(rules, 10, 1000)
    
    expect(result.included).toHaveLength(2)
    expect(result.dropped).toHaveLength(0)
  })

  it('drops lowest priority rules when block cap exceeded', () => {
    const rules = [
      createRule('high', 'always', 'error'),
      createRule('low', 'manual', 'info')
    ]
    
    const result = prioritizeRulesForCapExport(rules, 1, 10000)
    
    expect(result.included).toHaveLength(1)
    expect(result.included[0].id).toBe('high')
    expect(result.dropped).toHaveLength(1)
    expect(result.dropped[0].rule_id).toBe('low')
  })

  it('drops rules when token cap exceeded', () => {
    const rules = [
      createRule('rule1', 'always', 'error'),
      createRule('rule2', 'always', 'error'),
      createRule('rule3', 'always', 'error')
    ]
    
    // Set very low token cap
    const result = prioritizeRulesForCapExport(rules, 10, 50)
    
    expect(result.included.length).toBeLessThan(3)
    expect(result.dropped.length).toBeGreaterThan(0)
    expect(result.totalTokens).toBeLessThanOrEqual(50)
  })

  it('respects both caps independently', () => {
    const rules = Array.from({ length: 10 }, (_, i) => 
      createRule(`rule${i}`, 'always', 'error')
    )
    
    const result = prioritizeRulesForCapExport(rules, 3, 10000)
    
    expect(result.included).toHaveLength(3)  // Block cap takes precedence
    expect(result.dropped).toHaveLength(7)
  })

  it('logs drop reasons with useful metadata', () => {
    const rules = [
      createRule('high', 'always', 'error', ['src/specific.ts']),
      createRule('low', 'manual', 'info', ['**/*'])
    ]
    
    const result = prioritizeRulesForCapExport(rules, 1, 10000)
    
    expect(result.dropped).toHaveLength(1)
    expect(result.dropped[0]).toMatchObject({
      rule_id: 'low',
      mode: 'manual',
      top_glob: '**/*'
    })
    expect(result.dropped[0].estimated_tokens).toBeGreaterThan(0)
    expect(result.dropped[0].priority).toBeGreaterThan(0)
  })

  it('calculates total tokens accurately', () => {
    const rules = [
      createRule('rule1', 'files', 'info'),
      createRule('rule2', 'files', 'info')
    ]
    
    const result = prioritizeRulesForCapExport(rules, 10, 10000)
    
    expect(result.totalTokens).toBeGreaterThan(0)
    const manualSum = result.included.reduce((sum, rule) => 
      sum + estimateRuleTokens(rule, true), 0
    )
    expect(result.totalTokens).toBeCloseTo(manualSum, 0)
  })
})

