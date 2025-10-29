# CLI Command Framework

This document describes the shared CLI command utilities and migration path for standardizing command structure across AlignTrue CLI.

## Overview

The CLI command framework provides reusable utilities for:
- **Argument parsing** - Consistent flag handling and positional args extraction
- **Help display** - Standardized help text format across all commands
- **Lifecycle management** - Intro/outro, telemetry, error handling (optional)

## Migration Status

**Migrated Commands (5):**
- `sync` - IR → agents synchronization
- `check` - Rule and config validation
- `import` - Agent format → IR import
- `config` - Config display and editing
- `privacy` - Consent management

**Pending Migration (8):**
- `adapters` - Exporter management
- `team` - Team mode enablement
- `telemetry` - Telemetry controls
- `md` - Markdown operations
- `scopes` - Scope management
- `migrate` - Migration operations
- `init` - Project initialization

**Note:** Migrate these when touched in Phase 3 or when adding new commands.

## Using Command Utilities

### Basic Pattern

```typescript
import { parseCommonArgs, showStandardHelp, type ArgDefinition } from '../utils/command-utilities.js'

// 1. Define argument structure
const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: '--dry-run',
    hasValue: false,
    description: 'Preview changes without writing files',
  },
  {
    flag: '--config',
    alias: '-c',
    hasValue: true,
    description: 'Custom config file path',
  },
]

// 2. Use in command
export async function myCommand(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS)
  
  // 3. Handle help
  if (parsed.help) {
    showStandardHelp({
      name: 'mycommand',
      description: 'Does something useful',
      usage: 'aligntrue mycommand [options]',
      args: ARG_DEFINITIONS,
      examples: ['aligntrue mycommand', 'aligntrue mycommand --dry-run'],
    })
    process.exit(0)
  }
  
  // 4. Extract flags
  const dryRun = parsed.flags['dry-run'] as boolean | undefined || false
  const config = parsed.flags['config'] as string | undefined
  
  // 5. Extract positional args
  const target = parsed.positional[0]
  
  // ... command logic ...
}
```

### parseCommonArgs(args, definitions)

Parses command-line arguments with type-safe flag handling.

**Returns:**
```typescript
{
  flags: Record<string, boolean | string | undefined>
  positional: string[]
  help: boolean
}
```

**Features:**
- Automatically handles `--help` and `-h`
- Supports aliases (`-c` for `--config`)
- Boolean flags (presence = true)
- Value flags (`--config custom.yaml`)
- Unknown flags parsed as boolean
- Positional arguments extracted separately

### showStandardHelp(config)

Displays consistent help text across all commands.

**Config:**
```typescript
{
  name: string            // Command name
  description: string     // Brief description
  usage: string          // Usage pattern
  args?: ArgDefinition[] // Argument definitions
  examples?: string[]    // Example commands
  notes?: string[]       // Additional notes
}
```

**Features:**
- Automatic option alignment
- Consistent formatting
- Examples section
- Notes/description sections

### executeWithLifecycle(fn, options)

**Optional:** Wraps command execution with lifecycle management.

**Features:**
- Intro/outro messages with @clack/prompts
- Automatic telemetry recording
- Standard error handling
- Exit code management

**Usage:**
```typescript
await executeWithLifecycle(
  async () => {
    // Command logic here
  },
  {
    commandName: 'mycommand',
    showIntro: true,
    introMessage: 'Running mycommand',
    successMessage: '✓ Command complete',
  }
)
```

**Note:** This is optional. Most commands handle their own intro/outro for fine-grained control.

## Test Utilities

Optional test helpers in `tests/utils/command-test-helpers.ts`:

### mockCommandArgs(overrides)

Generate test argument arrays:
```typescript
const args = mockCommandArgs({ dryRun: true, config: 'test.yaml' })
// Returns: ['--dry-run', '--config', 'test.yaml']
```

### expectStandardHelp(output)

Validate help text format:
```typescript
const result = expectStandardHelp(helpOutput)
expect(result.valid).toBe(true)
```

### captureCommandOutput()

Capture stdout/stderr during tests:
```typescript
const capture = captureCommandOutput()
capture.start()
// ... run command ...
const output = capture.stop()
expect(output.stdout).toContain('expected text')
```

## Migration Guide

### Before

```typescript
function parseArgs(args: string[]): MyArgs {
  const parsed: MyArgs = { help: false, dryRun: false }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--help' || arg === '-h') {
      parsed.help = true
    } else if (arg === '--dry-run') {
      parsed.dryRun = true
    }
  }
  return parsed
}

function showHelp(): void {
  console.log(`Usage: aligntrue mycommand [options]
  
Options:
  --dry-run    Preview mode
  --help, -h   Show help
  
Examples:
  aligntrue mycommand
  aligntrue mycommand --dry-run
`)
}
```

### After

```typescript
const ARG_DEFINITIONS: ArgDefinition[] = [
  { flag: '--dry-run', hasValue: false, description: 'Preview mode' },
  { flag: '--help', alias: '-h', hasValue: false, description: 'Show help' },
]

// In command function
const parsed = parseCommonArgs(args, ARG_DEFINITIONS)
if (parsed.help) {
  showStandardHelp({
    name: 'mycommand',
    description: 'Does something',
    usage: 'aligntrue mycommand [options]',
    args: ARG_DEFINITIONS,
    examples: ['aligntrue mycommand', 'aligntrue mycommand --dry-run'],
  })
  process.exit(0)
}

const dryRun = parsed.flags['dry-run'] as boolean | undefined || false
```

### Key Changes

1. **Replace parseArgs function** with `parseCommonArgs(args, ARG_DEFINITIONS)`
2. **Replace showHelp function** with `showStandardHelp(config)`
3. **Extract flags** from `parsed.flags` object (use correct keys)
4. **Extract positional args** from `parsed.positional` array
5. **Update tests** if they break (usually just mock updates)

## Benefits

### Code Reduction
- ~40 lines removed per command (parseArgs + showHelp)
- ~350 lines of shared utilities used by 5 commands
- ~140 lines net reduction with better consistency

### Consistency
- Same help format across all commands
- Same flag handling behavior
- Same error messages for invalid args

### Maintainability
- One place to fix parsing bugs
- One place to improve help formatting
- Easier for new commands to follow patterns

### Testability
- Shared test utilities
- Common patterns = easier to test
- Less duplication in tests

## Phase 3 Migration Plan

When adding or modifying commands in Phase 3:

1. **New commands** - Use framework from start (follow Basic Pattern above)
2. **Modified commands** - Migrate during modification (follow Migration Guide)
3. **Unchanged commands** - Defer migration (no rush, not blocking)

Target: Migrate remaining 8 commands by end of Phase 3.

## Related Files

- **Utilities:** `packages/cli/src/utils/command-utilities.ts`
- **Tests:** `packages/cli/tests/utils/command-utilities.test.ts`
- **Test Helpers:** `packages/cli/tests/utils/command-test-helpers.ts`
- **Test Helper Tests:** `packages/cli/tests/utils/command-test-helpers.test.ts`

## Support

Questions or issues with the framework? See existing migrated commands for examples:
- Simple: `config`, `privacy`
- Medium: `check`, `import`
- Complex: `sync`

