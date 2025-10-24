# @aligntrue/checks

**Check runner engine for AlignTrue Align packs.**

Executes machine-checkable rules from Align packs and emits findings in SARIF 2.1.0 or JSON format for CI and editor integration.

## Features

- **5 check types**: file_presence, path_convention, manifest_policy, regex, command_runner
- **SARIF 2.1.0 output**: compatible with GitHub Code Scanning, VS Code, and other SARIF consumers
- **JSON output**: simple format for scripting and programmatic consumption
- **Abstract file provider**: testable, extensible, works with in-memory or remote file systems
- **Gated command execution**: command_runner checks require explicit opt-in for security
- **Deterministic**: reproducible results across machines

## Installation

```bash
pnpm add @aligntrue/checks
```

## Usage

### Programmatic API

```typescript
import { runChecks, emitSarif, emitJson } from '@aligntrue/checks'
import { parseYamlToJson } from '@aligntrue/schema'
import { readFileSync } from 'fs'

// Load and parse Align pack
const alignYaml = readFileSync('pack.aligntrue.yaml', 'utf8')
const alignPack = parseYamlToJson(alignYaml)

// Run checks
const results = await runChecks(alignPack, {
  workingDir: '/path/to/project',
  allowExec: false, // Set to true to enable command_runner checks
})

// Emit SARIF for CI
const sarif = emitSarif(results)
console.log(JSON.stringify(sarif, null, 2))

// Or emit JSON for scripting
const json = emitJson(results)
console.log(`Passed: ${json.summary.passed}, Failed: ${json.summary.failed}`)
```

### CLI Script

```bash
# Run checks and output text summary
pnpm run-checks pack.aligntrue.yaml /path/to/project

# Output SARIF
pnpm run-checks pack.aligntrue.yaml /path/to/project --format sarif > results.sarif

# Output JSON
pnpm run-checks pack.aligntrue.yaml /path/to/project --format json > results.json

# Enable command execution (use with caution)
pnpm run-checks pack.aligntrue.yaml /path/to/project --allow-exec
```

## Check Types

### file_presence

Verifies that files matching a glob pattern exist.

```yaml
- id: require-tests
  severity: MUST
  check:
    type: file_presence
    inputs:
      pattern: "**/*.test.ts"
      must_exist_for_changed_sources: true
    evidence: "Missing test file for changed source"
```

### path_convention

Validates that file paths follow a naming convention (regex).

```yaml
- id: kebab-case-components
  severity: SHOULD
  check:
    type: path_convention
    inputs:
      pattern: "^[a-z0-9-]+\\.tsx$"
      include: ["src/components/**"]
      message: "Component files must use kebab-case"
    evidence: "File name violates path convention"
```

### manifest_policy

Validates dependency management files (package.json, lockfiles).

```yaml
- id: pinned-deps
  severity: MUST
  check:
    type: manifest_policy
    inputs:
      manifest: "package.json"
      lockfile: "pnpm-lock.yaml"
      require_pinned: true
    evidence: "New dependency is not pinned in lockfile"
```

### regex

Pattern matching against file contents.

```yaml
- id: no-todos
  severity: SHOULD
  check:
    type: regex
    inputs:
      include: ["**/*.ts"]
      pattern: "\\bTODO\\b"
      allow: false
    evidence: "TODO present in file"
```

### command_runner

Executes a shell command and validates exit code.

**Requires explicit `allowExec: true` option.**

```yaml
- id: typecheck
  severity: MUST
  check:
    type: command_runner
    inputs:
      command: "pnpm exec tsc --noEmit"
      timeout_ms: 60000
      expect_exit_code: 0
    evidence: "Type check failed"
```

## API Reference

### `runChecks(alignPack, options)`

Runs all checks in an Align pack.

**Parameters:**
- `alignPack: AlignPack` - Validated Align pack object
- `options: RunChecksOptions` - Execution options
  - `fileProvider?: FileProvider` - Custom file provider (defaults to DiskFileProvider)
  - `workingDir?: string` - Working directory (defaults to `process.cwd()`)
  - `allowExec?: boolean` - Allow command execution (default: `false`)
  - `envWhitelist?: string[]` - Environment variables to pass to commands
  - `changedFiles?: string[]` - List of changed files for incremental checks
  - `defaultTimeout?: number` - Default command timeout in ms

**Returns:** `Promise<CheckResult[]>` - Array of check results (one per rule)

### `emitSarif(results, toolVersion?)`

Converts check results to SARIF 2.1.0 format.

**Parameters:**
- `results: CheckResult[]` - Check results from `runChecks`
- `toolVersion?: string` - Tool version string (default: `'0.1.0'`)

**Returns:** `SarifLog` - SARIF 2.1.0 log object

### `emitJson(results)`

Converts check results to simple JSON format.

**Parameters:**
- `results: CheckResult[]` - Check results from `runChecks`

**Returns:** `JsonFindings` - JSON findings object with summary and findings array

### `FileProvider` Interface

Abstract interface for file access. Implement this to use custom file sources.

```typescript
interface FileProvider {
  glob(pattern: string, options?: GlobOptions): Promise<string[]>
  readFile(path: string): Promise<string>
  exists(path: string): Promise<boolean>
  readJson(path: string): Promise<unknown>
}
```

**Implementations:**
- `DiskFileProvider` - Reads from local filesystem
- Custom implementations for zip files, Git repos, remote storage, etc.

## Command Execution Safety

The `command_runner` check type is **disabled by default** for security.

To enable:
1. Pass `allowExec: true` to `runChecks`
2. Optionally provide `envWhitelist` to restrict environment variables
3. All commands run with configurable timeout (default 30s)

Commands are executed in a shell with:
- Working directory set via `working_dir` input or context `workingDir`
- Only whitelisted environment variables (if provided)
- Timeout enforcement (kills process after timeout)

**Best practices:**
- Only enable `allowExec` in trusted CI environments
- Use `envWhitelist` to limit exposed secrets
- Set appropriate `timeout_ms` for each command
- Validate command inputs in pack YAML

## Integration Examples

### GitHub Actions

```yaml
- name: Run AlignTrue checks
  run: |
    pnpm run-checks pack.aligntrue.yaml . --format sarif > results.sarif

- name: Upload SARIF results
  uses: github/codeql-action/upload-sarif@v2
  with:
    sarif_file: results.sarif
```

### VS Code Extension

```typescript
import { runChecks, emitSarif } from '@aligntrue/checks'

// Run checks and convert to SARIF
const results = await runChecks(pack, { workingDir: workspace.rootPath })
const sarif = emitSarif(results)

// Display in Problems panel
diagnosticCollection.clear()
for (const result of sarif.runs[0].results) {
  // Convert SARIF result to VS Code Diagnostic
  // ...
}
```

### Custom File Provider (Testing)

```typescript
import { MemoryFileProvider } from '@aligntrue/checks/tests/providers/memory'

const provider = new MemoryFileProvider()
provider.addFiles({
  'src/foo.ts': 'const x = 42;',
  'package.json': JSON.stringify({ dependencies: {} }),
})

const results = await runChecks(pack, { fileProvider: provider })
```

## Testing

```bash
# Run unit tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Type check
pnpm typecheck
```

## Related Packages

- `@aligntrue/schema` - JSON Schema, canonicalization, and validation
- `@aligntrue/cli` - CLI tool for managing Align packs

## License

MIT

