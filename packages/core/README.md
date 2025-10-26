# @aligntrue/core

Configuration management, sync engine, bundle/lockfile operations, and scope resolution for AlignTrue.

## Features

- **Config management** - Parse and validate `.aligntrue/config.yaml` with JSON Schema
- **Mode support** - Solo/team/enterprise modes with automatic defaults
- **Two-way sync** - IR ↔ agent synchronization with conflict detection
- **Scope resolution** - Hierarchical path-based scopes with merge rules
- **Bundle operations** - Dependency merge (team mode)
- **Lockfile operations** - Hash tracking with off/soft/strict modes

## Installation

```bash
pnpm add @aligntrue/core
```

## Usage

### Loading Configuration

```typescript
import { loadConfig } from '@aligntrue/core/config';

// Load from default path (.aligntrue/config.yaml)
const config = await loadConfig();

// Load from custom path
const config = await loadConfig('path/to/config.yaml');
```

### Configuration File Structure

Create `.aligntrue/config.yaml` in your project root:

```yaml
# Minimal configuration (required fields only)
version: "1"
mode: solo
```

### Full Configuration Example

```yaml
# .aligntrue/config.yaml
version: "1"
mode: solo  # or 'team' or 'enterprise'

# Optional: Module feature flags
modules:
  lockfile: false  # Enable lockfile generation (auto-enabled in team mode)
  bundle: false    # Enable bundle generation (auto-enabled in team mode)
  checks: true     # Enable machine-checkable rules engine
  mcp: false       # Enable MCP server (Phase 2+)

# Optional: Git integration
git:
  mode: ignore  # or 'commit' or 'branch'
  per_adapter:
    cursor: ignore  # Override for specific adapter

# Optional: Customize exporters (default: ['cursor', 'agents-md'])
exporters:
  - cursor
  - agents-md

# Optional: Customize sources (default: local .aligntrue/rules.md)
sources:
  - type: local
    path: .aligntrue/rules.md
  - type: catalog
    id: packs/base/testing
    version: "^1.0.0"

# Optional: Configure scopes for monorepos
scopes:
  - path: packages/frontend
    include: ["src/**/*.tsx"]
    exclude: ["**/*.test.tsx"]
    rulesets: ["react-rules"]
  - path: packages/backend
    include: ["src/**/*.ts"]
    rulesets: ["node-rules"]

# Optional: Merge strategy
merge:
  strategy: deep
  order: [root, path, local]  # Precedence order
```

## Mode-Specific Defaults

### Solo Mode (Default)
Best for individual developers. Minimal ceremony, no lockfile/bundle overhead.

**Defaults:**
- `modules.lockfile: false`
- `modules.bundle: false`
- `modules.checks: true`
- `modules.mcp: false`
- `git.mode: 'ignore'`
- `exporters: ['cursor', 'agents-md']`
- `sources: [{ type: 'local', path: '.aligntrue/rules.md' }]`

### Team Mode
For teams needing reproducibility and drift detection.

**Defaults:**
- `modules.lockfile: true` (enables lockfile)
- `modules.bundle: true` (enables bundle)
- `modules.checks: true`
- `git.mode: 'ignore'`
- All other defaults same as solo

### Enterprise Mode
All features enabled for maximum control.

**Defaults:**
- All modules enabled
- `git.mode: 'commit'`

## Source Types

### Local
```yaml
sources:
  - type: local
    path: .aligntrue/rules.md
```

### Catalog
```yaml
sources:
  - type: catalog
    id: packs/base/testing
    version: "^1.0.0"  # Optional semver constraint
```

### Git
```yaml
sources:
  - type: git
    url: https://github.com/org/rules.git
```

### URL
```yaml
sources:
  - type: url
    url: https://example.com/rules.yaml
```

## Validation

Config files are validated against a JSON Schema. Errors include:
- Field path (e.g., `modules.lockfile`)
- Expected type/value
- Actionable fix suggestions

### Example Error

```
Invalid config in .aligntrue/config.yaml:
  - mode: must be equal to one of the allowed values. Allowed values: solo, team, enterprise
  See config.schema.json for full specification.
```

## Troubleshooting

### Config file not found
```
Error: Config file not found: .aligntrue/config.yaml
  Run 'aligntrue init' to create one.
```
**Fix:** Run `aligntrue init` or create the config file manually.

### Invalid YAML syntax
```
Invalid YAML in .aligntrue/config.yaml at line 5, column 3
  bad indentation
  Check for syntax errors (indentation, quotes, colons).
```
**Fix:** Check YAML indentation and syntax. Use a YAML validator.

### Unknown fields warning
```
Warning: Unknown config field "unknownField" in .aligntrue/config.yaml
  This field will be ignored. Valid fields: version, mode, modules, git, sources, exporters, scopes, merge
```
**Fix:** This is a warning, not an error. Remove the unknown field or check documentation for correct field names.

### Mode/module inconsistency
```
Warning: Solo mode with lockfile enabled is unusual.
  Consider using 'mode: team' if you need lockfile features.
```
**Fix:** Either change `mode: team` or set `modules.lockfile: false`.

## API Reference

### `loadConfig(configPath?: string): Promise<AlignTrueConfig>`
Load and validate config file with defaults applied.

**Parameters:**
- `configPath` (optional): Path to config file. Defaults to `.aligntrue/config.yaml`

**Returns:** Validated config with mode-specific defaults applied

**Throws:** 
- If file not found
- If YAML parsing fails
- If schema validation fails
- If enhanced validation fails (scopes, paths, etc.)

### `validateConfig(config: AlignTrueConfig, configPath?: string): Promise<void>`
Validate config structure and cross-field constraints.

**Parameters:**
- `config`: Config object to validate
- `configPath` (optional): Path for error messages

**Throws:** If validation fails

### `applyDefaults(config: AlignTrueConfig): AlignTrueConfig`
Apply mode-specific defaults to config.

**Parameters:**
- `config`: Config object (may be incomplete)

**Returns:** Config with defaults filled in

## Package Status

✅ **Phase 1, Week 1, Step 8** - Config parser complete (43 tests passing)

