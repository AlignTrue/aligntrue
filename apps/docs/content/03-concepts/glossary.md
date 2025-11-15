---
title: Glossary
description: AlignTrue terminology and key concepts explained
---

# Glossary

Essential terms and concepts used throughout AlignTrue documentation and CLI.

## Core concepts

### Agents

AI coding assistants that AlignTrue exports rules to. Examples include:

- **Cursor** (.mdc files)
- **GitHub Copilot** (AGENTS.md format)
- **Claude Code** (AGENTS.md + Claude-specific formats)
- **Aider**, **Windsurf**, **VS Code MCP**, and 24+ others

AlignTrue supports **28+ agents** through **43 specialized exporters**, each optimized for that agent's native format.

**Related:** [Agent Support](/docs/04-reference/agent-support)

### Rules

Individual guidelines that specify how AI agents should behave in your project. Each rule includes:

- **ID** - Unique identifier (e.g., `require-tests`, `no-any-type`)
- **Severity** - `error`, `warn`, or `info`
- **Applies to** - Glob patterns for which files the rule applies to
- **Guidance** - Human-readable explanation for AI agents
- **Optional:** Checks, autofixes, and vendor-specific metadata

**Example:** "All TypeScript files must have strict mode enabled"

**Related:** [Align Spec](/docs/04-reference/features), [Natural Markdown Sections](/docs/04-reference/natural-markdown-sections)

### Packs

Collections of related rules organized around a theme or technology stack. Packs are the shareable unit of rule sets.

**Examples of packs:**

- `testing.yaml` - Testing best practices
- `typescript.yaml` - TypeScript strict mode conventions
- `nextjs_app_router.yaml` - Next.js App Router patterns

Packs can be:

- Stored locally
- Shared via GitHub
- Referenced in your AlignTrue configuration

**Related:** [Creating Packs](/docs/06-contributing/creating-packs)

### Aligns

**Note:** "Aligns" is the formal specification name. In everyday use, we call these **"packs"** (e.g., "testing pack", "TypeScript pack").

An Align/pack is a YAML document that combines metadata with a collection of rules:

- **ID** - Unique identifier for the pack
- **Version** - Semantic versioning (e.g., `1.0.0`)
- **Summary** - Brief description
- **Rules** - Array of rule objects
- **Optional metadata** - Owner, source, tags, scope, etc.

**Related:** [Align Spec v1](https://github.com/AlignTrue/aligntrue/blob/main/spec/align-spec-v1.md), [Creating Packs](/docs/06-contributing/creating-packs)

---

## File types & formats

### AGENTS.md

The primary user-editable file where you write and maintain rules in markdown format. Contains:

- Human-readable rule descriptions
- Natural markdown sections with YAML frontmatter
- Optional narrative sections explaining your project's standards

`AGENTS.md` is where you write your rules. AlignTrue automatically converts them to other agent formats.

**Related:** [Natural Markdown Sections](/docs/04-reference/natural-markdown-sections)

### Intermediate representation (IR)

The internal YAML format that AlignTrue uses internally. Stored in `.aligntrue/.rules.yaml`.

**Key characteristics:**

- Auto-generated from AGENTS.md or imported from agent files
- Machine-parseable, pure YAML (no markdown)
- Used internally for validation and export
- **Do not edit directly** - always edit AGENTS.md or agent files instead

The IR sits between user-editable files and exported agent formats:

```
AGENTS.md (you edit) → IR (.rules.yaml - auto-generated) → Agent exports (.mdc, MCP configs, etc.)
```

**Important:** Think of `.aligntrue/.rules.yaml` like a lock file or build artifact - it's generated automatically and shouldn't be manually edited.

### Cursor rules (.mdc)

Cursor's native rule format stored in `.cursor/rules/*.mdc`. Files use YAML frontmatter with markdown content optimized for Cursor's inline rule engine.

AlignTrue automatically exports your rules to `.mdc` format when you run `aligntrue sync`.

**Related:** [Cursor documentation](https://docs.cursor.sh)

### MCP Configuration

Model Context Protocol configuration stored in `.vscode/mcp.json` for VS Code and other MCP-compatible agents. Allows agents to access external tools and resources.

AlignTrue exports MCP server configurations automatically for compatible agents.

**Related:** [Model Context Protocol](https://modelcontextprotocol.io)

---

## Operations

### Sync

The process of converting and pushing your rules to all configured agent formats. Ensures all agents stay aligned with your current rule set.

**Command:** `aligntrue sync`

**What happens:**

1. Loads your rules from AGENTS.md or `.aligntrue/.rules.yaml`
2. Validates them against the Align Spec
3. Exports to all configured agent formats (.mdc, AGENTS.md, MCP configs, etc.)
4. Writes updated files to disk

**Related:** [Sync behavior](/docs/03-concepts/sync-behavior)

### Export

Converting rules from the IR (Intermediate Representation) into a specific agent's native format. AlignTrue uses **43 specialized exporters** to handle 28+ different agent formats.

Each exporter:

- Preserves rule semantics where possible
- Adapts formatting to agent requirements
- Adds **fidelity notes** when parity isn't exact

### Auto-pull

In solo mode, automatically imports any changes you made directly in agent files (e.g., `.cursor/rules/*.mdc`) back into AGENTS.md before syncing.

**Behavior:**

- Enabled by default in solo mode
- Disabled in team mode (to prevent accidental overwrites)
- Can be disabled with `aligntrue sync --no-auto-pull`

This enables two-way sync: edit either AGENTS.md or agent files, and changes propagate to both.

**Related:** [Sync behavior](/docs/03-concepts/sync-behavior)

### Bundle

Merging rules from multiple packs/sources into a single coherent rule set (team mode only).

**When bundling happens:**

- Specified in `.aligntrue/config.yaml` under `sources`
- Multiple packs are resolved with precedence rules
- Dependencies are resolved recursively
- Final bundle is deterministically merged

**Related:** [Team mode](/docs/03-concepts/team-mode)

### Lockfile

A deterministic snapshot of your complete rule set with cryptographic hashes (team mode only). File: `.aligntrue.lock.json`

**Purpose:**

- Ensures reproducible deployments across machines
- Enables drift detection (detects when rules diverge)
- Pins exact versions for team collaboration
- Includes canonical SHA-256 hashes for integrity verification

Lockfiles are generated via `aligntrue sync` or `aligntrue lock` in team mode.

**Related:** [Team mode](/docs/03-concepts/team-mode), [Drift detection](/docs/03-concepts/drift-detection)

### Drift detection

Comparing your current rule state against a committed lockfile to detect when rules have changed (team mode only).

**Drift scenarios:**

- A pack was updated but lockfile wasn't regenerated
- Someone manually edited `.aligntrue/.rules.yaml`
- A rule source is no longer accessible
- A team member pushed different rules than the lockfile

**Command:** `aligntrue check --drift` (in team mode)

**Related:** [Drift detection](/docs/03-concepts/drift-detection)

---

## Configuration & Modes

### Solo mode

Default mode for individual developers. Optimized for fast iteration with minimal ceremony.

**Characteristics:**

- No lockfile required
- No bundle overhead
- Simple rule management
- Auto-pull enabled by default
- Fast sync operations

**Use case:** Single developer, single project, local rules only

**Related:** [Solo developer guide](/docs/01-guides/04-solo-developer-guide)

### Team mode

Collaborative mode with reproducibility guarantees and approval workflows.

**Characteristics:**

- Lockfile generation for determinism
- Bundle support for multi-source rules
- Allow list validation for approved sources
- Drift detection enabled
- Auto-pull disabled by default

**Enable with:** `aligntrue team enable`

**Related:** [Team mode](/docs/03-concepts/team-mode), [Team guide](/docs/01-guides/05-team-guide)

### Allow list

In team mode, a list of approved sources (git repos, URLs) from which rules can be pulled. Prevents unauthorized rule additions and ensures security.

**File:** `.aligntrue.allow`

**Use:** Ensures only vetted, team-approved rule sources are used

**Related:** [Team mode](/docs/03-concepts/team-mode)

### Configuration file

Main AlignTrue configuration stored in `.aligntrue/config.yaml`. Defines:

- **Mode** - `solo` or `team`
- **Sources** - Where rules come from (local files, git repositories)
- **Exporters** - Which agent formats to export to
- **Scopes** - Path-based rule application (monorepos)
- **Modules** - Feature toggles (lockfile, bundle, auto-pull)

**Related:** [Config reference](/docs/04-reference/config-reference)

---

## Advanced features

### Vendor bags

Optional agent-specific metadata stored under `vendor.<agent-name>` that preserves information during round-trip conversions.

**Purpose:**

- Store agent-specific hints that don't map to standard rule fields
- Enable lossless IR ↔ agent conversions
- Prevent loss of fidelity when syncing to different formats

**Example:**

```yaml
vendor:
  cursor:
    ai_hint: "Suggest test scaffolding with vitest"
    session_id: "xyz"
  _meta:
    volatile: ["cursor.session_id"] # Excluded from hashing
```

**Related:** [Vendor bags](/docs/04-reference/vendor-bags)

### Overlays

Customizations applied on top of third-party packs without forking them. Allows safe, maintainable modifications to upstream rule sets.

**Features:**

- Override specific rules
- Add new rules
- Change severity levels
- Maintain sync with upstream versions

**Related:** [Overlays](/docs/02-customization/overlays)

### Scopes

Path-based rule application for monorepos. Allows different rules to apply to different directories or projects within a single repository.

**Use cases:**

- Backend rules for `packages/api/`
- Frontend rules for `apps/web/`
- Shared infrastructure rules for root level

**Related:** [Scopes](/docs/02-customization/scopes)

### Plugs

Parameterized rule templates that accept configuration inputs. (Plugs system)

**Purpose:**

- Create reusable rule templates
- Accept configuration via `fills` in overlays
- Support community-contributed rule templates

**Related:** [Plugs](/docs/02-customization/plugs)

---

## Related documentation

- **Getting started:** [Quickstart guide](/docs/00-getting-started/00-quickstart)
- **Concepts:** [Sync behavior](/docs/03-concepts/sync-behavior), [Team mode](/docs/03-concepts/team-mode), [Drift detection](/docs/03-concepts/drift-detection)
- **How-to guides:** [Solo developer guide](/docs/01-guides/04-solo-developer-guide), [Team guide](/docs/01-guides/05-team-guide)
- **Reference:** [CLI reference](/docs/04-reference/cli-reference), [Config reference](/docs/04-reference/config-reference), [Agent support](/docs/04-reference/agent-support)
