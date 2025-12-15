---
title: "Config reference"
description: "Complete reference for all configuration options with examples, defaults, and tips."
---

# Configuration reference

Complete reference for `.aligntrue/config.yaml` configuration options.

## Overview

AlignTrue uses YAML configuration files in the `.aligntrue/` directory.

**Format:** YAML (validated against JSON Schema on load)

**Mode-specific defaults:** Many fields have different defaults based on mode (solo vs team).

### Solo mode (single file)

In solo mode, all configuration is in one file:

- **`config.yaml`** - All settings (committed to git)

### Team mode (two files)

In team mode, configuration is split into two files:

| File               | Purpose           | Git status |
| ------------------ | ----------------- | ---------- |
| `config.team.yaml` | Team settings     | Committed  |
| `config.yaml`      | Personal settings | Gitignored |

**Why two files?**

- Personal settings (like `remotes.personal`) don't cause merge conflicts
- Local overrides (like `git.mode`) don't affect team behavior
- Team settings are reviewed via PR
- Easy to toggle team mode on/off without losing settings

**Field ownership:**

| Field                   | Config file   | Notes                               |
| ----------------------- | ------------- | ----------------------------------- |
| `mode`                  | Team only     | Determines mode                     |
| `modules.lockfile`      | Team only     | Team-controlled                     |
| `lockfile.*`            | Team only     | Team-controlled                     |
| `remotes.personal`      | Personal only | Individual setting                  |
| `sources`, `exporters`  | Shared        | Merged additively (team + personal) |
| `git`, `overlays`, etc. | Shared        | Personal overrides team for scalars |

**Merging behavior:**

- **Arrays (sources, exporters):** Team + personal combined
- **Scalars (git.mode, etc.):** Personal overrides team locally
- **Lockfile:** Generated from team config only

**Team enable defaults:**

- `sources` are moved into `config.team.yaml` (team-owned inputs).
- `exporters` stay in personal `config.yaml` by default; team can add a shared baseline if desired. Final exporters are the union of team + personal.

### remotes (routing in team mode)

**Type:** `object`

Controls where rules are pushed. Remotes push during `aligntrue sync` by default unless you set `auto: false` on a remote; use `aligntrue remotes push` for explicit/manual pushes.

| Key                | Used for                   | Scope                 | Config file                       |
| ------------------ | -------------------------- | --------------------- | --------------------------------- |
| `remotes.personal` | Personal rules             | `scope: personal`     | Personal                          |
| `remotes.shared`   | Shared/public rules        | `scope: shared`       | Team (or personal if you publish) |
| `remotes.custom[]` | Extra pattern-based copies | Additive to any scope | Team + personal (concatenated)    |

Rules have a single `scope` (`team`, `personal`, or `shared`). To send a rule to multiple remotes, keep one scope and add `remotes.custom[]` entries with `include` patterns. Solo mode routes all rules to `remotes.personal` (unless `scope: shared` and a shared remote exists); team/enterprise use scope-based routing. For routing details, see [Rule sharing & privacy](/docs/01-guides/06-rule-sharing-privacy).

## Core fields

### mode

**Type:** `string`

**Values:** `"solo"` | `"team"` | `"enterprise"`

**Default:** `"solo"`

**Location:** `config.team.yaml` in team mode, `config.yaml` in solo mode

Operating mode that determines default behavior for lockfiles and bundles.

```yaml
# Solo mode (config.yaml)
mode: solo

# Team mode (config.team.yaml)
mode: team
```

In team mode, mode is determined by the presence of `config.team.yaml`, not by a field in `config.yaml`.

### exporters

**Type:** `array of strings`

**Default:** `["cursor", "agents"]` (auto-filled if omitted)

**Required:** Yes (at least one)

List of exporters to generate. Determines which agent files are created during sync.

```yaml
exporters:
  - cursor
  - agents
  - vscode-mcp
```

See [Agent Support](/docs/04-reference/agent-support) for all 50 available exporters.

**Team mode behavior:** Exporters are shared/merged, but enabling team mode does **not** move personal exporters into `config.team.yaml`. Add exporters to the team file only when the team wants a standard baseline; personal config can still add more.

### sources

**Type:** `array of objects`

**Default:** `[{ type: "local", path: ".aligntrue/rules" }]`

Where to load rules from. Supports local files and git repositories.

> Pack manifests are no longer resolved. GitHub sources import markdown/XML files directly. Use Align packs for bundling multiple rules (`aligntrue add <pack-id>`); see [Align packs](/docs/03-concepts/align-packs).

```yaml
sources:
  - type: local
    path: .aligntrue/rules
```

## Sync behavior

### sync

**Type:** `object`

Controls sync behavior and optional features.

```yaml
sync:
  source_order: [] # Optional rule order by basename
  source_markers: auto # auto | always | never
  content_mode: auto # auto | inline | links
  auto_manage_ignore_files: prompt # prompt | true | false (defaults effectively to true)
  cleanup: all # all | managed
```

#### sync.source_order

Custom ordering of rule files by basename. When unset, rules are processed alphabetically.

#### sync.source_markers

`auto` (default) shows source markers only when multiple sources are merged; `always` forces markers; `never` omits them.

#### sync.content_mode

`auto` (default) inlines a single rule and uses links when there are multiple; `inline` always embeds; `links` always links.

#### sync.auto_manage_ignore_files

`prompt` asks interactively before writing ignore files; `true` always writes; `false` never writes. If unset, CLI behavior defaults to `true` (no prompt).

#### sync.cleanup

`all` (default) removes all files matching agent patterns when formats change; `managed` removes only files previously created by AlignTrue.

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

- Solo: lockfile `false`, checks `true`, mcp `false`
- Team: lockfile `true`, checks `true`, mcp `false`
- Enterprise: lockfile `true`, checks `true`, mcp `true`

```yaml
modules:
  lockfile: false # Generate .aligntrue/lock.json
  checks: true # Enable machine-checkable rules
  mcp: false # Enable MCP server
```

### lockfile (deprecated)

**Note:** The `lockfile.mode` setting has been removed. Lockfile is now enabled via `modules.lockfile: true` in team mode.

Drift enforcement happens in CI using `aligntrue drift --gates`.

```yaml
# Old (deprecated):
# lockfile:
#   mode: soft

# New approach:
modules:
  lockfile: true # Enable lockfile generation

# CI enforcement:
# aligntrue drift --gates  # Fails CI if drift detected
```

Lockfile v2 stores `version` and `bundle_hash` (team rules + `config.team.yaml`). Use `aligntrue drift` to check for drift.

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
  files:
    - AGENTS.md
  sections:
    - "Security Standards"
    - "Code Review Checklist"
  source_url: "https://github.com/company/rules"
```

#### managed.files

List of full file paths to protect from direct edits (e.g., `AGENTS.md`).

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

**Defaults:**

- `mode`: `ignore` (solo/team), `commit` (enterprise)
- `branch_check_interval`: `86400` seconds
- `tag_check_interval`: `604800` seconds
- `offline_fallback`: `true`
- `auto_gitignore`: `auto`

Git integration settings.

```yaml
git:
  mode: ignore # ignore | commit | branch
  per_exporter:
    cursor: commit
    agents: ignore
  branch_check_interval: 86400
  tag_check_interval: 604800
  offline_fallback: true
  auto_gitignore: auto # auto | always | never
```

**Behavior:**

- Applies to generated agent exports (`.cursor/rules`, `AGENTS.md`, etc.). Solo/team default to `ignore` to avoid PR noise; enterprise defaults to `commit` for auditability.
- Agents still work when exports are gitignored as long as `aligntrue sync` runs (locally or in CI).
- Use `per_exporter` overrides when a specific export must be tracked (e.g., commit `AGENTS.md`, ignore `.cursor/rules/`).
- Rules with `gitignore: true` in frontmatter create a dedicated managed block in `.gitignore` that lists only their exported files (e.g., `.cursor/rules/guardrails.mdc`), regardless of `git.mode`. Use this for selective non-commit of sensitive rules while keeping other exports tracked.

### export

**Type:** `object`

Controls mode hints in non-Cursor formats and token limits.

```yaml
export:
  mode_hints:
    default: metadata_only # off | metadata_only | hints | native
    overrides:
      agents: off
  max_hint_blocks: 20
  max_hint_tokens: 1600
```

### remotes

**Type:** `object`

Configure pushing `.aligntrue/rules/` to git repositories by scope and pattern.

```yaml
remotes:
  personal: git@github.com:user/personal-rules.git
  shared:
    url: git@github.com:org/shared-rules.git
    branch: main
    # Optional: set auto: false to require manual push
  custom:
    - id: security
      url: git@github.com:org/security-rules.git
      include:
        - security/**
```

### overlays

**Type:** `object`

Declarative modifications to upstream rules. Conflicts fail by default.

```yaml
overlays:
  overrides:
    - selector: "rule[id=authn]"
      set:
        severity: MUST
# allow conflicts (last-writer-wins)
allow_overlay_conflicts: false
```

**Notes:**

- Supported selectors: `rule[id=...]`, `sections[index]` (property/heading selectors are deprecated)
- Use `set: { key: null }` to remove properties (`remove` is deprecated)
- To allow conflicts instead of failing, set `allow_overlay_conflicts: true` or pass `--allow-overlay-conflicts`

### plugs

**Type:** `object`

Template slot fills for rules. Fills are config-only; sync fails if required plugs are missing.

```yaml
plugs:
  fills:
    service_name: checkout
    test.cmd: "pnpm test" # required plugs must be set
```

**Notes:**

- Supported formats: `command`, `text` (`file`/`url` are deprecated and treated as `text`)

### approval

**Type:** `object`

Approval workflow for team mode.

```yaml
approval:
  internal: pr_approval
  external: pr_approval
```

### mcp

**Type:** `object`

Model Context Protocol server definitions.

```yaml
mcp:
  servers:
    - name: aligntrue
      command: npx
      args:
        - "@aligntrue/mcp-server"
      env:
        NODE_ENV: production
      disabled: false
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
