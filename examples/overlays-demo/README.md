# Overlays demo

This example demonstrates fork-safe customization of upstream rule packs using overlays. Customize severity, inputs, and behavior without forking.

## What's inside

- **`.aligntrue/config.yaml`** - Solo mode configuration with local source
- **`AGENTS.md`** - Primary user-editable file with base rules and overlays applied
- **`upstream-pack.yaml`** - Simulated upstream pack (3 rules)
- **`SCENARIOS.md`** - Detailed scenarios with expected outputs
- **`test-overlays.sh`** - Validation script

## Quick start

### 1. View upstream pack

```bash
cat upstream-pack.yaml
```

You'll see 3 rules from a simulated upstream pack:

- `no-console-log` (severity: warn)
- `max-complexity` (threshold: 10)
- `prefer-const` (with autofix enabled)

### 2. View overlays

```bash
cat AGENTS.md
```

The overlays section shows customizations:

- Upgrade `no-console-log` from warn → error
- Increase `max-complexity` threshold from 10 → 15
- Remove autofix from `prefer-const`

### 3. Sync with overlays applied

```bash
# From aligntrue repo root
cd examples/overlays-demo
node ../../packages/cli/dist/index.js sync
```

Expected output:

```
✓ Sync complete
✓ Applied 3 overlays
Wrote 2 files:
  - .cursor/rules/aligntrue.mdc
  - AGENTS.md
```

### 4. Inspect overlay effects

The generated files show the modified rules with overlays applied.

## Overlay scenarios

### Scenario 1: Upgrade severity

**Use case:** Team wants stricter enforcement than upstream default.

**Overlay:**

```yaml
overlays:
  overrides:
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error" # Upgraded from warn
```

**Result:** Rule now fails CI instead of warning.

### Scenario 2: Adjust check inputs

**Use case:** Project needs different threshold than upstream default.

**Overlay:**

```yaml
overlays:
  overrides:
    - selector: "rule[id=max-complexity]"
      set:
        "check.inputs.threshold": 15 # Increased from 10
```

**Result:** Complexity check allows up to 15 instead of 10.

### Scenario 3: Remove autofix

**Use case:** Autofix conflicts with framework, keep check but disable auto-fix.

**Overlay:**

```yaml
overlays:
  overrides:
    - selector: "rule[id=prefer-const]"
      remove:
        - "autofix"
```

**Result:** Check still runs, but doesn't auto-fix (manual fixes only).

## Why overlays?

**Without overlays (forking):**

- Fork upstream pack
- Make changes
- Lose upstream updates
- Maintain your fork forever

**With overlays (fork-safe):**

- Pull upstream pack
- Apply overlays for customization
- Get upstream updates automatically
- Overlays reapply on top of updates

## Commands reference

### Apply overlays

```bash
aligntrue sync
```

### View overlay status

```bash
aligntrue override status
```

### View overlay effects (before/after)

```bash
aligntrue override diff
```

### Add overlay via CLI

```bash
aligntrue override add \
  --selector 'rule[id=no-console-log]' \
  --set severity=error
```

### Remove overlay

```bash
aligntrue override remove 'rule[id=no-console-log]'
```

## Validation

Run the test script to verify everything works:

```bash
./test-overlays.sh
```

This checks:

- Config file exists and is valid
- Rules file exists with overlays
- Sync succeeds
- Output files are created
- Overlays are applied correctly

## See also

- [Overlays guide](../../apps/docs/content/02-customization/overlays.md) - Complete overlay documentation
- [SCENARIOS.md](./SCENARIOS.md) - Detailed scenarios with outputs
- [Team repo example](../team-repo/) - Team workflows with overlays
