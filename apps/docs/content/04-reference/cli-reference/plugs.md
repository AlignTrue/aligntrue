# Plugs commands

Manage dynamic configuration slots and fills in rule aligns.

## `aligntrue plugs`

Show plug status (list + resolve + validate).

**Usage:**

```bash
aligntrue plugs [--config <path>]
```

**Options:**

| Flag              | Description             | Default                  |
| ----------------- | ----------------------- | ------------------------ |
| `--config <path>` | Custom config file path | `.aligntrue/config.yaml` |

**Behavior:**

- Fills only come from `.aligntrue/config.yaml` (IR fills are ignored)
- Supported formats: `command`, `text` (`file` and `url` are deprecated and treated as `text`)
- Sync fails if required plugs are unresolved

---

## `aligntrue plugs set`

Set a repo-local fill value with validation.

**Usage:**

```bash
aligntrue plugs set <key> <value> [--config <path>]
```

**Arguments:**

- `key` - Plug slot key (e.g., `test.cmd`, `author.name`)
- `value` - Fill value (single-line string)

**Options:**

| Flag              | Description             | Default                  |
| ----------------- | ----------------------- | ------------------------ |
| `--config <path>` | Custom config file path | `.aligntrue/config.yaml` |

**Validation:**

- `command` - Single-line command, no environment variable interpolation (except `CI=true`)
- `text` (and deprecated `file`/`url`) - Any single-line string

**Examples:**

```bash
aligntrue plugs set test.cmd "pnpm test"
aligntrue plugs set author.name "Jane Smith"
```

---

## `aligntrue plugs unset`

Remove a repo-local fill value.

**Usage:**

```bash
aligntrue plugs unset <key> [--config <path>]
```

**Arguments:**

- `key` - Plug slot key

**Example:**

```bash
aligntrue plugs unset test.cmd
```
