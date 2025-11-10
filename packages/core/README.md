# @aligntrue/core

Core sync orchestration, configuration management, and scope resolution for AlignTrue.

## Overview

This package provides the core functionality for AlignTrue's two-way sync engine:

- **Configuration management** - Load and validate `.aligntrue/config.yaml`
- **Scope resolution** - Path-based rule scoping for monorepos
- **Sync engine** - Orchestrate IR→agent (default) and agent→IR (with --accept-agent) sync
- **Conflict detection** - Identify field-level differences between IR and agent state
- **Atomic file operations** - Temp file + rename pattern with checksum tracking
- **Lockfile with hash modes** - Drift detection with off/soft/strict enforcement (team mode)

**YAML Library**: This package uses `js-yaml` for config loading and IR parsing (internal operations). See [.internal_docs/yaml-libraries.md](../../.internal_docs/yaml-libraries.md) for rationale.

## Installation

```bash
pnpm add @aligntrue/core
```

## Usage

### Sync Engine

```typescript
import { SyncEngine } from "@aligntrue/core";

const engine = new SyncEngine();

// Register exporters
engine.registerExporter(cursorExporter);
engine.registerExporter(agentsMdExporter);

// Sync IR to agents (default direction)
const result = await engine.syncToAgents(".aligntrue/.rules.yaml", {
  configPath: ".aligntrue/config.yaml",
  dryRun: false,
  backup: true,
});

if (result.success) {
  console.log(`Wrote ${result.written.length} files`);
} else {
  console.error("Sync failed:", result.warnings);
}
```

### Configuration

Load and validate configuration:

```typescript
import { loadConfig } from "@aligntrue/core";

const config = await loadConfig(".aligntrue/config.yaml");
console.log(`Mode: ${config.mode}`);
console.log(`Exporters: ${config.exporters.join(", ")}`);
```

Example config structure:

```yaml
version: "1"
mode: solo # solo | team | enterprise
exporters:
  - cursor
  - agents-md
sources:
  - type: local
    path: .aligntrue/.rules.yaml
  - type: git
    url: https://github.com/AlignTrue/aligntrue
    path: examples/packs/global.yaml
```

**Source Types:**

- `local` - Read from local filesystem (requires `path`)
- `git` - Clone from git repo (requires `url`, optional `path`)
- `url` - Fetch from HTTP URL (future enhancement, requires `url`)

**Git Sources:**
Git sources fetch rules from any git repository:

```yaml
sources:
  - type: git
    url: https://github.com/AlignTrue/aligntrue
    path: examples/packs/global.yaml
  - type: git
    url: https://github.com/yourorg/rules
    path: rules/testing.yaml
```

Cache location: `.aligntrue/.cache/git/`

- Clones repository to local cache
- Extracts specified file path
- Offline fallback when network unavailable
- Force refresh with `--force-refresh` flag (future CLI)

### Scope Resolution

```typescript
import { resolveScopes } from "@aligntrue/core";

const config = {
  scopes: [
    {
      path: "apps/web",
      include: ["**/*.ts", "**/*.tsx"],
      exclude: ["**/*.test.ts"],
    },
  ],
  merge: {
    order: ["root", "path", "local"],
  },
};

const resolved = resolveScopes("/workspace", config);
```

### Lockfile Management

Lockfiles provide hash-based drift detection for team mode:

```typescript
import {
  generateLockfile,
  validateLockfile,
  enforceLockfile,
  readLockfile,
  writeLockfile,
} from "@aligntrue/core";

// Generate lockfile from IR
const lockfile = generateLockfile(alignPack, "team");
writeLockfile(".aligntrue.lock.json", lockfile);

// Validate on subsequent syncs
const existingLockfile = readLockfile(".aligntrue.lock.json");
if (existingLockfile) {
  const validation = validateLockfile(existingLockfile, currentPack);
  const enforcement = enforceLockfile("soft", validation);

  if (!enforcement.success) {
    console.error("Lockfile validation failed");
    process.exit(enforcement.exitCode);
  }
}
```

**Lockfile modes:**

- `off` - No validation (solo mode default)
- `soft` - Warn on mismatch, continue sync, exit 0 (team mode default)
- `strict` - Error on mismatch, abort sync, exit 1

**Configuration:**

```yaml
version: "1"
mode: team
modules:
  lockfile: true
lockfile:
  mode: soft # or 'strict' or 'off'
```

**Lockfile format:**

```json
{
  "version": "1",
  "generated_at": "2025-10-27T10:00:00.000Z",
  "mode": "team",
  "bundle_hash": "abc123...",
  "rules": [
    {
      "rule_id": "test.rule.one",
      "content_hash": "def456...",
      "source": "https://github.com/org/aligns"
    }
  ]
}
```

**Key features:**

- Per-rule SHA-256 hashes for granular drift detection
- Bundle hash for quick validation of entire pack
- Excludes `vendor.*.volatile` fields from hashing
- Atomic writes (temp+rename) prevent partial state
- Sorted JSON keys for deterministic output

### Conflict Detection

```typescript
import { ConflictDetector } from "@aligntrue/core";

const detector = new ConflictDetector();

const conflicts = detector.detectConflicts("cursor", irRules, agentRules);

if (conflicts.hasConflicts) {
  for (const conflict of conflicts.conflicts) {
    console.log(`Conflict in ${conflict.ruleId}:`);
    console.log(`  Field: ${conflict.field}`);
    console.log(`  IR: ${JSON.stringify(conflict.irValue)}`);
    console.log(`  Agent: ${JSON.stringify(conflict.agentValue)}`);
  }
}
```

## Performance Configuration

Control resource limits and ignore patterns to prevent resource exhaustion:

```yaml
performance:
  max_file_size_mb: 10 # Default: 10MB
  max_directory_depth: 10 # Default: 10 levels
  ignore_patterns: # Additional patterns beyond .gitignore
    - "*.tmp"
    - ".DS_Store"
```

**Behavior:**

- **Solo mode:** Warnings logged to stderr, operations continue
- **Team mode:** Errors abort operations (use `--force` to override)
- **Git operations:** Respects `.gitignore` in cloned repositories

**Usage:**

```typescript
import { checkFileSize, createIgnoreFilter } from "@aligntrue/core/performance";

// Check file size before reading
checkFileSize("/path/to/file.yaml", 10, "team", false);

// Create ignore filter from .gitignore
const filter = createIgnoreFilter("./.gitignore", ["*.tmp", ".DS_Store"]);
if (filter("node_modules/pkg/index.js")) {
  console.log("File should be ignored");
}
```

**When limits are exceeded:**

- Solo mode: Logs warning, continues operation
- Team mode: Throws error, aborts operation
- `--force` flag: Bypasses all checks

## API Reference

### SyncEngine

Main sync orchestration class.

**Methods:**

- `registerExporter(exporter: ExporterPlugin)` - Register an exporter plugin
- `syncToAgents(irPath, options)` - Sync IR to agents (returns SyncResult)
- `syncFromAgent(agent, irPath, options)` - Sync from agent to IR (TODO: Step 17)
- `detectConflicts(agent, irRules, agentRules)` - Detect conflicts
- `clear()` - Clear internal state

**SyncOptions:**

- `configPath?: string` - Path to config file
- `dryRun?: boolean` - Preview without writing
- `backup?: boolean` - Create backups before overwrite
- `acceptAgent?: string` - Accept agent changes (pullback)
- `force?: boolean` - Ignore overwrite protection

**SyncResult:**

- `success: boolean` - Whether sync succeeded
- `written: string[]` - Files written
- `warnings?: string[]` - Warnings and errors
- `conflicts?: Conflict[]` - Detected conflicts
- `exportResults?: Map<string, ExportResult>` - Per-exporter results

### Configuration

**`loadConfig(configPath?)`**

Loads and validates `.aligntrue/config.yaml`.

Returns: `AlignTrueConfig`

**Mode-specific defaults:**

- **Solo:** lockfile off, bundle off, checks on, mcp off, git ignore
- **Team:** lockfile on, bundle on, checks on, mcp off, git ignore
- **Enterprise:** all on, git commit

### Scope Resolution

**`resolveScopes(workspacePath, config)`**

Resolves scopes with path normalization and validation.

**`applyScopeMerge(rulesByLevel, order)`**

Merges rules according to precedence order.

### Conflict Detection

**ConflictDetector**

Detects field-level conflicts between IR and agent state.

- Compares core fields: severity, applies_to, guidance
- Compares vendor bags (ignores volatile fields)
- Returns structured diffs

### File Operations

**NOTE:** File operation utilities have been moved to `@aligntrue/file-utils` package to break circular dependencies.

See the `@aligntrue/file-utils` package for documentation on:

- `AtomicFileWriter` - Atomic file writes with temp + rename pattern
- `computeFileChecksum(path)` - SHA-256 of file
- `computeContentChecksum(content)` - SHA-256 of content
- `ensureDirectoryExists(path)` - Create directory if needed

The core package imports these from `@aligntrue/file-utils`.

### IR Loader

**`loadIR(sourcePath)`**

Loads IR from markdown or YAML file.

- Auto-detects format (.md, .markdown, .yaml, .yml)
- Validates against schema
- Returns `AlignPack`

## Exports

```typescript
// Sync engine
export { SyncEngine, syncToAgents, syncFromAgent, registerExporter };
export type { SyncOptions, SyncResult };

// Configuration
export { loadConfig, validateConfig, applyDefaults };
export type { AlignTrueConfig, AlignTrueMode };

// Scope resolution
export {
  resolveScopes,
  applyScopeMerge,
  groupRulesByLevel,
  normalizePath,
  validateScopePath,
  validateGlobPatterns,
  validateMergeOrder,
};
export type { Scope, ResolvedScope, MergeOrder, ScopeConfig, ScopedRules };

// Conflict detection
export { ConflictDetector };
export type { Conflict, ConflictDetectionResult };

// File operations (imported from @aligntrue/file-utils)
// Note: These are re-exported for convenience but live in @aligntrue/file-utils
// import { AtomicFileWriter } from '@aligntrue/file-utils'

// IR loading
export { loadIR };

// Bundle and lockfile (stubs for team mode)
export { createBundle };
export { readLockfile, writeLockfile, verifyLockfile };
export type { Lockfile, LockfileMode };

// Exporter types (imported from @aligntrue/plugin-contracts)
export type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
};
```

## Integration Points

### With markdown-parser

- Uses `parseMarkdown` and `buildIR` to convert markdown to IR
- Handles fenced ```aligntrue blocks

### With schema

- Uses `validateAlignSchema` for IR validation
- Uses types: `AlignPack`, `AlignRule`

### With plugin-contracts

- Imports `ExporterPlugin` interface from `@aligntrue/plugin-contracts`
- Re-exports plugin types for convenience
- Calls exporters with `ScopedExportRequest`

### With file-utils

- Imports `AtomicFileWriter` from `@aligntrue/file-utils`
- Uses atomic writes for safe file operations

## Testing

Run tests:

```bash
pnpm test
```

Run tests in watch mode:

```bash
pnpm test:watch
```

Mock exporters available in `tests/mocks/`:

- `MockExporter` - Configurable mock for testing
- `FailingExporter` - Always fails for error path testing

## Sync Behavior

### Default Direction: IR → Agents

By default, sync reads from IR (`.aligntrue/.rules.yaml` or `.aligntrue.yaml`) and writes to agent-specific formats:

```typescript
await engine.syncToAgents(".aligntrue/.rules.yaml");
```

### Pullback Direction: Agent → IR

With `--accept-agent`, sync reads from agent format and updates IR:

```typescript
await engine.syncFromAgent("cursor", ".aligntrue/.rules.yaml", {
  acceptAgent: "cursor",
});
```

**Note:** Agent→IR sync not yet implemented (Coming in Step 17).

### Conflict Detection

Conflicts are detected but not automatically resolved. The engine returns structured conflict records with diffs. Resolution UI will be added in Step 14.

```typescript
const conflicts = engine.detectConflicts("cursor", irRules, agentRules);

for (const conflict of conflicts) {
  console.log(conflict.diff); // Readable diff
}
```

### Vendor Bags & Volatile Fields

Agent-specific metadata stored in `vendor.<agent>` namespace:

```yaml
rules:
  - id: test-rule
    severity: warn
    applies_to: ["**/*.ts"]
    vendor:
      cursor:
        ai_hint: "Suggest using vitest"
        session_id: "abc123" # volatile
      _meta:
        volatile: ["cursor.session_id"]
```

Volatile fields excluded from conflict detection and hashing.

## Cross-Platform Support

AlignTrue is tested on both Linux and Windows via GitHub Actions CI matrix:

- **Path normalization:** All paths normalized to forward slashes internally via `normalizePath()` helper
- **Windows CI validation:** 165+ tests pass on both ubuntu-latest and windows-latest runners
- **Deterministic behavior:** Same inputs produce same outputs on all platforms (canonical hashing, sorted keys)
- **Atomic writes:** Temp+rename pattern works reliably on Windows NTFS and Unix filesystems
- **CI workflow:** `.github/workflows/ci.yml` runs full test suite on both platforms

Path normalization automatically handles:

- Windows backslashes (C:\foo\bar → /foo/bar)
- Mixed separators (foo/bar\baz → /foo/bar/baz)
- Redundant separators (foo//bar → /foo/bar)
- Trailing slashes (foo/ → /foo)

**Testing locally on Windows:**

```bash
# Clone repo
git clone https://github.com/AlignTrue/aligntrue.git
cd aligntrue

# Install dependencies
pnpm install

# Run tests (should pass on Windows)
pnpm test

# Build all packages
pnpm build
```

## Next Steps

**Step 10:** Implement adapter registry with hybrid manifests ✅  
**Steps 11-13:** Implement actual exporters (Cursor, AGENTS.md, MCP) ✅  
**Step 14:** Complete two-way sync with conflict resolution UI ✅  
**Step 23:** Full CLI integration ✅  
**Step 28:** Windows CI matrix validation ✅

---

For full architecture details, see `.internal_docs/architecture-decisions.md`.
