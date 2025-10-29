# Import workflow guide

Migrate existing agent-specific rules to AlignTrue's universal format.

## Overview

If you already have rules in Cursor's `.mdc` format or the `AGENTS.md` universal format, AlignTrue can import them to its intermediate representation (IR). This enables:

- **Consolidation** - Merge rules from multiple agents into one source
- **Migration** - Transition existing projects to AlignTrue
- **Analysis** - Understand field coverage and metadata preservation
- **Validation** - Verify rules before committing to the migration

## When to use import

### Existing rules in agent formats

You have established rules in:
- **Cursor** - `.cursor/rules/*.mdc` files with YAML frontmatter
- **AGENTS.md** - Universal markdown format used by Claude, Copilot, Aider, and others

### Team with established rules

Your team already maintains agent-specific rules and wants:
- Centralized rule management
- Multi-agent support without duplication
- Version control with git
- Validation and checks in CI

### Multi-agent consolidation

You use multiple AI coding agents and want:
- Single source of truth for all rules
- Consistent behavior across agents
- Easier maintenance (edit once, sync everywhere)

## When to start fresh

Consider skipping import if:

- **No existing rules** - Start with `aligntrue init` for clean setup
- **Legacy rules** - Old rules that need complete rewrite anyway
- **Simple cases** - Only 1-2 rules that are easy to recreate
- **Learning AlignTrue** - Fresh start helps understand the format

The [Quickstart Guide](quickstart.md) covers starting from scratch.

## Step-by-step migration

### 1. Detect existing rules

Run `aligntrue init` to auto-detect agent formats:

```bash
aligntrue init
```

AlignTrue scans for:
- `.cursor/rules/*.mdc` files
- `AGENTS.md` in project root

**Example output:**

```
◇ Detected 2 AI coding agents:
│  • Cursor (.cursor/)
│  • GitHub Copilot (AGENTS.md)
│
◇ Found existing rules in 2 formats:
│  • Cursor: 3 rules in .cursor/rules/
│  • AGENTS.md: 5 rules
│
◇ Would you like to import existing rules?
│  ○ Yes, analyze and import
│  ● No, create fresh starter template
```

Choose "analyze and import" to proceed with migration.

### 2. Analyze with coverage report

Run import with coverage analysis:

```bash
# Analyze Cursor rules
aligntrue import cursor

# Or analyze AGENTS.md
aligntrue import agents-md
```

This generates a detailed coverage report without writing any files.

**Example output:**

```
◆ Import Analysis: Cursor

  Rules found: 3

  Field Coverage: 71% (medium confidence)

  ✓ Mapped Fields (5/7):
    • id ← rule.id
    • summary ← rule.summary
    • severity ← inferred from frontmatter
    • guidance ← markdown content
    • vendor.cursor.* ← YAML frontmatter

  ⚠ Unmapped Fields (2/7):
    • check (not present in .mdc format)
    • autofix (not present in .mdc format)

  ✓ Vendor Metadata: Preserved
    All Cursor-specific fields preserved in vendor.cursor namespace

  Next Steps:
    1. Review coverage above
    2. Run with --write to import rules
    3. Verify output in .aligntrue/rules.md
```

### 3. Review coverage and vendor metadata

#### Coverage percentage

- **High (≥90%)** - Excellent mapping, minimal data loss
- **Medium (70-89%)** - Good mapping, some fields unmapped (expected)
- **Low (<70%)** - Significant gaps, review carefully

Current parsers achieve 71% coverage for both Cursor and AGENTS.md. The unmapped fields (`check`, `autofix`) are AlignTrue-specific and not present in source formats.

#### Confidence level

Indicates how reliably the parser can map fields:

- **High** - All mappings validated, no ambiguity
- **Medium** - Most mappings reliable, some inference required
- **Low** - Significant guesswork, manual review needed

#### Vendor metadata preservation

AlignTrue preserves agent-specific metadata in `vendor.<agent>` namespaces:

```yaml
rules:
  - id: example.rule
    summary: Example rule
    vendor:
      cursor:
        ai_hint: "Check for TypeScript strict mode"
        priority: high
```

This enables lossless round-trips: import from Cursor → edit → export to Cursor without losing Cursor-specific fields.

### 4. Write to IR

Once you're satisfied with the coverage report:

```bash
aligntrue import cursor --write
```

This creates `.aligntrue/rules.md` with imported rules in AlignTrue's literate markdown format.

**Example output:**

```
◇ Importing 3 rules from Cursor...
│
◆ Wrote .aligntrue/rules.md:
│  • 3 rules imported
│  • Vendor metadata preserved
│  • Ready for sync
│
◇ Next: Run 'aligntrue sync' to generate agent files
```

#### Preview before writing

Use `--dry-run` to preview output without creating files:

```bash
aligntrue import cursor --write --dry-run
```

Shows the markdown that would be written to `.aligntrue/rules.md`.

### 5. Verify and sync

Verify the imported rules:

```bash
# Check rules are valid
aligntrue check

# Preview sync output
aligntrue sync --dry-run

# Generate agent files
aligntrue sync
```

This regenerates `.cursor/rules/*.mdc` and `AGENTS.md` from the imported IR. Compare with your original files to verify nothing was lost.

## Coverage analysis interpretation

### Field mapping details

The coverage report shows how source format fields map to IR fields:

```
✓ Mapped Fields:
  • id ← rule.id (direct mapping)
  • summary ← rule.summary (direct mapping)
  • severity ← inferred from label (ERROR/WARN/INFO)
  • guidance ← markdown content above block
  • vendor.cursor.* ← YAML frontmatter (preserved)
```

### Unmapped fields

Fields that don't exist in source formats are marked unmapped:

```
⚠ Unmapped Fields:
  • check (AlignTrue-specific, not in Cursor format)
  • autofix (AlignTrue-specific, not in AGENTS.md)
```

This is expected. AlignTrue's IR is a superset of most agent formats.

### Vendor metadata preservation

Agent-specific fields are preserved in `vendor.<agent>` namespace:

**Cursor example:**

```yaml
vendor:
  cursor:
    ai_hint: "Focus on TypeScript"
    priority: high
    tags: [typescript, strict-mode]
```

**AGENTS.md example:**

```yaml
vendor:
  agents_md:
    original_severity: "ERROR"
    section: "Code Quality"
```

These fields round-trip when exporting back to the same agent format.

## Import vs fresh start decision framework

| Scenario | Recommendation | Why |
|----------|----------------|-----|
| 10+ existing rules | **Import** | Significant investment, preserve work |
| Complex agent metadata | **Import** | Vendor bags preserve configuration |
| Learning AlignTrue | **Fresh start** | Simpler to understand format |
| Legacy rules (>1 year old) | **Fresh start** | Likely need rewrite anyway |
| Team migration | **Import** | Minimize disruption, gradual adoption |
| Prototype/experiment | **Fresh start** | Faster to iterate from scratch |

When in doubt, run `aligntrue import <agent>` (without `--write`) to see the coverage report. This helps you decide without committing to the import.

## Supported agent formats

### Cursor (.cursor/rules/*.mdc)

**Format:** Markdown with YAML frontmatter

**Example:**

```markdown
---
ai_hint: Check TypeScript strict mode
priority: high
---

## Use TypeScript strict mode

Enable strict mode in all TypeScript files for better type safety.

Check tsconfig.json has `"strict": true`.
```

**Coverage:** 71% (5/7 fields)

**Import command:**

```bash
aligntrue import cursor
```

### AGENTS.md (universal format)

**Format:** Markdown sections with severity labels

**Example:**

```markdown
# AlignTrue Rules

Version: 1.0

## Code Quality

### ERROR: Use TypeScript strict mode

Enable strict mode in all TypeScript files for better type safety.

Check tsconfig.json has `"strict": true`.
```

**Coverage:** 71% (5/7 fields)

**Aliases:** copilot, claude-code, aider (all use AGENTS.md format)

**Import command:**

```bash
aligntrue import agents-md
# or
aligntrue import copilot
aligntrue import claude-code
aligntrue import aider
```

## Current limitations

### Field coverage

Current parsers achieve **71% field coverage** for both Cursor and AGENTS.md formats:

- **Mapped:** id, summary, severity, guidance, vendor.*
- **Unmapped:** check, autofix (AlignTrue-specific features)

The unmapped fields can be added manually after import if needed.

### Round-trip fidelity

While vendor metadata is preserved during import:
- ✅ Import Cursor → IR preserves all Cursor fields
- ✅ Export IR → Cursor includes vendor.cursor fields
- ⚠️ Round-trip testing limited (Phase 2 focus)

Full round-trip validation (import → edit → export → reimport) is planned for Phase 3+.

### Conflict resolution

Import currently overwrites existing `.aligntrue/rules.md`:
- ⚠️ No merge with existing rules
- ⚠️ No conflict detection
- ✅ Preview with `--dry-run` before writing

Manual merge required if you have both existing IR and agent files. Automated conflict resolution is planned for Phase 3+.

## Future enhancements

### Improved field coverage

Planned improvements to reach ≥90% coverage:
- Infer `check` rules from guidance patterns
- Map autofix hints from agent-specific fields
- Detect applies_to patterns from file references

### More agent formats

Additional parsers planned based on demand:
- Windsurf (`.windsurf/rules.md`)
- Claude Code (`.claude/instructions.md`)
- Cline (`.clinerules`)
- Custom formats via import plugins

### Conflict resolution

Interactive conflict resolution during import:
- Detect overlapping rules (matching IDs)
- Prompt for merge strategy (keep, replace, merge)
- Side-by-side diff display
- Batch resolution for multiple conflicts

## Command reference

For detailed flag documentation, see [Command Reference](commands.md#aligntrue-import).

**Common commands:**

```bash
# Analyze coverage only
aligntrue import cursor
aligntrue import agents-md

# Import and write to IR
aligntrue import cursor --write
aligntrue import agents-md --write

# Preview without writing
aligntrue import cursor --write --dry-run

# Skip coverage report (faster)
aligntrue import cursor --no-coverage --write
```

## See also

- [Quickstart Guide](quickstart.md) - Starting fresh with AlignTrue
- [Command Reference](commands.md) - Full CLI documentation
- [Sync Behavior](sync-behavior.md) - How rules export to agents
- [Extending AlignTrue](extending-aligntrue.md) - Creating custom importers

---

**Last Updated:** 2025-10-29

