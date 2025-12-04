---
title: Preventing duplicate rules
description: How AlignTrue prevents duplicate context when multiple exporters target formats consumable by the same agent
---

# Preventing duplicate rules

When you enable multiple exporters in AlignTrue, some agents may be able to read multiple output formats. This can lead to duplicate context being loaded into the agent's context window, wasting tokens and potentially creating conflicts.

AlignTrue automatically detects these situations and offers to manage agent-specific ignore files to prevent duplication.

## The problem

Consider this scenario:

```yaml
# .aligntrue/config.yaml
exporters:
  - cursor # Exports to .cursor/rules/*.mdc
  - agents # Exports to AGENTS.md
```

Cursor can read both `.mdc` files (its native format) and `AGENTS.md` files. Without ignore management, Cursor would load the same rules twice, wasting context tokens and potentially creating inconsistent behavior.

## How AlignTrue solves this

### Automatic detection

During `aligntrue init` and `aligntrue sync`, AlignTrue:

1. Analyzes your enabled exporters
2. Detects when multiple exporters target formats consumable by the same agent
3. Identifies the native format for each agent (e.g., `.mdc` for Cursor)
4. Offers to add non-native formats to the agent's ignore file

### Agent ignore files

AlignTrue manages ignore files for agents that support them:

| Agent           | Ignore file                | Supports nested | Notes                                               |
| --------------- | -------------------------- | --------------- | --------------------------------------------------- |
| Cursor          | `.cursorignore`            | Yes             | Also supports `.cursorindexingignore` (index-only). |
| Aider           | `.aiderignore`             | Yes             |                                                     |
| Firebase Studio | `.aiexclude`               | No              |                                                     |
| KiloCode        | `.kilocodeignore`          | No              |                                                     |
| Gemini CLI      | `.geminiignore`            | No              |                                                     |
| Crush           | `.crushignore`             | Yes             |                                                     |
| Warp            | `.warpindexingignore`      | No              |                                                     |
| Cline           | `.clineignore`             | No              |                                                     |
| Goose           | `.gooseignore`             | No              |                                                     |
| Junie           | `.aiignore`                | No              |                                                     |
| Augment Code    | `.augmentignore`           | No              |                                                     |
| Kiro            | `.kiroignore`              | No              |                                                     |
| Firebender      | `firebender.json` (config) | No              | Ignore patterns live in config, not a dotfile.      |

### Example: Cursor + AGENTS.md

When you enable both `cursor` and `agents` exporters, AlignTrue will:

1. Detect that Cursor can read both formats
2. Identify `.mdc` as Cursor's native format
3. Offer to add `AGENTS.md` to `.cursorignore`

Result:

```
# .cursorignore

# AlignTrue: Prevent duplicate context
# Managed by AlignTrue to prevent duplicate agent context
# Edit .aligntrue/config.yaml to change this behavior

AGENTS.md

# AlignTrue: End duplicate prevention
```

Now Cursor only reads `.cursor/rules/*.mdc` files, while other agents read `AGENTS.md`.

## Quick start

1. Enable two overlapping exporters and turn on automatic ignore management:

```yaml
# .aligntrue/config.yaml
exporters:
  - cursor
  - agents
sync:
  auto_manage_ignore_files: true
```

2. Run `aligntrue sync`.

Resulting files (root + scoped):

```
# Root
.cursorignore
AGENTS.md

# apps/web scope
apps/web/.cursorignore
apps/web/AGENTS.md
```

If you add `nested_location` in a rule frontmatter (for example `nested_location: apps/docs`), AlignTrue also writes ignore files at that nested path when the agent supports nested ignores.

## Configuration

### Auto-manage ignore files

Control automatic ignore file management:

```yaml
# .aligntrue/config.yaml
sync:
  auto_manage_ignore_files: prompt # or true, false
```

Options:

- `prompt` (default): Ask user during init and sync. In `--yes` or non-interactive mode, prompts are skipped and nothing is written unless you set `auto_manage_ignore_files: true`.
- `true`: Always manage ignore files automatically (works in `--yes` and CI).
- `false`: Never manage ignore files (AlignTrue leaves existing managed blocks untouched).

Per-exporter override: set `exporters.<agent>.ignore_file: false` to skip managing that agent’s ignore file. AlignTrue will remove its managed block from that ignore file on the next sync.

Mode summary:

| Mode   | Writes ignore files?                   | Prompts?                 | Works in `--yes`/CI?      |
| ------ | -------------------------------------- | ------------------------ | ------------------------- |
| prompt | Yes, but only after interactive accept | Yes (skipped in `--yes`) | No (unless set to `true`) |
| true   | Yes                                    | No                       | Yes                       |
| false  | No                                     | No                       | N/A                       |

### Format priority

By default, AlignTrue prioritizes each agent's native format. You can override this:

```yaml
# .aligntrue/config.yaml
sync:
  ignore_file_priority: custom
  custom_format_priority:
    cursor: agents # Use AGENTS.md instead of .mdc for Cursor
```

This adds `.cursor/rules/*.mdc` to `.cursorignore` instead of `AGENTS.md`, so Cursor consumes `AGENTS.md` only.

## Nested scopes

For monorepos with scoped exports, AlignTrue manages nested ignore files:

```yaml
# .aligntrue/config.yaml
scopes:
  - path: apps/web
    rulesets: ["base", "nextjs"]
  - path: packages/api
    rulesets: ["base", "node"]
```

With both `cursor` and `agents` exporters enabled, AlignTrue creates:

```
# Root
.cursorignore          # Ignores root AGENTS.md
AGENTS.md              # Root rules

# Nested scopes
apps/web/.cursorignore # Ignores apps/web/AGENTS.md
apps/web/AGENTS.md     # Web-specific rules

packages/api/.cursorignore # Ignores packages/api/AGENTS.md
packages/api/AGENTS.md     # API-specific rules
```

Each scope gets its own ignore file to prevent duplicate context at that level.

## Agents without ignore support

Some agents can read multiple formats but don't have dedicated ignore files:

- Claude (uses `.gitignore` only)
- Amazon Q (uses `.gitignore` only)
- Zed (uses `.gitignore` only)
- Qwen Code (uses `.gitignore` only)
- OpenCode (uses `.gitignore` only)
- Windsurf (no documented ignore mechanism)
- GitHub Copilot (no documented ignore mechanism)
- Jules (no documented ignore mechanism)
- Amp (no documented ignore mechanism)
- RooCode (no documented ignore mechanism)
- OpenHands (no dedicated ignore file yet)
- Trae AI (no documented ignore mechanism)

For these, prefer enabling a single exporter or use `.gitignore` if you must exclude a format globally.

For these agents, AlignTrue shows an informational warning:

```
⚠ Claude can read multiple formats (claude, agents) but has no known ignore mechanism.
  Uses .gitignore only, no dedicated ignore file.
  Consider disabling one exporter to avoid duplicate context.

ℹ Learn more: https://aligntrue.ai/docs/concepts/preventing-duplicate-rules
```

### Workarounds

1. **Disable one exporter**: Choose the format you prefer and disable the other.
2. **Use .gitignore**: Add unwanted formats to `.gitignore` (affects all tools).
3. **Accept duplication**: If context window size isn't a concern.

## Manual management

You can manually manage ignore files if you prefer:

```yaml
# .aligntrue/config.yaml
sync:
  auto_manage_ignore_files: false
```

Then create ignore files manually:

```
# .cursorignore
AGENTS.md
CLAUDE.md
```

AlignTrue will respect your manual configuration and won't modify these files.

## Removing managed patterns

To remove AlignTrue-managed patterns from ignore files:

1. Set `auto_manage_ignore_files: false` in config.
2. Edit the ignore file and remove the AlignTrue section:

```
# Remove this section:
# AlignTrue: Prevent duplicate context
...
# AlignTrue: End duplicate prevention
```

3. Run `aligntrue sync` to verify.

## Best practices

### For solo developers

- Use default `prompt` mode during init.
- For non-interactive runs (`--yes`), set `auto_manage_ignore_files: true` if you want AlignTrue to write ignore files.
- Focus on your preferred agent's native format.

### For teams

- Set `auto_manage_ignore_files: true` in team config.
- Commit ignore files to version control.
- Document format priorities in the team README.

### For monorepos

- Enable nested ignore file support for agents that support it.
- Use scoped exports to minimize context per scope.
- Test that each scope's agent only loads relevant rules; also check nested paths from `nested_location`.

## Troubleshooting

### Agent still loading duplicate rules

1. Verify ignore file exists:

   ```bash
   cat .cursorignore
   ```

2. Check ignore file syntax (should match `.gitignore` syntax).

3. If using scopes or `nested_location`, also check ignore files in those directories.

4. Restart your agent/IDE to reload ignore rules.

5. Check agent-specific settings (e.g., Cursor's "Hierarchical Cursor Ignore").

### Ignore file not being created

1. Check config:

   ```yaml
   sync:
     auto_manage_ignore_files: prompt # Should not be false
   ```

2. Verify multiple exporters are enabled:

   ```yaml
   exporters:
     - cursor
     - agents
   ```

3. Run sync in interactive mode (not `--yes`):
   ```bash
   aligntrue sync
   ```

### Want to change format priority

Update config and re-run sync:

```yaml
sync:
  ignore_file_priority: custom
  custom_format_priority:
    cursor: agents # Prefer AGENTS.md over .mdc
```

```bash
aligntrue sync
```

AlignTrue will update ignore files to match the new priority.

## Related documentation

- [Sync behavior](./sync-behavior)
- [Scopes](../02-customization/scopes)
- [Agent support](../04-reference/agent-support)
- [Configuration reference](../04-reference/config-reference)
