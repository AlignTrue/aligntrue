# Plugs commands

Manage dynamic configuration slots and fills in rule aligns. Plugs allow template-based customization for stack-specific values.

## `aligntrue plugs list`

List all declared slots, current fills, and resolution status.

**Usage:**

```bash
aligntrue plugs list [--config <path>]
```

**Options:**

| Flag              | Description            | Default     |
| ----------------- | ---------------------- | ----------- |
| `--config <path>` | Custom rules file path | `AGENTS.md` |

**What it shows:**

- Declared slots with descriptions, formats, and requirements
- Current fill values for each slot
- Resolution status (filled, required, optional)
- Orphan fills (fills without declared slots)
- Summary of required vs filled slots

**Example output:**

```
📌 Plugs Audit

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Slots declared:

  test.cmd
    Description: Command to run the project's tests
    Format:      command
    Required:    true
    Example:     pytest -q
    Status:      ✓ filled
    Fill:        pnpm test

  docs.url
    Description: Documentation website URL
    Format:      url
    Required:    false
    Example:     https://example.com/docs
    Status:      ○ optional

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Summary:
  Total slots:      2
  Required slots:   1
  Filled required:  1
```

**Exit codes:**

- `0` - Success
- `1` - Rules file not found or parsing error

**See also:** [Plugs Guide](/docs/02-customization/plugs) for detailed plug usage

---

## `aligntrue plugs resolve`

Preview plug resolution with current fills (dry-run mode).

**Usage:**

```bash
aligntrue plugs resolve [--config <path>] [--dry-run]
```

**Options:**

| Flag              | Description                       | Default     |
| ----------------- | --------------------------------- | ----------- |
| `--config <path>` | Custom rules file path            | `AGENTS.md` |
| `--dry-run`       | Preview without writing (default) | `true`      |

**What it does:**

1. Loads rules from config file
2. Resolves all `[[plug:key]]` references with current fills
3. Inserts TODO blocks for unresolved required plugs
4. Displays resolved text and unresolved plug list
5. Does NOT write changes (preview only)

**Example output:**

```
✓ Resolved 2 plugs

Resolved text preview:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run tests with: pnpm test

Documentation: https://example.com/docs

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Unresolved required plugs: 0
```

**With unresolved required plugs:**

```
⚠ Unresolved required plugs: 1
  - author.name

Resolved text will contain TODO blocks:

TODO(plug:author.name): Provide a value for this plug.
Examples: John Doe
```

**Exit codes:**

- `0` - Success
- `1` - Rules file not found or parsing error

**See also:** [Plugs Guide](/docs/02-customization/plugs) for resolution algorithm

---

## `aligntrue plugs set`

Set a repo-local fill value with format validation.

**Usage:**

```bash
aligntrue plugs set <key> <value> [--config <path>]
```

**Arguments:**

- `key` - Plug slot key (e.g., `test.cmd`, `author.name`)
- `value` - Fill value (single-line string)

**Options:**

| Flag              | Description            | Default     |
| ----------------- | ---------------------- | ----------- |
| `--config <path>` | Custom rules file path | `AGENTS.md` |

**What it does:**

1. Validates key exists as declared slot
2. Validates value matches slot format (command, text, file, url)
3. Writes fill to `plugs.fills` section in rules file
4. Preserves existing file structure and formatting

**Format validation:**

- `command` - Single-line command, no environment variable interpolation (except `CI=true`)
- `text` - Any single-line UTF-8 string
- `file` - Repo-relative POSIX path, no `..` segments, no absolute paths
- `url` - Must start with `http://` or `https://`

**Examples:**

```bash
# Set test command
aligntrue plugs set test.cmd "pnpm test"

# Set author name
aligntrue plugs set author.name "Jane Smith"

# Set documentation URL
aligntrue plugs set docs.url "https://docs.example.com"

# Set relative file path
aligntrue plugs set config.file "config/settings.json"
```

**Example output:**

```
✓ Set plug fill: test.cmd = "pnpm test"

Updated: AGENTS.md

Next step:
  Run: aligntrue sync
```

**Exit codes:**

- `0` - Success
- `1` - Validation error (invalid key, format mismatch, file not found)

**Common errors:**

```
✗ Slot not declared: unknown.key
  Hint: Run 'aligntrue plugs list' to see declared slots

✗ Format validation failed: file
  Value contains '..' segments (not allowed)
  Hint: Use repo-relative paths without parent directory traversal

✗ Format validation failed: url
  Value must start with http:// or https://
```

**See also:** [Plugs Guide](/docs/02-customization/plugs) for format requirements
