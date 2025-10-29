/**
 * Check command - Validate rules and configuration
 * Non-interactive validation for CI/CD pipelines and pre-commit hooks
 */

import { existsSync } from 'fs'
import { resolve } from 'path'
import { type AlignTrueConfig } from '@aligntrue/core'
import { validateAlign } from '@aligntrue/schema'
import { readFileSync } from 'fs'
import { 
  readLockfile, 
  validateLockfile, 
  type ValidationResult as LockfileValidationResult 
} from '@aligntrue/core'
import { parseYamlToJson } from '@aligntrue/schema'
import { tryLoadConfig } from '../utils/config-loader.js'
import { exitWithError } from '../utils/error-formatter.js'
import { CommonErrors as Errors } from '../utils/common-errors.js'
import { parseCommonArgs, showStandardHelp, type ArgDefinition } from '../utils/command-utilities.js'

/**
 * Argument definitions for check command
 */
const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: '--ci',
    hasValue: false,
    description: 'CI mode (strict validation, non-zero exit on errors)',
  },
  {
    flag: '--config',
    alias: '-c',
    hasValue: true,
    description: 'Custom config file path (default: .aligntrue/config.yaml)',
  },
  {
    flag: '--help',
    alias: '-h',
    hasValue: false,
    description: 'Show this help message',
  },
]

/**
 * Check command implementation
 */
export async function check(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS)
  
  // Show help if requested
  if (parsed.help) {
    showStandardHelp({
      name: 'check',
      description: 'Validate rules and configuration (non-interactive)',
      usage: 'aligntrue check [options]',
      args: ARG_DEFINITIONS,
      examples: [
        'aligntrue check --ci',
        'aligntrue check --ci --config .aligntrue/config.yaml',
      ],
      notes: [
        'Exit Codes:',
        '  0  All validations passed',
        '  1  Validation failed (schema or lockfile errors)',
        '  2  System error (missing files, invalid config)',
      ],
    })
    process.exit(0)
  }

  // Extract flags
  const ci = parsed.flags['ci'] as boolean | undefined || false
  const configPath = (parsed.flags['config'] as string | undefined) || '.aligntrue/config.yaml'

  // CI mode is required for now (other modes deferred)
  if (!ci) {
    console.error('Error: --ci flag is required\n')
    console.error('Run: aligntrue check --ci\n')
    showStandardHelp({
      name: 'check',
      description: 'Validate rules and configuration (non-interactive)',
      usage: 'aligntrue check [options]',
      args: ARG_DEFINITIONS,
      examples: [
        'aligntrue check --ci',
        'aligntrue check --ci --config .aligntrue/config.yaml',
      ],
      notes: [
        'Exit Codes:',
        '  0  All validations passed',
        '  1  Validation failed (schema or lockfile errors)',
        '  2  System error (missing files, invalid config)',
      ],
    })
    process.exit(2)
  }

  try {
    // Step 1: Load config (with standardized error handling)
    const config: AlignTrueConfig = await tryLoadConfig(configPath)

    // Step 2: Validate IR schema
    const rulesPath = config.sources?.[0]?.path || '.aligntrue/rules.md'
    const resolvedRulesPath = resolve(rulesPath)
    
    if (!existsSync(resolvedRulesPath)) {
      exitWithError({
        ...Errors.rulesNotFound(rulesPath),
        details: [`Expected: ${rulesPath}`, `Resolved: ${resolvedRulesPath}`]
      }, 2)
    }

    // Load and parse rules file
    let rulesContent: string
    try {
      rulesContent = readFileSync(resolvedRulesPath, 'utf8')
    } catch (err) {
      exitWithError(Errors.fileWriteFailed(
        resolvedRulesPath,
        err instanceof Error ? err.message : String(err)
      ), 2)
    }

    // Parse YAML to JSON for validation
    let alignData: unknown
    try {
      alignData = parseYamlToJson(rulesContent)
    } catch (err) {
      console.error('✗ Invalid YAML in rules file\n')
      console.error(`  ${err instanceof Error ? err.message : String(err)}\n`)
      console.error(`  Check for syntax errors in ${rulesPath}\n`)
      process.exit(1)
    }

    // Validate against schema
    const schemaResult = validateAlign(alignData as string)
    if (!schemaResult.schema.valid) {
      const details = (schemaResult.schema.errors || []).map(err => 
        `${err.path}: ${err.message}`
      )
      exitWithError({
        ...Errors.validationFailed(details),
        message: `Errors in ${rulesPath}`,
        hint: "Fix the errors above and run 'aligntrue check --ci' again"
      }, 1)
    }

    // Step 2.5: Validate rule IDs
    const { validateRuleId } = await import('@aligntrue/schema')
    const alignPack = alignData as any
    
    for (const rule of alignPack.rules || []) {
      const validation = validateRuleId(rule.id)
      if (!validation.valid) {
        console.error('✗ Invalid rule ID\n')
        console.error(`  Rule: ${rule.id}`)
        console.error(`  Error: ${validation.error}`)
        if (validation.suggestion) {
          console.error(`  ${validation.suggestion}`)
        }
        console.error(`\n  Fix the rule ID and run 'aligntrue check --ci' again.\n`)
        process.exit(1)
      }
    }

    // Step 3: Validate lockfile if team mode + lockfile enabled
    let lockfileValid = true
    const shouldCheckLockfile = config.mode === 'team' && config.modules?.lockfile === true
    
    if (shouldCheckLockfile) {
      const lockfilePath = resolve('.aligntrue.lock.json')
      
      // Check if lockfile exists
      if (!existsSync(lockfilePath)) {
        console.error('✗ Lockfile validation failed\n')
        console.error('  Lockfile not found (required in team mode)')
        console.error(`  Expected: ${lockfilePath}\n`)
        console.error(`  Run 'aligntrue sync' to generate the lockfile.\n`)
        process.exit(1)
      }

      // Load and validate lockfile
      try {
        const lockfile = readLockfile(lockfilePath)
        if (!lockfile) {
          console.error('✗ Lockfile validation failed\n')
          console.error('  Failed to read lockfile\n')
          process.exit(2)
        }
        const validation = validateLockfile(lockfile, alignData as any)
        
        if (!validation.valid) {
          lockfileValid = false
          console.error('✗ Lockfile drift detected\n')
          
          // Show mismatches
          if (validation.mismatches && validation.mismatches.length > 0) {
            console.error('  Hash mismatches:')
            for (const mismatch of validation.mismatches) {
              console.error(`    - ${mismatch.rule_id}`)
              console.error(`      Expected: ${mismatch.expected_hash}`)
              console.error(`      Actual:   ${mismatch.actual_hash}`)
            }
          }
          
          // Show new rules
          if (validation.newRules && validation.newRules.length > 0) {
            console.error(`\n  New rules not in lockfile: ${validation.newRules.join(', ')}`)
          }
          
          // Show deleted rules
          if (validation.deletedRules && validation.deletedRules.length > 0) {
            console.error(`\n  Rules in lockfile but not in IR: ${validation.deletedRules.join(', ')}`)
          }
          
          console.error(`\n  Run 'aligntrue sync' to update the lockfile.\n`)
          process.exit(1)
        }
      } catch (err) {
        console.error('✗ Lockfile validation failed\n')
        console.error(`  ${err instanceof Error ? err.message : String(err)}\n`)
        process.exit(2)
      }
    }

    // Step 4: All validations passed
    console.log('✓ Validation passed\n')
    console.log(`  Schema: ${rulesPath} is valid`)
    
    if (shouldCheckLockfile) {
      console.log('  Lockfile: .aligntrue.lock.json matches current rules')
    } else if (config.mode === 'solo') {
      console.log('  Lockfile: skipped (solo mode)')
    }
    
    console.log('')
    process.exit(0)

  } catch (err) {
    // Unexpected system error
    console.error('✗ System error\n')
    console.error(`  ${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(2)
  }
}

