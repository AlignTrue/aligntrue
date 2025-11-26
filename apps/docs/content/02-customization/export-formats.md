---
title: Export formats
description: Configure native multi-file or AGENTS.md export format per agent
---

# Export formats

Some AI agents support multiple export formats. AlignTrue lets you choose between:

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

When you don't specify a format:

1. If existing agent files are detected, AlignTrue uses that format
2. If no files exist and agent supports native, defaults to native
3. If agent only supports AGENTS.md, uses AGENTS.md

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

Agents like Copilot, Claude, and Aider only support AGENTS.md.

## Switching formats

When you change an agent's format, AlignTrue:

1. Backs up old files to `overwritten-files/<timestamp>/`
2. Removes old format files
3. Generates new format files
4. Notifies you of the backup location

### Cleanup modes

The `sync.cleanup` setting controls what gets removed:

```yaml
sync:
  cleanup: all # Default: remove all files matching agent patterns
```

Options:

- **`all`** (default): Removes all files matching agent patterns (e.g., all `.cursor/rules/*.mdc`)
- **`managed`**: Only removes files previously created by AlignTrue

Use `managed` if you have custom agent files you want to keep.

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

You can then adjust formats in `config.yaml`.

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
3. Manually remove files if needed (they're in `overwritten-files/` as backup)

## Related documentation

- [Per-rule targeting](/docs/02-customization/per-rule-targeting) - Control which agents receive which rules
- [Agent support](/docs/04-reference/agent-support) - Full compatibility matrix
- [Multi-file organization](/docs/02-customization/multi-file-organization) - Organizing rules across files
