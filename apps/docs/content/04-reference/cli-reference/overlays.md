# Overlay commands

Commands for customizing third-party aligns without forking. Available in all modes.

## `aligntrue override add`

Create a new overlay to customize rules without forking.

**Usage:**

```bash
aligntrue override add [options]
```

**Options:**

| Flag                  | Description                                                                    | Required |
| --------------------- | ------------------------------------------------------------------------------ | -------- |
| `--selector <string>` | Selector string (rule[id=...], sections[heading=...], property.path, array[0]) | Yes      |
| `--set <key=value>`   | Set property (repeatable, supports dot notation)                               | No\*     |
| `--remove <key>`      | Remove property (repeatable)                                                   | No\*     |
| `--config <path>`     | Custom config file path                                                        | No       |

\*At least one of `--set` or `--remove` is required

**Selector matching:**

- `rule[id=...]` - Match by rule fingerprint (exact match)
- `sections[heading=...]` - Match by section heading (case-insensitive)
- `property.path` - Match by property path
- `array[0]` - Match by array index

Section heading selectors use case-insensitive matching for better UX. For example, `sections[heading=Security]` will match a section with heading "security", "SECURITY", or "Security".

**What it does:**

1. Validates selector syntax
2. Parses set/remove operations
3. Adds overlay to `overlays.overrides[]` in config
4. Writes config atomically
5. Provides next steps (run `aligntrue sync`)

**Examples:**

```bash
# Change severity for specific rule
aligntrue override add \
  --selector 'rule[id=no-console-log]' \
  --set severity=error

# Set nested property with dot notation
aligntrue override add \
  --selector 'rule[id=max-complexity]' \
  --set check.inputs.threshold=15

# Remove property
aligntrue override add \
  --selector 'rule[id=prefer-const]' \
  --remove autofix

# Multiple set operations
aligntrue override add \
  --selector 'rule[id=line-length]' \
  --set severity=warning \
  --set check.inputs.maxLength=120

# Combined set and remove
aligntrue override add \
  --selector 'rule[id=complexity]' \
  --set check.inputs.threshold=15 \
  --remove autofix
```

**Output:**

```
✓ Overlay added to config

Selector: rule[id=no-console-log]
  Set: severity=error

Next step:
  Run: aligntrue sync
```

**Exit codes:**

- `0` - Success
- `1` - Validation error (invalid selector, missing operations)
- `2` - System error (file write failed)

**See also:** [Overlays Guide](/docs/02-customization/overlays) for complete overlay documentation.

---

## `aligntrue override status`

View dashboard of all overlays with health status.

**Usage:**

```bash
aligntrue override status [options]
```

**Options:**

| Flag              | Description             | Default   |
| ----------------- | ----------------------- | --------- |
| `--json`          | Output in JSON format   | `false`   |
| `--config <path>` | Custom config file path | (default) |

**What it shows:**

- Overlay count (total, healthy, stale)
- Selector for each overlay
- Operations (set, remove)
- Health status (healthy if selector matches, stale if no match)

**Examples:**

```bash
# Show all overlays
aligntrue override status

# JSON output for scripting
aligntrue override status --json
```

**Example output:**

```
Overlays (3 active, 1 stale)

✓ rule[id=no-console-log]
  Set: severity=error
  Healthy: yes

✓ rule[id=max-complexity]
  Set: check.inputs.threshold=15
  Healthy: yes

❌ rule[id=old-rule-name]
  Set: severity=off
  Healthy: stale (no match in IR)
```

**JSON output:**

```json
{
  "total": 3,
  "healthy": 2,
  "stale": 1,
  "overlays": [
    {
      "selector": "rule[id=no-console-log]",
      "health": "healthy",
      "operations": {
        "set": { "severity": "error" }
      }
    }
  ]
}
```

**Health indicators:**

- `✓` **Healthy** - Overlay selector matches rules in IR
- `❌` **Stale** - Selector matches no rules

**Exit codes:**

- `0` - Success
- `1` - Config not found

**See also:** [Drift Detection](/docs/03-concepts/drift-detection) for automated staleness checks.

---

## `aligntrue override diff`

Show the effect of overlays on IR.

**Usage:**

```bash
aligntrue override diff [selector] [options]
```

**Arguments:**

- `selector` - Optional selector to filter (shows all if omitted)

**Options:**

| Flag              | Description             | Default   |
| ----------------- | ----------------------- | --------- |
| `--config <path>` | Custom config file path | (default) |

**What it shows:**

1. **Original IR** - IR before overlays applied
2. **Modified IR** - IR after overlays applied
3. **Changes** - Summary of modifications

**Examples:**

```bash
# Show all overlay effects
aligntrue override diff

# Show effect of specific overlay
aligntrue override diff 'rule[id=no-console-log]'
```

**Example output:**

```
Overlay diff for: rule[id=no-console-log]

━━━ Original (upstream) ━━━
severity: warn

━━━ With overlay ━━━
severity: error

Changes: 1 property modified
```

**No overlay case:**

```
No overlays match selector: rule[id=nonexistent]
```

**Exit codes:**

- `0` - Success
- `1` - Selector invalid or no overlays found

**See also:** [Overlays Guide](/docs/02-customization/overlays) for overlay usage.

---

## `aligntrue override remove`

Remove an overlay.

**Usage:**

```bash
aligntrue override remove [selector] [options]
```

**Arguments:**

- `selector` - Optional selector string (if omitted, interactive mode)

**Options:**

| Flag              | Description             | Default   |
| ----------------- | ----------------------- | --------- |
| `--force`         | Skip confirmation       | `false`   |
| `--config <path>` | Custom config file path | (default) |

**What it does:**

1. If no selector: shows interactive list of overlays
2. Finds matching overlay by selector
3. Prompts for confirmation (unless `--force`)
4. Removes overlay from config
5. Writes config atomically

**Examples:**

```bash
# Interactive removal (select from list)
aligntrue override remove

# Remove by selector
aligntrue override remove 'rule[id=no-console-log]'

# Remove without confirmation
aligntrue override remove 'rule[id=no-console-log]' --force
```

**Interactive mode:**

```
? Select overlay to remove
  > rule[id=no-console-log] (Set: severity=error)
    rule[id=max-complexity] (Set: check.inputs.threshold=15)
    rule[id=old-rule] (Set: severity=off)

Remove overlay: rule[id=no-console-log]? (y/N): y

✓ Overlay removed

Next step:
  Run: aligntrue sync
```

**Exit codes:**

- `0` - Success
- `1` - No matching overlay found

**See also:** [Overlays Guide](/docs/02-customization/overlays)
