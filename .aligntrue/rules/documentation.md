---
description: Documentation standards
apply_to: alwaysOn
content_hash: 21c5b2c0ab3214028f60e779abfccd4c52734bcd7b2664cd80df4fc20f961884
---

# Documentation standards

**When to apply:** Any time you create or update docs, complete features, or touch temporary files. This keeps docs useful and prevents cruft.

## Core principle

**CHANGELOG + user docs are enough.**  
Anything else is temporary. Delete it before merge.

---

## Strict rules

### Never create verbose summary docs

Do **not** add:

- `*_SUMMARY.md`
- `*_STATUS.md`
- `*_IMPROVEMENTS.md`
- `*_REVIEW.md`
- `docs/development/*-summary.md`
- `docs/development/*-improvements.md`
- Any file that just restates your response or PR description

If it reads like a status, recap, or phase log, it is temporary.

### Only create

1. **`CHANGELOG.md` entries**
2. **User docs in `apps/docs/content/`**  
   Only when users need to understand how to use a feature.
3. **Auto-generated repo files** - `README.md`, `CONTRIBUTING.md`, `DEVELOPMENT.md`, `SECURITY.md` are generated from docs site via `pnpm generate:repo-files`

Internal working notes belong in `.internal_docs/` while work is active. They must not appear in public docs.

**Protected files (auto-generated, do not edit directly):**

- `README.md` (from `apps/docs/content/index.mdx`)
- `CONTRIBUTING.md` (from `apps/docs/content/07-contributing/creating-packs.md`)
- `DEVELOPMENT.md` (from `apps/docs/content/06-development/*.md`)
- `SECURITY.md` (from `apps/docs/content/07-policies/security.md`)

---

## CHANGELOG (required)

`CHANGELOG.md` is the single source of truth for changes.

### Standards

- Follow Keep a Changelog style.
- Follow Semantic Versioning.
- Use an `Unreleased` section.
- Reverse chronological order.

### Valid categories

- Added
- Changed
- Deprecated
- Removed
- Fixed
- Security

### Entry format

Keep it short, user facing, and factual.

```markdown
### Added

- Cursor exporter with content hash footer
- CLI command `aligntrue sync` to export to configured agents
```

### Forbidden in CHANGELOG

Do not include:

- Token or effort estimates
- LOC counts
- Full file path lists (config exceptions allowed)
- Test counts or coverage metrics
- Session or phase breakdowns
- Internal refactor detail
- Commit hashes or history dumps
- Build or CI trivia with no user impact

### Allowed

You may include:

- Feature summaries
- Behavior changes
- CLI commands and flags
- Breaking changes and migrations
- Determinism, hashing, or lockfile behavior changes
- Security fixes and CVE references
- Performance improvements with user impact

### Writing style

**Tone:**

- Neutral, factual, concise
- One idea per bullet
- Sentences under 25 words
- No emojis
- No semicolons or em dashes

**Use verbs like:**

- added
- changed
- fixed
- improved
- removed
- updated

**Avoid:**

- Hype and marketing language
- Superlatives
- Second person in technical notes

**Good example:**

```markdown
### Added

- Cursor exporter with fidelity notes footer
```

**Bad example:**

```markdown
### Added

- Amazing new exporter that unlocks next level productivity
```

---

## Commit messages

### Format

```
type(scope): description
```

### Rules

- Present tense
- Lowercase after prefix
- No trailing period

### Examples

```
feat(exporter): add Cursor exporter with content hash footer
fix(schema): handle missing profile id in config
```

---

## Documentation content

Use documentation for real user workflows only.

### User guides

- **Location:** `apps/docs/content/concepts/` or `apps/docs/content/reference/`
- **Create only when:** a feature needs explanation
- **Include:** Overview, Quick start, Configuration, Examples, Troubleshooting
- **Keep examples:** runnable and minimal

### Tone

- Explain what the feature does
- Explain how to use it
- No hype language

### Brand and naming

- **AlignTrue** (no space)
- `.aligntrue/config.yaml` for config
- `.aligntrue/rules` for internal IR
- `.aligntrue.lock.json` and `.aligntrue.bundle.yaml` for team mode
- `.cursor/*.mdc` for Cursor exports
- `.aligntrue/rules/*.md` is the single source of truth (edit here, sync flows to agents)

### Emoji Usage

**NEVER use emojis in:**

- AGENTS.md and agent-exported files
- Rules directory (.aligntrue/rules/)
- Config files (.aligntrue/config.yaml)
- HTML comments and markers in exported files
- Section headings or content that syncs across agents
- Read-only file warnings
- Error messages in synced content

**Reason:** Emojis break parsing, render inconsistently across formats and terminals, cause encoding issues, and reduce clarity in technical content.

**OK to use emojis in:**

- Documentation website (apps/docs) for visual appeal
- README files that are not synced
- Commit messages (for personal preference)
- Internal tools output (CLI help text, status messages)

---

## Documentation site layout

Nextra docs live in `apps/docs/content/`.

### Current structure

- `00-getting-started/` - Quickstart, next steps, FAQ
- `01-guides/` - Workflow guides (solo, team, multi-agent)
- `02-customization/` - Plugs, overlays, scopes
- `03-concepts/` - Core concepts (sync, drift, team mode)
- `04-reference/` - CLI reference, agent support, features
- `05-troubleshooting/` - Common issues and solutions
- `07-contributing/` - Contribution guides
- `07-policies/` - Security and other policies
- `06-development/` - Development setup and guides

### Documentation architecture

AlignTrue uses a **docs-first architecture** where the documentation site is the canonical source and repo root files are generated from it.

**Data flow:**

```
apps/docs/content/ (canonical source - edit here)
  ↓
scripts/generate-repo-files.mjs (transformation)
  ↓
README.md, CONTRIBUTING.md, DEVELOPMENT.md, SECURITY.md (generated - don't edit)
```

**File mappings:**

- `apps/docs/content/index.mdx` → `README.md`
- `apps/docs/content/07-contributing/creating-packs.md` → `CONTRIBUTING.md`
- `apps/docs/content/06-development/*.md` → `DEVELOPMENT.md` (concatenated)
- `apps/docs/content/07-policies/security.md` → `SECURITY.md`

**Workflow:**

1. Edit docs source in `apps/docs/content/`
2. Stage your changes (including any accidental edits to protected files)
3. Commit—the pre-commit hook will auto-regenerate protected files from source

**Protection:**
The pre-commit hook automatically regenerates protected files when docs source changes. If regeneration fails, the hook explains how to debug.

### Frontmatter

Each page must have:

```yaml
---
description: One line description
---
```

### Guidelines

- Use relative links
- Use `bash`, `yaml`, `typescript` tags for code blocks
- Keep navigation shallow and obvious
- Use callouts and tabs only when they improve clarity
- Avoid custom React components in content

### Markdown (.md) vs MDX (.mdx)

**Use `.md` (default)**

- Pure markdown content
- No JSX components
- Works fine with Nextra
- Most docs should be `.md`

**Use `.mdx` when adding JSX**

- `<Callout>` components
- `<Tabs>` components
- `<Cards>` components
- Any other React/JSX elements
- **Critical:** Rename `.md` → `.mdx` BEFORE adding JSX, otherwise components won't render

**Naming convention:**
When you add a JSX component to an existing `.md` file, rename it to `.mdx` in the same edit. Example:

```bash
git mv overlays.md overlays.mdx
# Then add <Callout> components
```

**Generation compatibility:**
The `pnpm generate:repo-files` script handles both `.md` and `.mdx` files equally, so this doesn't affect README generation.

---

## Temporary files

Temporary means: delete before merge.

### Delete

- `*_STATUS.md`
- `*_CHECKLIST.md`
- `*_SUMMARY.md`
- `*_PHASE*.md`
- `*_IMPLEMENTATION.md`
- `*_COMPLETE.md`
- `*_FILES_CREATED.txt`
- Any `*.md` with `UPPERCASE_UNDERSCORES` used as a working note

### Keep

- `CHANGELOG.md`
- `apps/docs/content/**/*.md`
- `.internal_docs/*.md` (internal only, never linked from public docs)

---

## Small vs big changes

### Small feature or fix

**Scope:** one module or limited files.

**Do:**

- Add 1 to 3 bullets to `CHANGELOG.md`
- Update existing docs only if behavior changed

**Do not:**

- Create new pages
- Add status or summary docs

### Big feature or system

**Scope:** new feature set or architecture.

**Do:**

- Add 3 to 5 bullets to `CHANGELOG.md`
- Add one focused doc page in concepts or reference
- Explain enablement, config, and key workflows

**Do not:**

- Add multi page status narratives
- Keep phase or session logs

---

## Agent workflow

### While working

- You may create temporary notes under `dev/` or `.internal_docs/`
- Do not present them as permanent
- Do not suggest roadmap or handoff docs by default

### On completion

1. Update `CHANGELOG.md`
2. Create or update user docs if needed
3. Delete temporary files
4. Confirm git is clean

### Do not claim completion if:

- Temporary `*_*.md` files remain
- Docs are missing for new user facing behavior

---

## Cleanup checklist

Before merge:

- `CHANGELOG.md` updated
- User doc added or updated if feature is user facing
- No `*_STATUS.md`
- No `*_CHECKLIST.md`
- No `*_SUMMARY.md`
- No `*_PHASE*.md`
- No `*_IMPLEMENTATION.md`
- No `UPPERCASE_UNDERSCORES` temp docs in root or `dev/`

---

## Answering documentation questions

When asked where to look:

1. Point to `CHANGELOG.md`
2. Point to relevant `apps/docs/content/...` pages
3. Do not suggest adding permanent status or roadmap files
4. Treat any working file as disposable

---

## Package Exports Documentation

**Critical requirement:** All package exports must be documented BEFORE adding to `package.json`.

### Documentation location

`apps/docs/content/06-development/package-exports.md`

### Required information

For each export, document:

- Export path (e.g., `./utils/section-parser`)
- Purpose (one sentence description)
- Example usage (import statement)

### Workflow

1. **Document first** - Add entry to package exports documentation
2. **Add export** - Update `exports` field in `package.json`
3. **Build and test** - Verify: `pnpm build && pnpm test`
4. **Update CHANGELOG** - Add entry describing the new export

### Export format

```json
{
  "exports": {
    "./your-export": {
      "types": "./dist/your-export.d.ts",
      "default": "./dist/your-export.js"
    }
  }
}
```

### Why this matters

- Prevents accidental exposure of internal APIs
- Ensures all exports are intentional and documented
- Enables CI validation of exports
- Provides clear guidance for package consumers

### Validation

CI should validate that:

- All exports in `package.json` are documented
- All documented exports exist in `package.json`
- All export files exist in `dist/` after build

---

## Documentation accuracy validation

**Critical requirement:** Documentation must match implementation reality. Code and config are the source of truth, not docs.

### Automated validation

CI and pre-commit hooks automatically validate:

1. **Node.js version requirements**
   - Source of truth: `package.json` engines.node field
   - Validated in: All documentation files mentioning Node version
   - Update trigger: When changing `package.json` engines field

2. **CLI command count**
   - Source of truth: `packages/cli/src/index.ts` command dispatch statements
   - Validated in: `apps/docs/content/04-reference/features.md`
   - Update trigger: When adding/removing CLI commands

3. **Exporter count**
   - Source of truth: Directory count in `packages/exporters/src/`
   - Validated in: `apps/docs/content/index.mdx`, `apps/docs/content/04-reference/agent-support.md`
   - Update trigger: When adding/removing exporters

4. **Performance threshold claims**
   - Source of truth: `packages/cli/tests/integration/performance.test.ts` threshold constants
   - Validated in: `apps/docs/content/04-reference/features.md`
   - Update trigger: When changing test thresholds

### Running validation manually

```bash
pnpm validate:docs
```

### When validation fails

1. Read the error message - it shows expected vs actual values
2. Update documentation to match code/config (not the other way around)
3. Re-run validation to confirm fix
4. Commit both code and doc changes together

### What is NOT validated

Validation only covers quantifiable claims. These still require manual updates:

- Feature descriptions and explanations
- Usage examples and tutorials
- Troubleshooting guides
- Conceptual documentation
- Qualitative performance claims

For these, follow the existing rules: update docs when behavior changes.

---

## Common mistakes

### Avoid

- Keeping `FEATURE_STATUS.md` after merge
- Duplicating explanations across multiple docs
- Writing guides for internal refactors
- Leaving temp files in the repo
- Adding package exports without documentation
- Updating code without updating validated documentation

### Do

- Keep a single, clean changelog
- Add focused docs only where users need them
- Document all package exports before adding them
- Run `pnpm validate:docs` before committing doc changes
- Let validation catch drift automatically
