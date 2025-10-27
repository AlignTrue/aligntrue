/**
 * Scopes listing command
 */

import { loadConfig } from '@aligntrue/core'
import { existsSync } from 'fs'

export async function scopes(args: string[]): Promise<void> {
  if (args.length > 0 && args[0] === '--help') {
    console.log('Usage: aligntrue scopes\n')
    console.log('List configured scopes from .aligntrue/config.yaml\n')
    console.log('Scopes define path-based rule application in monorepos.')
    console.log('Each scope can specify include/exclude patterns and rule overrides.\n')
    console.log('Example output:')
    console.log('  Scopes configured in .aligntrue/config.yaml:')
    console.log('')
    console.log('    packages/frontend')
    console.log('      Include: *.ts, *.tsx')
    console.log('      Exclude: **/*.test.ts')
    console.log('')
    console.log('    packages/backend')
    console.log('      Include: *.ts')
    console.log('      Exclude: **/*.spec.ts')
    process.exit(0)
  }

  const configPath = '.aligntrue/config.yaml'

  // Check if config exists
  if (!existsSync(configPath)) {
    console.error('✗ Config file not found: .aligntrue/config.yaml')
    console.error('  Run: aligntrue init')
    process.exit(1)
  }

  try {
    // Load config
    const config = await loadConfig(configPath)

    // Check if scopes are defined
    if (!config.scopes || config.scopes.length === 0) {
      console.log('No scopes configured (applies rules to entire workspace)')
      console.log('\nTo add scopes, edit .aligntrue/config.yaml:')
      console.log('')
      console.log('scopes:')
      console.log('  - path: packages/frontend')
      console.log('    include:')
      console.log('      - "*.ts"')
      console.log('      - "*.tsx"')
      console.log('    exclude:')
      console.log('      - "**/*.test.ts"')
      console.log('')
      console.log('See: docs/guides/scopes.md (when available)')
      process.exit(0)
    }

    // Display scopes
    console.log('Scopes configured in .aligntrue/config.yaml:\n')

    for (const scope of config.scopes) {
      console.log(`  ${scope.path}`)

      if (scope.include && scope.include.length > 0) {
        console.log(`    Include: ${scope.include.join(', ')}`)
      }

      if (scope.exclude && scope.exclude.length > 0) {
        console.log(`    Exclude: ${scope.exclude.join(', ')}`)
      }

      if (scope.rulesets && scope.rulesets.length > 0) {
        console.log(`    Rulesets: ${scope.rulesets.join(', ')}`)
      }

      console.log('')
    }

    console.log(`Total: ${config.scopes.length} scope${config.scopes.length === 1 ? '' : 's'}`)
    process.exit(0)

  } catch (err) {
    // Re-throw process.exit errors (for testing)
    if (err instanceof Error && err.message.startsWith('process.exit')) {
      throw err
    }
    console.error('✗ Failed to load scopes')
    console.error(`  ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}

