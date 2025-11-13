---
title: "Configuration reference (.aligntrue/config.yaml)"
description: "Complete reference for all configuration options with examples, defaults, and tips."
---

# Configuration reference

Complete reference for `.aligntrue/config.yaml` configuration options.

## Overview

AlignTrue uses `.aligntrue/config.yaml` for all configuration. The file is created during `aligntrue init` and uses YAML format for readability.

**Location:** `.aligntrue/config.yaml` (project root)

**Format:** YAML (validated against JSON Schema on load)

**Mode-specific defaults:** Many fields have different defaults based on `mode` (solo vs team vs enterprise).

## Core fields

### mode

**Type:** `string`

**Values:** `"solo"` | `"team"` | `"enterprise"`

**Default:** `"solo"`

Operating mode that determines default behavior for lockfiles, bundles, and auto-pull.

```yaml
mode: solo # or team, enterprise
```

### exporters

**Type:** `array of strings`

**Default:** `["cursor", "agents-md"]`

**Required:** Yes (at least one)

List of exporter adapters to generate. Determines which agent files are created during sync.

```yaml
exporters:
  - cursor
  - agents-md
  - vscode-mcp
```

See [Agent Support](/docs/04-reference/agent-support) for all 43 available exporters.

### sources

**Type:** `array of objects`

**Default:** `[{ type: "local", path: ".aligntrue/.rules.yaml" }]`

Where to load rules from. Supports local files and git repositories.

```yaml
sources:
  - type: local
    path: .aligntrue/.rules.yaml
```

## Sync behavior

### sync

**Type:** `object`

**Default:** Mode-specific (see below)

Controls which files accept edits, sync direction, auto-pull, and conflict resolution.

```yaml
sync:
  edit_source: "AGENTS.md" # Which files accept edits
  scope_prefixing: "auto" # Scope prefixes in AGENTS.md (off/auto/always)
  auto_pull: true # Auto-import from primary agent
  primary_agent: cursor # Which agent to auto-pull from
  on_conflict: accept_agent # How to resolve conflicts
  workflow_mode: native_format # Editing workflow preference
  show_diff_on_pull: true # Show diff when auto-pull runs
```

#### sync.edit_source

**Type:** `string | string[]`

**Default:** Auto-detected during init. Falls back to `"AGENTS.md"` if no agents detected.

**Values:**

- `".rules.yaml"` - IR only (no agent edits detected)
- `"AGENTS.md"` - Single file editing
- `".cursor/rules/*.mdc"` - Glob pattern for multiple files
- `["AGENTS.md", ".cursor/rules/*.mdc"]` - Array of patterns
- `"any_agent_file"` - All agent files

Which files accept edits and sync back to IR. Files matching this config are detected for changes; files not matching are marked read-only.

**Deprecated:** `sync.two_way` (auto-migrates: `false` → `".rules.yaml"`, `true` → `"any_agent_file"`)

#### sync.scope_prefixing

**Type:** `string`

**Default:** `"off"`

**Values:** `"off"` | `"auto"` | `"always"`

Add scope prefixes to AGENTS.md section headings when syncing from multi-file sources:

- **off** - No prefixes
- **auto** - Prefix only when multiple scopes detected
- **always** - Always prefix non-default scopes

Example: Section from `backend.mdc` becomes "Backend: Security" in AGENTS.md.

Only applies when `edit_source` is `.cursor/rules/*.mdc` or similar multi-file pattern.

#### sync.auto_pull

**Type:** `boolean`

**Default:** `true` (solo), `false` (team/enterprise)

Automatically import changes from primary agent before syncing.

#### sync.primary_agent

**Type:** `string`

**Default:** Auto-detected from first importable exporter

Which agent to auto-pull from (cursor, copilot, claude-code, aider, agents-md).

#### sync.on_conflict

**Type:** `string`

**Values:** `"prompt"` | `"keep_ir"` | `"accept_agent"`

**Default:** `"accept_agent"` (solo), `"prompt"` (team/enterprise)

How to resolve conflicts when both IR and agent files are edited.

#### sync.workflow_mode

**Type:** `string`

**Values:** `"auto"` | `"ir_source"` | `"native_format"`

**Default:** `"auto"` (solo), `"ir_source"` (team/enterprise)

Preferred editing workflow:

- **auto** - Prompt on first conflict
- **ir_source** - Edit `.aligntrue/.rules.yaml` or `AGENTS.md`
- **native_format** - Edit agent files directly (e.g., `.cursor/*.mdc`)

#### sync.show_diff_on_pull

**Type:** `boolean`

**Default:** `true`

Show diff summary when auto-pull imports changes.

## Agent detection

### detection

**Type:** `object`

**Default:** `{ auto_enable: false, ignored_agents: [] }`

Controls automatic agent detection during sync.

```yaml
detection:
  auto_enable: false # Auto-enable detected agents without prompting
  ignored_agents: # Agents to never prompt about
    - windsurf
    - aider-md
```

#### detection.auto_enable

**Type:** `boolean`

**Default:** `false`

Auto-enable detected agents without prompting. When `true`, new agents found in workspace are automatically added to exporters and synced.

**Use case:** CI/CD environments or when you want all detected agents enabled automatically.

#### detection.ignored_agents

**Type:** `array of strings`

**Default:** `[]`

Agents to never prompt about during detection. Useful for agents you don't use even though their files exist in your workspace.

**Example:**

```yaml
detection:
  ignored_agents:
    - windsurf # Never prompt about Windsurf
    - aider-md # Never prompt about Aider
```

**Managing ignored agents:**

```bash
# Add to ignored list
aligntrue adapters ignore windsurf

# Manually detect new agents (respects ignored list)
aligntrue adapters detect
```

## Modules and features

### modules

**Type:** `object`

**Default:** Mode-specific

Feature flags for optional modules.

```yaml
modules:
  lockfile: false # Generate .aligntrue.lock.json
  bundle: false # Generate .aligntrue.bundle.yaml
  checks: true # Enable machine-checkable rules
  mcp: false # Enable MCP server
```

### lockfile

**Type:** `object`

**Default:** `{ mode: "off" }` (solo), `{ mode: "soft" }` (team/enterprise)

Lockfile validation mode for reproducible builds.

```yaml
lockfile:
  mode: soft # off | soft | strict
```

Values:

- **off** - No lockfile validation
- **soft** - Warn on drift but don't fail
- **strict** - Fail on any drift (recommended for CI)

## Backup and restore

### backup

**Type:** `object`

**Default:** `{ auto_backup: true, keep_count: 20, backup_on: ["sync"] }`

Automatic backup configuration.

```yaml
backup:
  auto_backup: true
  keep_count: 20
  backup_on:
    - sync
```

#### backup.auto_backup

**Type:** `boolean`

**Default:** `true`

Automatically create backups before destructive operations.

#### backup.keep_count

**Type:** `number`

**Default:** `5`

Number of backups to keep (older backups auto-deleted).

#### backup.backup_on

**Type:** `array of strings`

**Values:** `["sync", "restore", "import"]`

**Default:** `["sync", "import"]`

Which commands trigger auto-backup.

## Advanced configuration

### scopes

**Type:** `array of objects`

**Default:** `undefined`

Hierarchical scopes for monorepo path-based rule application.

```yaml
scopes:
  - path: packages/frontend
    include:
      - "**/*.tsx"
    exclude:
      - "**/*.test.tsx"
    rulesets:
      - typescript.strict
      - react.hooks
```

### merge

**Type:** `object`

**Default:** `{ strategy: "deep", order: ["root", "path", "local"] }`

Merge strategy for multi-source rules.

```yaml
merge:
  strategy: deep
  order:
    - root
    - path
    - local
```

### performance

**Type:** `object`

**Default:** `{ max_file_size_mb: 10, max_directory_depth: 10 }`

Performance guardrails.

```yaml
performance:
  max_file_size_mb: 10
  max_directory_depth: 10
  ignore_patterns:
    - node_modules
    - dist
```

### git

**Type:** `object`

**Default:** `{ mode: "ignore" }`

Git integration settings.

```yaml
git:
  mode: ignore # ignore | commit | branch
  per_adapter:
    cursor: commit
    agents-md: ignore
```

## Example configurations

### Minimal (solo mode)

```yaml
exporters:
  - cursor
  - agents-md
```

### Solo with auto-pull

```yaml
exporters:
  - cursor
  - agents-md
sync:
  auto_pull: true
  primary_agent: cursor
  workflow_mode: native_format
```

### Team mode

```yaml
mode: team
exporters:
  - cursor
  - agents-md
modules:
  lockfile: true
  bundle: true
lockfile:
  mode: strict
sync:
  auto_pull: false
  workflow_mode: ir_source
```

### With agent detection

```yaml
exporters:
  - cursor
  - agents-md
detection:
  auto_enable: false
  ignored_agents:
    - windsurf
    - aider-md
sync:
  auto_pull: true
  primary_agent: cursor
```

## Validation

Config is validated against JSON Schema on load. Common errors:

**Invalid mode:**

```
Invalid mode "typo": must be one of solo, team, enterprise
```

**Missing exporters:**

```
At least one exporter must be configured
```

**Invalid sync.workflow_mode:**

```
sync.workflow_mode: must be one of auto, ir_source, native_format
```

## See also

- [CLI Reference](/docs/04-reference/cli-reference) - Command-line options
- [Workflows Guide](/docs/01-guides/01-workflows) - Choosing your workflow
- [Team Mode](/docs/03-concepts/team-mode) - Team-specific config
- [Solo Developer Guide](/docs/01-guides/04-solo-developer-guide) - Solo setup
