#!/usr/bin/env node
/**
 * CLI script for running checks against an Align pack
 * 
 * Usage:
 *   pnpm run-checks <align-file> <target-dir> [--allow-exec] [--format sarif|json]
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { parseArgs } from 'util'
import { parseYamlToJson } from '@aligntrue/schema'
import { validateAlign } from '@aligntrue/schema'
import { runChecks } from '../src/engine.js'
import { emitSarif } from '../src/sarif.js'
import { emitJson } from '../src/json.js'
import { DiskFileProvider } from '../src/providers/disk.js'

interface CliArgs {
  alignFile: string
  targetDir: string
  allowExec: boolean
  format: 'sarif' | 'json' | 'text'
}

function parseCliArgs(): CliArgs {
  const { values, positionals } = parseArgs({
    options: {
      'allow-exec': { type: 'boolean', default: false },
      'format': { type: 'string', default: 'text' },
    },
    allowPositionals: true,
  })

  if (positionals.length < 2) {
    console.error('Usage: run-checks <align-file> <target-dir> [--allow-exec] [--format sarif|json|text]')
    process.exit(2)
  }

  return {
    alignFile: positionals[0],
    targetDir: positionals[1],
    allowExec: values['allow-exec'] as boolean,
    format: (values['format'] as string || 'text') as 'sarif' | 'json' | 'text',
  }
}

async function main() {
  const args = parseCliArgs()

  // Read and validate Align pack
  const alignPath = resolve(args.alignFile)
  let alignYaml: string
  try {
    alignYaml = readFileSync(alignPath, 'utf8')
  } catch (err) {
    console.error(`Error reading Align file: ${alignPath}`)
    console.error(err)
    process.exit(2)
  }

  // Validate schema and integrity
  const validation = validateAlign(alignYaml)
  
  if (!validation.schema.valid) {
    console.error('Align pack failed schema validation:')
    for (const error of validation.schema.errors || []) {
      console.error(`  ${error.path}: ${error.message}`)
    }
    process.exit(1)
  }

  if (!validation.integrity.valid) {
    console.error('Align pack failed integrity validation:')
    console.error(`  Stored hash: ${validation.integrity.storedHash}`)
    console.error(`  Computed hash: ${validation.integrity.computedHash}`)
    if (validation.integrity.error) {
      console.error(`  Error: ${validation.integrity.error}`)
    }
    process.exit(1)
  }

  // Parse pack
  const alignPack = parseYamlToJson(alignYaml)

  // Set up file provider
  const targetDir = resolve(args.targetDir)
  const fileProvider = new DiskFileProvider(targetDir)

  // Run checks
  console.error(`Running ${alignPack.rules.length} checks from ${alignPack.id}...`)
  if (args.allowExec) {
    console.error('⚠️  Command execution is ENABLED')
  }

  const results = await runChecks(alignPack, {
    fileProvider,
    workingDir: targetDir,
    allowExec: args.allowExec,
  })

  // Emit results
  switch (args.format) {
    case 'sarif': {
      const sarif = emitSarif(results)
      console.log(JSON.stringify(sarif, null, 2))
      break
    }

    case 'json': {
      const json = emitJson(results)
      console.log(JSON.stringify(json, null, 2))
      
      // Exit with error code if there are failures
      if (json.summary.failed > 0 || json.summary.errors > 0) {
        process.exit(1)
      }
      break
    }

    case 'text':
    default: {
      const json = emitJson(results)
      
      // Print summary
      console.error(`\n${'='.repeat(60)}`)
      console.error('Summary:')
      console.error(`  Total checks: ${json.summary.totalChecks}`)
      console.error(`  Passed: ${json.summary.passed}`)
      console.error(`  Failed: ${json.summary.failed}`)
      console.error(`  Errors: ${json.summary.errors}`)
      console.error(`${'='.repeat(60)}\n`)

      // Print findings
      if (json.findings.length > 0) {
        console.error('Findings:\n')
        for (const finding of json.findings) {
          const level = finding.severity === 'MUST' ? 'ERROR' : finding.severity === 'SHOULD' ? 'WARN' : 'INFO'
          const location = finding.location.line 
            ? `${finding.location.path}:${finding.location.line}` 
            : finding.location.path
          
          console.error(`[${level}] ${location}`)
          console.error(`  ${finding.message}`)
          console.error(`  Rule: ${finding.packId}/${finding.ruleId}`)
          if (finding.autofixHint) {
            console.error(`  Fix: ${finding.autofixHint}`)
          }
          console.error('')
        }
      }

      // Print errors
      if (json.errors.length > 0) {
        console.error('Errors:\n')
        for (const error of json.errors) {
          console.error(`[ERROR] ${error.packId}/${error.ruleId}`)
          console.error(`  ${error.error}`)
          console.error('')
        }
      }

      // Exit with error code if there are failures
      if (json.summary.failed > 0 || json.summary.errors > 0) {
        process.exit(1)
      }

      console.error('✅ All checks passed!')
      break
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(3)
})

