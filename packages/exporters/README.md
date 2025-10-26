# @aligntrue/exporters

Agent-specific exporters for AlignTrue with hybrid manifest + handler registry.

## Features

- **Hybrid Registry** - Declarative `manifest.json` + optional TypeScript handlers
- **Community-Scalable** - Add new exporters without changing core code
- **Schema Validation** - Manifest validation with JSON Schema (draft 2020-12)
- **Dynamic Loading** - Handler modules loaded on-demand with ESM imports
- **Fidelity Notes** - Surface semantic mapping limitations in exports

## Phase 1 Exporters

- ✅ Cursor (.mdc) - Generate .cursor/rules/*.mdc with content hash footer
- ✅ AGENTS.md - Universal format for multiple agents
- ✅ VS Code MCP - Generate .vscode/mcp.json configuration

## Adapter Registry

The hybrid manifest system allows community contributions without modifying core code.

### Manifest Structure

Each adapter directory contains a `manifest.json`:

```json
{
  "name": "cursor",
  "version": "1.0.0",
  "description": "Export AlignTrue rules to Cursor .mdc format",
  "outputs": [".cursor/rules/*.mdc"],
  "handler": "./index.ts",
  "license": "MIT",
  "fidelityNotes": [
    "Session metadata stored in vendor.cursor namespace",
    "AI hints preserved in vendor.cursor.ai_hint"
  ]
}
```

### Registry API

```typescript
import { ExporterRegistry } from '@aligntrue/exporters'

const registry = new ExporterRegistry()

// Programmatic registration (for tests/mocks)
registry.register(exporter)

// Manifest-based registration (production)
await registry.registerFromManifest('./path/to/manifest.json')

// Discover all adapters in directory
const manifests = registry.discoverAdapters('./src')

// Get exporter by name
const exporter = registry.get('cursor')

// List all registered exporters
const names = registry.list()

// Get manifest metadata
const manifest = registry.getManifest('cursor')
```

## Creating Adapters

### 1. Create Manifest

Create `manifest.json` in your adapter directory:

```json
{
  "name": "my-adapter",
  "version": "1.0.0",
  "description": "Export AlignTrue rules to My Tool format (min 10 chars)",
  "outputs": [".mytool/*.txt"],
  "handler": "./index.ts",
  "license": "MIT",
  "fidelityNotes": [
    "Optional: list any semantic mapping limitations"
  ]
}
```

**Required fields:**
- `name` - Lowercase alphanumeric with hyphens (e.g., `my-adapter`)
- `version` - Semantic version (e.g., `1.0.0`)
- `description` - Human-readable description (min 10 characters)
- `outputs` - Array of file patterns produced (min 1 item)

**Optional fields:**
- `handler` - Relative path to TypeScript handler (e.g., `./index.ts`)
- `license` - License identifier (default: MIT)
- `fidelityNotes` - Array of semantic mapping caveats

### 2. Implement Handler

Create a TypeScript file that exports an `ExporterPlugin`:

```typescript
import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult
} from '@aligntrue/exporters'

export class MyAdapterExporter implements ExporterPlugin {
  name = 'my-adapter'
  version = '1.0.0'
  
  async export(
    request: ScopedExportRequest,
    options: ExportOptions
  ): Promise<ExportResult> {
    // request.scope - Scope this export is for
    // request.rules - Pre-merged rules for this scope
    // request.outputPath - Suggested output path
    
    // options.outputDir - Base output directory
    // options.dryRun - If true, don't write files
    // options.backup - If true, create .backup files
    
    // Your export logic here
    const filesWritten: string[] = []
    const contentHash = 'sha256-hash-of-output'
    const fidelityNotes: string[] = []
    
    return {
      success: true,
      filesWritten,
      contentHash,
      fidelityNotes
    }
  }
}

// Export as default for registry loading
export default MyAdapterExporter
```

### 3. Write Tests

Create snapshot tests for your adapter:

```typescript
import { describe, it, expect } from 'vitest'
import { MyAdapterExporter } from './index.js'

describe('MyAdapterExporter', () => {
  it('exports rules correctly', async () => {
    const exporter = new MyAdapterExporter()
    const result = await exporter.export(request, options)
    
    expect(result.success).toBe(true)
    expect(result.filesWritten).toHaveLength(1)
    expect(result.contentHash).toMatch(/^sha256-/)
  })
  
  it('matches snapshot', async () => {
    // Golden output snapshot test
    const output = await generateOutput(rules)
    expect(output).toMatchSnapshot()
  })
})
```

## Testing

The registry includes comprehensive test coverage:

**Registry Tests (26 tests)**
- Programmatic registration
- Manifest loading and validation
- Handler loading with dynamic imports
- Adapter discovery in directories
- Query methods (get, has, list)

**Schema Tests (20 tests)**
- Valid manifest validation
- Required field enforcement
- Format validation (name, version, semver)
- Optional field handling
- Additional properties rejection

## API Reference

### ExporterPlugin Interface

```typescript
interface ExporterPlugin {
  name: string
  version: string
  export(
    request: ScopedExportRequest,
    options: ExportOptions
  ): Promise<ExportResult>
}
```

### ScopedExportRequest

```typescript
interface ScopedExportRequest {
  scope: ResolvedScope      // Scope this export is for
  rules: AlignRule[]        // Pre-merged rules for this scope
  outputPath: string        // Suggested output path
}
```

### ExportOptions

```typescript
interface ExportOptions {
  outputDir: string
  dryRun?: boolean
  backup?: boolean
}
```

### ExportResult

```typescript
interface ExportResult {
  success: boolean
  filesWritten: string[]
  fidelityNotes?: string[]
  contentHash: string
}
```

### AdapterManifest

```typescript
interface AdapterManifest {
  name: string              // Adapter name (lowercase alphanumeric with hyphens)
  version: string           // Semantic version (e.g., 1.0.0)
  description: string       // Human-readable description
  outputs: string[]         // File patterns produced
  handler?: string          // Optional: relative path to TypeScript handler
  license?: string          // License identifier (default: MIT)
  fidelityNotes?: string[]  // Optional: semantic mapping limitations
}
```

## Fidelity Notes

Fidelity notes document semantic mapping limitations when converting AlignTrue IR to agent-specific formats.

**When to add fidelity notes:**
- Agent format cannot represent a field (e.g., no severity levels)
- Lossy conversion (e.g., severity mapped to markdown emphasis)
- Agent-specific metadata stored in `vendor.<agent>` namespace
- Behavioral differences (e.g., applies_to as comments vs. enforced)

**Example:**
```json
{
  "fidelityNotes": [
    "Severity mapped to markdown emphasis (* = info, ** = warn, *** = error)",
    "applies_to patterns stored as comments (not enforced)",
    "Vendor metadata preserved in frontmatter"
  ]
}
```

## Package Status

✅ **Step 10 Complete** - Adapter registry with hybrid manifests implemented

**Next:**
- Step 11: Implement Cursor exporter
- Step 12: Implement AGENTS.md formatter
- Step 13: Implement VS Code MCP config exporter

## Contributing

See `CONTRIBUTING.md` for adapter contribution guidelines.

## License

MIT
