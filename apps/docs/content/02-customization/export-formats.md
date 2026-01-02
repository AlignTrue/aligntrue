---
title: Export formats
description: Configure native multi-file or AGENTS.md export format per agent
---

# Export formats

Write rules in `.aligntrue/rules/*.md`—that's the source of truth. Export formats only control how AlignTrue renders agent outputs:

- **Native format**: Agent-specific multi-file structure (e.g., `.cursor/rules/*.mdc`)
- **AGENTS.md format**: Universal markdown file read by many agents

## Why choose a format?

**Native format (default):**

- Preserves your rule file organization
- One file per rule in `.aligntrue/rules/` maps to one file in agent folder
- Best for agents with native multi-file support
- Allows agent-specific features (Cursor `alwaysApply`, etc.)

**AGENTS.md format:**

- Single consolidated file at repo root
- Supported by many agents (Copilot, Claude, Aider, etc.)
- Simpler for single-agent projects
- Good fallback if native format has issues

## Configuring format per agent

In `.aligntrue/config.yaml`, use the object syntax for exporters:

```yaml
exporters:
  cursor:
    format: native # Uses .cursor/rules/*.mdc
  amazonq:
    format: agents-md # Uses AGENTS.md instead of .amazonq/rules/*.md
  agents: {} # AGENTS.md exporter (no format choice needed)
```

## Default behavior

When you don't specify a format, AlignTrue picks the first match in this order:

1. If existing agent files are detected, reuse that format (e.g., `.cursor/rules/*.mdc`)
2. Otherwise, if the agent supports native, use native
3. Otherwise, use AGENTS.md

Example: For Cursor, if `.cursor/rules/` already exists, AlignTrue keeps using native; if not, it chooses native by default because Cursor supports it.

## Agents supporting multiple formats

These agents support both native and AGENTS.md:

| Agent        | Native Format          | AGENTS.md |
| ------------ | ---------------------- | --------- |
| Cursor       | `.cursor/rules/*.mdc`  | Yes       |
| Amazon Q     | `.amazonq/rules/*.md`  | Yes       |
| KiloCode     | `.kilocode/rules/*.md` | Yes       |
| Augment Code | `.augment/rules/*.md`  | Yes       |
| Kiro         | `.kiro/steering/*.md`  | Yes       |
| Trae AI      | `.trae/rules/*.md`     | Yes       |

Agents like Copilot, Claude, and Aider currently only support AGENTS.md. For the latest list, see the [agent support matrix](/docs/04-reference/agent-support).

## Switching formats

When you change an agent's format, the next `aligntrue sync` will:

1. Back up old files to `.aligntrue/.backups/files/<timestamp>/`
2. Remove old-format files according to your cleanup mode
3. Generate new-format files
4. Log the backup location

### Cleanup modes

The `sync.cleanup` setting controls what gets removed:

```yaml
sync:
  cleanup: all # Default: remove all files matching agent patterns
```

Options:

- **`all`** (default): Removes all files matching agent patterns (e.g., all `.cursor/rules/*.mdc`)
- **`managed`**: Only removes files previously created by AlignTrue

Use `managed` if you maintain custom agent files alongside AlignTrue outputs; keep `all` for the cleanest state.

## Example: Multi-agent setup

A common setup with different formats:

```yaml
exporters:
  cursor:
    format: native # Full control via .cursor/rules/
  claude:
    format: agents-md # Claude reads AGENTS.md
  amazonq:
    format: agents-md # Use AGENTS.md for Q too
```

This creates:

- `.cursor/rules/*.mdc` for Cursor (one file per rule)
- `AGENTS.md` for Claude and Amazon Q (consolidated)

## Format detection on init

When running `aligntrue init`, AlignTrue:

1. Detects existing agent files in your workspace
2. Sets format based on what's found
3. Shows a message if agents support multiple formats

You can override the detected choice by editing `.aligntrue/config.yaml` and rerunning `aligntrue sync`.

## Troubleshooting

### Agent not reading rules

1. Check the format setting matches what the agent expects
2. Verify files were generated in the correct location
3. Run `aligntrue sync --verbose` to see what was written

### Duplicate rules in AGENTS.md

If an agent is configured for native format but still appears in AGENTS.md:

1. Check if another exporter is set to `agents-md`
2. Verify the agent name in config matches exactly

### Old files not cleaned up

If old format files remain after switching:

1. Check `sync.cleanup` setting
2. Run sync again with `--force`
3. Manually remove files if needed (backups are in `.aligntrue/.backups/files/`)

## Related documentation

- [Per-rule targeting](/docs/02-customization/per-rule-targeting) - Control which agents receive which rules
- [Agent support](/docs/04-reference/agent-support) - Full compatibility matrix
- [Multi-file organization](/docs/02-customization/multi-file-organization) - Organizing rules across files
