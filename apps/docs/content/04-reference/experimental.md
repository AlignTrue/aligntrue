---
title: "Experimental features"
description: "Unsupported advanced features for expert users. Use at your own risk."
---

# Experimental features

⚠️ **Warning:** Features on this page are experimental, unsupported, and may change or be removed. Only use if you understand the risks and limitations.

## Decentralized rule management

**Status:** Experimental | **Risk:** High | **Support:** None

### What it is

Allows multiple edit sources with automatic two-way sync between them. Instead of designating a single file as your edit source, you can specify multiple patterns and edits to any of them will be automatically detected and merged back to the internal rules.

### Why it's experimental

- **Complex merge conflicts:** When multiple files are edited between syncs, determining the correct merge order is non-deterministic
- **Race conditions with multiple editors:** Multiple developers editing different sources simultaneously can create unpredictable states
- **Difficult to debug:** When things go wrong, understanding which file caused the issue requires tracing multiple merge paths
- **Not recommended for teams:** Team mode with centralized rule management provides better conflict detection and approval workflows

### How to enable

In `.aligntrue/config.yaml`:

```yaml
sync:
  edit_source: ["AGENTS.md", ".cursor/rules/*.mdc"]
  experimental_two_way_sync: true
```

**Requirements:**

- `edit_source` must be an array (multiple patterns)
- `experimental_two_way_sync` must be explicitly set to `true`
- Without both, the system falls back to centralized (single-source) mode

### Configuration examples

**Multiple file formats:**

```yaml
sync:
  edit_source:
    - "AGENTS.md"
    - ".cursor/rules/*.mdc"
    - "CLAUDE.md"
  experimental_two_way_sync: true
```

**Multiple Cursor scope files:**

```yaml
sync:
  edit_source: [".cursor/rules/*.mdc"]
  experimental_two_way_sync: true
```

### When to use

- Advanced solo developers who want to edit multiple files simultaneously
- Experimental workflows where you're willing to accept instability
- You understand git merge conflicts and manual conflict resolution
- You have comprehensive backups and can recover from merge errors

### When NOT to use

- **Teams:** Use centralized rule management with team mode instead
- **Production projects:** Stability and predictability are critical
- **If you value simplicity:** Centralized (default) is simpler and more reliable
- **Mission-critical systems:** The experimental nature means bugs and edge cases may not be fixed

### Known limitations

- Merge order may vary between runs with identical edits
- Section deduplication can fail with certain heading patterns
- Performance degrades with large numbers of edited files
- Backup recovery is more complex with multiple source changes

## Future experimental features

Additional experimental features will be documented here as they're added.
