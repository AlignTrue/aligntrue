# Natural markdown workflow

Get started writing rules as natural markdown sections.

## Quick Start

### 1. Create Your First Pack

Create `AGENTS.md`:

```markdown
---
id: "packs/my-org/project-rules"
version: "1.0.0"
summary: "Project coding standards"
tags: ["project", "standards"]
---

# Project Rules

Standards for our team.

## Code Quality

Write clean, maintainable code. Follow the single responsibility principle. Keep functions small and focused.

- Aim for functions under 50 lines
- Use descriptive names
- Avoid nested logic beyond 3 levels

## Testing Baseline

Every feature needs tests. Follow the test pyramid: unit tests form the base, integration tests are selective, and end-to-end tests are minimal.

- Minimum 80% code coverage
- Unit tests run in under 100ms
- No sleeps for synchronization
```

### 2. Initialize Your Project

```bash
cd /path/to/your/project
aligntrue init --non-interactive
```

Choose "AGENTS.md" as your primary rules file.

### 3. Run Sync

```bash
aligntrue sync
```

AlignTrue will:

1. Parse `AGENTS.md` and extract sections
2. Generate `.aligntrue/.rules.yaml` with fingerprints
3. Export to all configured agents (Cursor, CLAUDE.md, etc.)

### 4. Edit and Re-Sync

Edit `AGENTS.md` to update sections, then sync again:

```bash
# Edit sections as needed
nano AGENTS.md

# Re-sync to propagate changes
aligntrue sync
```

## Managing Sections

### Adding New Sections

Add new `##` headings anywhere in the document:

```markdown
## New Section Title

Content for this section goes here.
```

Run sync to add it:

```bash
aligntrue sync
```

### Modifying Section Content

Edit content under any section heading:

```markdown
## Code Quality

### Before

Write clean, maintainable code.

### After

Write clean, maintainable code that follows SOLID principles.

- Use dependency injection
- Avoid tight coupling
```

Changes are automatically detected by hash comparison.

### Removing Sections

Delete the section heading and content:

```markdown
# Before

## Code Quality

Content...

## Testing

Content...

# After

## Testing

Content...
```

The "Code Quality" section is marked as deleted in the lockfile.

### Renaming Sections

When you rename a heading, the fingerprint changes:

```markdown
# Before

## Code Quality Standards

# After

## Code Quality Guide
```

This is treated as:

1. Delete "Code Quality Standards"
2. Add "Code Quality Guide"

To preserve the fingerprint, keep heading text consistent.

## Team Mode Workflow

In team mode, sections are locked by hash:

### Step 1: Make Changes

Edit sections and save:

```bash
# Edit AGENTS.md
nano AGENTS.md

# Check for drift
aligntrue status
```

### Step 2: Review Changes

See what changed:

```bash
aligntrue check AGENTS.md
```

Output:

```
Modified sections (1):
  - fp:code-quality-abc123
    Expected: sha256:abc...
    Actual:   sha256:def...

New sections (0):
Deleted sections (0):
```

### Step 3: Approve Changes

In soft mode (warns):

```bash
aligntrue sync
```

In strict mode (blocks):

```bash
aligntrue team approve --current
aligntrue sync
```

### Step 4: Commit

Commit both files:

```bash
git add AGENTS.md .aligntrue/.rules.yaml .aligntrue.lock.json
git commit -m "docs: update code quality section"
```

## Multi-Section Packs

Create packs with many sections:

```markdown
---
id: "packs/my-org/comprehensive"
version: "1.0.0"
summary: "Comprehensive coding standards"
tags: ["standards", "comprehensive"]
---

# Comprehensive Standards

## Code Style

Guidelines for code formatting and naming.

### TypeScript

Use strict TypeScript. Enable all strict compiler flags.

### Python

Follow PEP 8 with 4-space indentation.

## Testing

Comprehensive testing requirements.

### Unit Tests

Fast, focused tests of individual units.

### Integration Tests

Test boundaries between components.

## Documentation

Clear, maintained documentation.

### Inline Comments

When code intent is unclear, add comments.

### README

Every project needs a README with quickstart.
```

## Checking Draft Changes

Before syncing, review pending changes:

```bash
aligntrue check AGENTS.md --json
```

Output shows:

- Modified sections with old and new hashes
- New sections not in lockfile
- Deleted sections in lockfile but not document

## Reverting Changes

If you need to revert:

```bash
# Restore to last synced version
git checkout AGENTS.md

# Or manually revert sections using git diff
git diff AGENTS.md
```

Then sync again:

```bash
aligntrue sync
```

## Performance Tips

- Keep sections focused (1-3 topics per section)
- Use clear headings that describe the content
- Limit content to 200-300 lines per section for readability
- Break large packs into multiple files if needed

## Troubleshooting

### "No sections found"

Ensure:

- File uses `##` heading level (not `#` or `###`)
- Frontmatter is valid YAML with three dashes
- File is named `.md`

### "Fingerprint mismatch"

This means content changed. Review with:

```bash
aligntrue check AGENTS.md
```

Then approve if correct:

```bash
aligntrue team approve --current
```

### "Section not recognized"

Check that:

- Heading uses exactly `##` (2 hashes)
- Content is under the heading
- Headings are unique (no duplicate titles)

## Next Steps

- [Natural Markdown Sections](/docs/04-reference/natural-markdown-sections) - Technical reference
- [Markdown Authoring](/docs/04-reference/markdown-authoring) - Advanced markdown features
- [Example Packs](/docs/04-reference/examples) - See working examples
- [Team Mode](/docs/03-concepts/team-mode) - Learn about team workflows
