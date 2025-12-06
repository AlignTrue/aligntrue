# Overlay commands

Commands for customizing third-party aligns without forking.

## `aligntrue override`

Show overlays status and diff (default).

**Usage:**

```bash
aligntrue override [--allow-overlay-conflicts]
```

**Behavior:**

- Applies overlays and shows the resulting diff
- Fails on overlay conflicts by default; use `--allow-overlay-conflicts` to allow last-writer-wins

---

## `aligntrue override add`

Create a new overlay.

**Usage:**

```bash
aligntrue override add --selector <value> [--set <key=value>] [--config <path>]
```

**Arguments:**

- `--selector` - `rule[id=...]` or `sections[index]` (other selector types are deprecated)
- `--set` - Key/value pairs (dot notation supported). Use `key=null` to remove a property.

**Notes:**

- `--remove` is deprecated; prefer `--set key=null`
- `file`/`url` formats are not relevant here; values are applied as-is

**Example:**

```bash
aligntrue override add \
  --selector 'rule[id=no-console-log]' \
  --set severity=error \
  --set autofix=null
```

---

## `aligntrue override selectors`

List available selectors from the current IR.

**Usage:**

```bash
aligntrue override selectors
```
