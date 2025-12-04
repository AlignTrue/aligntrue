---
title: "Config reference"
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

Operating mode that determines default behavior for lockfiles and bundles.

```yaml
mode: solo # or team, enterprise
```

### exporters

**Type:** `array of strings`

**Default:** `["cursor", "agents"]`

**Required:** Yes (at least one)

List of exporters to generate. Determines which agent files are created during sync.

```yaml
exporters:
  - cursor
  - agents
  - vscode-mcp
```

See [Agent Support](/docs/04-reference/agent-support) for all 43 available exporters.

### sources

**Type:** `array of objects`

**Default:** `[{ type: "local", path: ".aligntrue/rules" }]`

Where to load rules from. Supports local files and git repositories.

```yaml
sources:
  - type: local
    path: .aligntrue/rules
```

## Sync behavior

### sync

**Type:** `object`

**Default:** Mode-specific (see below)

Controls sync behavior and optional features.

```yaml
sync:
  scope_prefixing: "auto" # Scope prefixes in exports (off/auto/always)
  auto_manage_ignore_files: "prompt" # Auto-manage .gitignore and ignore files
  ignore_file_priority: "native" # How to prioritize ignore files
  custom_format_priority: {} # Custom format priorities for conflict resolution
```

#### sync.auto_manage_ignore_files

**Type:** `boolean` | `"prompt"`

**Default:** `"prompt"`

Automatically manage `.gitignore` and agent-specific ignore files to prevent duplicate rules across formats.

#### sync.ignore_file_priority

**Type:** `string`

**Values:** `"native"` | `"custom"`

**Default:** `"native"`

How to handle conflicting ignore file settings when multiple exporters have different formats.

#### sync.custom_format_priority

**Type:** `object`

**Default:** `{}`

Custom priority order for formats when conflicts occur. Example: `{ "agents-md": "cursor" }` makes Cursor format preferred over AGENTS.md.

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
    - aider
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
    - aider # Never prompt about Aider
```

**Managing ignored agents:**

```bash
# Add to ignored list
aligntrue exporters ignore windsurf

# Manually detect new agents (respects ignored list)
aligntrue exporters detect
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

**Default:** `{ retention_days: 30, minimum_keep: 3 }`

Automatic backup configuration for age-based retention.

```yaml
backup:
  retention_days: 30 # How many days to keep backups
  minimum_keep: 3 # Always keep at least this many recent
```

#### backup.retention_days

**Type:** `number`

**Default:** `30`

Age-based retention in days. Backups older than this are automatically deleted after sync.

- `0` - Never auto-delete (manual cleanup only)
- `30` - Default: delete backups older than 30 days
- `365` - Keep backups for one year

#### backup.minimum_keep

**Type:** `number`

**Default:** `3`

Safety floor: always keep at least this many of the most recent backups, regardless of age.

- Minimum: `1`
- Typical: `3-5`
- Protects against over-cleanup when syncing infrequently

#### backup.keep_count (removed)

**Type:** `number` (deprecated and removed)

Count-based retention. No longer used if `retention_days` is present. Kept for backward compatibility with existing configs.

### managed

**Type:** `object`

**Default:** `undefined`

**Team mode only.**

Controls which sections are protected as managed content and how they are documented in agent exports.

```yaml
managed:
  sections:
    - "Security Standards"
    - "Code Review Checklist"
  source_url: "https://github.com/company/rules"
```

#### managed.sections

**Type:** `array of strings`

List of section headings that are treated as team-managed. Each managed section is marked with `[TEAM-MANAGED]` warnings in exported files and cannot be edited directly without removing it from this list.

#### managed.source_url

**Type:** `string`

**Optional**

URL to the canonical repository or documentation for team-managed sections. Displayed to developers so they can find the source of truth.

**See also:** [Team guide](/docs/01-guides/02-team-guide)

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
  per_exporter:
    cursor: commit
    agents: ignore
```

## Example configurations

### Minimal (solo mode)

```yaml
exporters:
  - cursor
  - agents
```

### Team mode

```yaml
mode: team
exporters:
  - cursor
  - agents
modules:
  lockfile: true
  bundle: true
lockfile:
  mode: strict
```

### With agent detection

```yaml
exporters:
  - cursor
  - agents
detection:
  auto_enable: false
  ignored_agents:
    - windsurf
    - aider
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

## See also

- [CLI Reference](/docs/04-reference/cli-reference) - Command-line options
- [Sync behavior](/docs/03-concepts/sync-behavior) - Understanding sync flow
- [Team Mode](/docs/03-concepts/team-mode) - Team-specific config
- [Solo Developer Guide](/docs/01-guides/01-solo-developer-guide) - Solo setup
