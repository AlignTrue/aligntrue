---
title: Rule organization
description: Organize rules across files and control how they appear in agent exports (inline or linked)
---

# Rule organization

This guide covers how AlignTrue organizes your rules and how they appear in exported files. You can organize rules across multiple source files, embed them inline in exports, or link to them—giving you flexibility to match your team's workflow and agent capabilities. Whether you have one rule or dozens, these options help you manage rules effectively.

Edit rules in `.aligntrue/rules/*.md`. Exports like `AGENTS.md` and `.cursor/rules/*.mdc` are generated outputs—treat them as read-only.

## Rule storage and export

AlignTrue uses `.aligntrue/rules/` as your canonical source, which you organize however you want. When exporting to agents, you control how rules appear: embedded inline for simplicity, or linked for large rule sets.

**Multi-file organization benefits:**

- **Better organization**: Group related rules together (security, architecture, testing)
- **Easier navigation**: Jump directly to the file you need instead of scrolling through one large file
- **Reduced merge conflicts**: Multiple people can edit different files simultaneously
- **Clear ownership**: Assign different files to different team members via CODEOWNERS
- **Logical separation**: Keep concerns separate and focused

**Export format benefits:**

- **Inline mode**: Full rule content embedded in exports for immediate access
- **Links mode**: Markdown links to source files, keeping exports lean and modular
- **Auto mode**: AlignTrue picks the best approach based on your setup

## When to use multiple files

Consider multi-file organization when:

1. **Your rule file exceeds 1000 lines** - Navigation becomes difficult
2. **Multiple people edit rules** - Reduces merge conflicts and enables clear ownership
3. **You have distinct rule categories** - Security, architecture, testing, etc. deserve separate files
4. **You're using team mode** - Makes PR reviews easier with smaller, focused diffs
5. **You have a monorepo** - Different scopes can have different rule files

**For small projects (< 1000 lines, solo developer):** A single `.aligntrue/rules/base.md` file is simpler and perfectly fine.

## Where to organize your files

The location depends on your agent setup:

### Single agent (Cursor only)

If you only use Cursor, keep your sources in AlignTrue format and let sync generate Cursor outputs:

```
project/
├── .aligntrue/
│   ├── config.yaml
│   └── rules/
│       ├── architecture.md
│       ├── security.md
│       └── testing.md
└── .cursor/
    └── rules/  (generated, read-only)
```

**Configuration:**

Rules are authored in `.aligntrue/rules/`; `aligntrue sync` generates `.cursor/rules/*.mdc` for Cursor.

**Why:** Single source of truth with Cursor's native multi-file format.

### Multiple agents

If you use multiple agents (Cursor + Copilot + Claude), use a neutral location:

```
project/
├── .aligntrue/
│   ├── config.yaml
│   └── rules/
│       ├── architecture.md
│       ├── security.md
│       └── testing.md
```

**Configuration:**

This is the default configuration - rules from `.aligntrue/rules/` are synced to all agents.

**Why:** AlignTrue exports to each agent's format (merged for single-file agents, split for multi-file agents).

### Team mode

For teams, use `.aligntrue/rules/` as the canonical source that goes through PR review:

```
project/
├── .aligntrue/
│   ├── config.yaml
│   └── rules/
│       ├── architecture.md
│       ├── security.md
│       └── testing.md
├── AGENTS.md  (generated, read-only)
└── .cursor/
    └── rules/  (generated, read-only)
```

**Configuration:**

```yaml
mode: team
sync:
  source_files: ".aligntrue/rules/*.md"
```

**Why:** Single source of truth that goes through team review process.

## Which agents support multi-file natively?

AlignTrue adapts exports based on each agent's capabilities:

### Native multi-file support

These agents support multiple rule files in their native format:

- **Cursor** - `.cursor/rules/*.mdc` (scope-based files)
- **Amazon Q** - `.amazonq/rules/*.md`
- **KiloCode** - `.kilocode/rules/*.md`
- **Augment Code** - `.augment/rules/*.md`
- **Kiro** - `.kiro/steering/*.md`
- **Trae AI** - `.trae/rules/*.md`

### Single-file only

These agents use a single file format:

- **AGENTS.md** - Universal format for multiple agents
- **Claude** - `CLAUDE.md`
- **Warp** - `WARP.md`
- **Cline** - `.clinerules`
- **Goose** - `.goosehints`
- And most others

### How AlignTrue handles the difference

**You organize rules however you want.** AlignTrue automatically:

- **For multi-file agents**: Exports separate files (e.g., `.cursor/rules/security.mdc`)
- **For single-file agents**: Merges all your source files into one output (e.g., `AGENTS.md`)
- **Preserves provenance**: Tracks which source file each section came from
- **Adds source markers**: HTML comments show file boundaries in merged outputs

## Setting up multi-file organization

### Option 1: Split existing AGENTS.md

If you already have a large `AGENTS.md` file:

```bash
# Interactive split (asks for confirmation and target directory)
aligntrue sources split

# Non-interactive (uses .aligntrue/rules/ by default)
aligntrue sources split --yes
```

This command:

1. Parses sections from `AGENTS.md`
2. Creates a separate file for each section
3. Updates config to use the new files
4. Optionally backs up the original `AGENTS.md`

### Option 2: Create files manually

Create your directory structure:

```bash
# Create directory
mkdir -p .aligntrue/rules

# Create rule files
echo "# Architecture Guidelines" > .aligntrue/rules/architecture.md
echo "# Security Best Practices" > .aligntrue/rules/security.md
echo "# Testing Standards" > .aligntrue/rules/testing.md
```

Update `.aligntrue/config.yaml`:

```yaml
sync:
  source_files: ".aligntrue/rules/*.md"
  source_order: # Optional: control merge order
    - architecture.md
    - security.md
    - testing.md
```

Run sync:

```bash
aligntrue sync
```

## Configuration options

### Source order

By default, files merge alphabetically. Use `source_order` to control priority:

```yaml
sync:
  source_order:
    - important-first.md
    - then-this.md
    - finally-this.md
```

Files not listed are appended alphabetically at the end.

### Source markers

AlignTrue can add HTML comment markers showing which file each section came from:

```yaml
sync:
  source_markers: "auto" # auto (default), always, or never
```

**Modes:**

- `auto` (default): Show markers only when multiple source files configured
- `always`: Always show markers, even for single-file sources
- `never`: Never show markers

---

## Content mode for single-file exports

Control how single-file exporters (AGENTS.md, CLAUDE.md, etc.) include rule content:

```yaml
sync:
  content_mode: "auto" # auto (default), inline, or links
```

**Modes:**

- `auto` (default): Inline for 1 rule, links for 2+ rules
- `inline`: Always embed full rule content with separators
- `links`: Always use markdown links to source files

**When to use each mode:**

| Mode     | Best for                                                                     |
| -------- | ---------------------------------------------------------------------------- |
| `auto`   | Most users - simple setup with single rule, organized links for multiple     |
| `inline` | When you want AI agents to see all rules immediately without following links |
| `links`  | Large rule sets where embedding all content would be unwieldy                |

**CLI override:**

```bash
aligntrue sync --content-mode=inline  # Force inline
aligntrue sync --content-mode=links   # Force links
```

**Size warning:** When inline content exceeds 50KB, AlignTrue warns that links mode may provide better AI agent reliability

**Example output:**

```markdown
<!-- aligntrue:source security.md -->

## Security guidelines

...

<!-- aligntrue:source testing.md -->

## Testing standards

...
```

## CLI commands

### List source files

View all source files with section counts and sizes:

```bash
aligntrue sources list
```

Output:

```
Source patterns: .aligntrue/rules/*.md
Custom order: architecture.md, security.md, testing.md

Found 3 source files:

  .aligntrue/rules/architecture.md (5 sections, 234 lines)
  .aligntrue/rules/security.md (8 sections, 456 lines)
  .aligntrue/rules/testing.md (6 sections, 189 lines)
```

### Split existing file

Convert a single file into multiple files:

```bash
aligntrue sources split
```

## How it works

### Discovery

AlignTrue discovers source files using configured patterns:

1. Resolves glob patterns relative to workspace root
2. Reads all matching markdown files
3. Parses sections from each file

### Merging

Source files merge into a single internal representation:

1. Files are ordered (alphabetically or by `source_order`)
2. Sections from each file are concatenated in order
3. Each section tracks its source file for provenance

### Export adaptation

AlignTrue exports differently based on agent capabilities:

**For multi-file agents (Cursor, Amazon Q, etc.):**

- Exports separate files preserving your organization
- Each file becomes a separate agent file

**For single-file agents (AGENTS.md, Claude, etc.):**

- Merges all source files into one output
- Adds source markers (HTML comments) to show boundaries
- Includes fidelity note listing source files

### Provenance tracking

Every section includes metadata about its source file:

```yaml
sections:
  - heading: "Architecture Guidelines"
    content: "..."
    vendor:
      aligntrue:
        source_file: "architecture.md"
```

This enables:

- Tracking which file each section came from
- Debugging which file a section came from
- Clear provenance for rules

## Sync workflow

Multi-file sources work seamlessly with unidirectional sync:

1. **Edit your source file**: Make changes to `.aligntrue/rules/security.md`
2. **Run sync**: `aligntrue sync`
3. **Changes propagate**: Updates sync to all agent files

AlignTrue tracks which file each section came from, making it easy to find and update rules.

## Best practices

### File organization

- **Group related rules**: Put all security rules in `security.md`
- **Use clear names**: `security.md` not `rules1.md`
- **Keep files focused**: One concern per file
- **Limit file count**: 3-10 files is ideal; too many becomes hard to navigate

### Naming conventions

- Use lowercase with hyphens: `coding-standards.md`
- Be descriptive: `api-design-guidelines.md`
- Avoid abbreviations unless well-known: `security.md` not `sec.md`

### Organization strategies

**By concern** (recommended):

```
.aligntrue/rules/
├── architecture.md
├── security.md
├── testing.md
└── documentation.md
```

**By technology:**

```
.aligntrue/rules/
├── typescript.md
├── react.md
├── nodejs.md
└── postgres.md
```

**By team:**

```
.aligntrue/rules/
├── frontend-team.md
├── backend-team.md
└── devops-team.md
```

### Team collaboration

- **Assign ownership**: Use `CODEOWNERS` to assign file ownership
- **Custom order**: Use `source_order` to prioritize important files
- **Clear boundaries**: Make it obvious which rules belong in which file

### Migration strategy

When migrating from single-file to multi-file:

1. **Start small**: Split into 3-5 logical categories
2. **Test thoroughly**: Run `aligntrue sync` and verify outputs
3. **Update team docs**: Document the new structure
4. **Keep backup**: Don't delete original file immediately

## Comparison with single-file

| Aspect              | Single file (.aligntrue/rules/base.md) | Multi-File                 |
| ------------------- | -------------------------------------- | -------------------------- |
| **Setup**           | Simpler                                | Requires config            |
| **Navigation**      | Scroll through one file                | Jump between files         |
| **Merge Conflicts** | More frequent                          | Less frequent              |
| **Ownership**       | Shared                                 | Can be per-file            |
| **Organization**    | Sections within file                   | Files and sections         |
| **Best For**        | Small projects (< 20 rules)            | Large projects (20+ rules) |

## Troubleshooting

### Files not found

If `aligntrue sources list` shows no files:

1. Check the glob pattern in `sync.source_files`
2. Verify files exist relative to workspace root
3. Check file extensions match the pattern

### Wrong merge order

If sections appear in the wrong order:

1. Add or update `sync.source_order` in config
2. List files in desired order
3. Run `aligntrue sync` to regenerate

### Section conflicts

If you see "Section conflict" warnings:

1. Check if the same section heading exists in multiple files
2. Rename one of the headings to make them unique
3. Or merge the duplicate sections into one file

### File too large warning

If you see "Your file is large (>1000 lines)" during sync:

```bash
# Split the file into multiple files
aligntrue sources split
```

## Related documentation

- [Solo developer guide](/docs/01-guides/01-solo-developer-guide#organizing-your-rules) - Rule organization for solo developers
- [Team guide](/docs/01-guides/02-team-guide#organizing-rules-for-teams) - Rule organization for teams
- [Agent support](/docs/04-reference/agent-support) - Which agents support multi-file natively
- [Per-rule targeting](/docs/02-customization/per-rule-targeting) - Control which agents receive specific rules
- [Sync behavior](/docs/03-concepts/sync-behavior) - How rules sync to agents
- [Scopes](/docs/02-customization/scopes) - Path-based rule application for monorepos
- [Team mode](/docs/01-guides/02-team-guide) - Lockfile validation and drift detection

## Example

See the [multi-file-rules example](https://github.com/AlignTrue/aligntrue/tree/main/examples/multi-file-rules) for a complete working example with:

- Multiple source files organized by concern
- Custom merge order
- Documentation and best practices
