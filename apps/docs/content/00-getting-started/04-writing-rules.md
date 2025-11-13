# Writing rules

Learn how to author rules in `AGENTS.md` using natural markdown.

## Quick start

### 1. Create your first rules

Open `AGENTS.md` (created during `aligntrue init`):

```markdown
---
id: "project-rules"
version: "1.0.0"
summary: "Project coding standards"
tags: ["project", "standards"]
---

# Project rules

Standards for our team.

## Code quality

Write clean, maintainable code. Follow the single responsibility principle. Keep functions small and focused.

- Aim for functions under 50 lines
- Use descriptive names
- Avoid nested logic beyond 3 levels

## Testing baseline

Every feature needs tests. Follow the test pyramid: unit tests form the base, integration tests are selective, and end-to-end tests are minimal.

- Minimum 80% code coverage
- Unit tests run in under 100ms
- No sleeps for synchronization
```

### 2. Run sync

```bash
aligntrue sync
```

AlignTrue will:

1. Parse `AGENTS.md` and extract sections
2. Generate `.aligntrue/.rules.yaml` with fingerprints
3. Export to all configured agents

### 3. Edit and re-sync

Edit `AGENTS.md` to update sections, then sync again:

```bash
# Edit sections as needed
nano AGENTS.md

# Re-sync to propagate changes
aligntrue sync
```

## Managing sections

### Adding new sections

Add new `##` headings anywhere in the document:

```markdown
## New section title

Content for this section goes here.
```

Run sync to add it:

```bash
aligntrue sync
```

### Modifying section content

Edit content under any section heading:

```markdown
## Code quality

### Before

Write clean, maintainable code.

### After

Write clean, maintainable code that follows SOLID principles.

- Use dependency injection
- Avoid tight coupling
```

Changes are automatically detected by hash comparison.

### Removing sections

Delete the section heading and content:

```markdown
# Before

## Code quality

Content...

## Testing

Content...

# After

## Testing

Content...
```

The "Code Quality" section is marked as deleted in the lockfile.

### Renaming sections

When you rename a heading, the fingerprint changes:

```markdown
# Before

## Code quality Standards

# After

## Code quality Guide
```

This is treated as:

1. Delete "Code Quality Standards"
2. Add "Code Quality Guide"

To preserve the fingerprint, keep heading text consistent.

## Section structure

### Frontmatter

Required YAML metadata at the top of `AGENTS.md`:

```yaml
---
id: "project-rules"
version: "1.0.0"
summary: "Project coding standards"
tags: ["project", "standards"]
---
```

### Headings

Use `##` (level 2) for rule sections:

```markdown
## Section title

Content here...
```

**Note:** Level 1 (`#`) is for the document title, not rule sections.

### Content

Write natural language guidance in markdown:

- Use lists, code blocks, and emphasis
- Include examples when helpful
- Keep sections focused (1-3 topics each)
- Limit to 200-300 lines per section for readability

### Example

```markdown
## Use TypeScript strict mode

Enable strict mode in `tsconfig.json` for better type safety. This catches more errors at compile time and makes refactoring safer.

Set these in tsconfig.json:

- noImplicitAny: true
- strictNullChecks: true
- strictFunctionTypes: true

**Why:** Strict mode prevents common errors and improves IDE support.

**Example:**

\`\`\`json
{
"compilerOptions": {
"strict": true,
"noImplicitAny": true,
"strictNullChecks": true
}
}
\`\`\`
```

## Team mode workflow

In team mode, sections are locked by hash for consistency.

### Step 1: Make changes

Edit sections and save:

```bash
# Edit AGENTS.md
nano AGENTS.md

# Check for drift
aligntrue status
```

### Step 2: Review changes

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

### Step 3: Approve changes

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

## Checking draft changes

Before syncing, review pending changes:

```bash
aligntrue check AGENTS.md --json
```

Output shows:

- Modified sections with old and new hashes
- New sections not in lockfile
- Deleted sections in lockfile but not document

## Reverting changes

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

## Best practices

### Keep sections focused

One topic per section. Split large sections into smaller ones.

**Good:**

- "Use TypeScript Strict Mode"
- "Prefer Functional Components"
- "Document Public APIs"

**Bad:**

- "Code Quality" (too broad)
- "Everything About Testing" (too large)

### Use clear headings

Headings should describe the content clearly.

**Good:**

- "Run Tests Before Committing"
- "Prefer Named Exports Over Default"
- "Use Descriptive Variable Names"

**Bad:**

- "Quality" (vague)
- "Misc" (unclear)
- "TODO" (not actionable)

### Include examples

Show concrete examples when possible.

**Good:**

```markdown
## Use descriptive variable names

Prefer clear, descriptive names over abbreviations.

**Bad:**

\`\`\`typescript
const d = new Date();
const u = getUser();
\`\`\`

**Good:**

\`\`\`typescript
const currentDate = new Date();
const activeUser = getUser();
\`\`\`
```

### Limit section length

Keep sections to 200-300 lines maximum. Break larger topics into multiple sections.

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

## Next steps

- [Natural Markdown Sections](/docs/04-reference/natural-markdown-sections) - Technical reference
- [Markdown Authoring](/docs/04-reference/markdown-authoring) - Advanced markdown features
- [Example Packs](/docs/04-reference/examples) - See working examples
- [Team Mode](/docs/03-concepts/team-mode) - Learn about team workflows
