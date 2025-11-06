---
title: Editing documentation
description: How to edit AlignTrue documentation using the docs-first architecture.
---

# Editing documentation

AlignTrue uses a docs-first architecture where the documentation site is the canonical source and repo root files are generated from it.

## Architecture overview

```
apps/docs/content/ (canonical source - edit here)
  ↓
scripts/generate-repo-files.ts (transformation)
  ↓
README.md, CONTRIBUTING.md, DEVELOPMENT.md, POLICY.md (generated - don't edit)
```

This mirrors AlignTrue's own philosophy: docs are the IR (Intermediate Representation), and repo files are exports.

## File mapping

| Docs Source                                        | Generated File    | Purpose                          |
| -------------------------------------------------- | ----------------- | -------------------------------- |
| `apps/docs/content/index.mdx`                      | `README.md`       | GitHub landing page              |
| `apps/docs/content/contributing/creating-packs.md` | `CONTRIBUTING.md` | Contribution guide               |
| `apps/docs/content/development/*.md`               | `DEVELOPMENT.md`  | Development guide (concatenated) |
| `apps/docs/content/06-policies/index.md`           | `POLICY.md`       | Registry policy                  |

## Editing workflow

### 1. Edit docs content

Edit files in `apps/docs/content/`:

```bash
# Edit the docs homepage (becomes README.md)
apps/docs/content/index.mdx

# Edit contribution guide (becomes CONTRIBUTING.md)
apps/docs/content/contributing/creating-packs.md

# Edit development pages (become DEVELOPMENT.md)
apps/docs/content/development/setup.md
apps/docs/content/development/workspace.md
apps/docs/content/development/commands.md
apps/docs/content/development/architecture.md

# Edit policy (becomes POLICY.md)
apps/docs/content/06-policies/index.md
```

### 2. Generate repo files

After editing, regenerate the repo root files:

```bash
pnpm generate:repo-files
```

This script:

- Reads docs content files
- Strips MDX frontmatter
- Transforms relative links to absolute URLs
- Adds auto-generation header and footer
- Writes to repo root

### 3. Verify changes

Check that generated files look correct:

```bash
git diff README.md CONTRIBUTING.md DEVELOPMENT.md POLICY.md
```

### 4. Commit both

Commit both the docs source and generated files:

```bash
git add apps/docs/content/ README.md CONTRIBUTING.md DEVELOPMENT.md POLICY.md
git commit -m "docs: Update documentation"
```

## Link handling

### Internal links (standard format)

**Always use absolute paths from `/docs/` root for internal documentation links.**

```markdown
<!-- ✅ Correct: Absolute path from /docs/ root -->

[Team Mode](/docs/03-concepts/team-mode)
[Quickstart Guide](/docs/00-getting-started/00-quickstart)
[CLI Reference](/docs/04-reference/cli-reference)

<!-- ❌ Incorrect: Relative paths -->

[Team Mode](./team-mode)
[Team Mode](../concepts/team-mode)
```

**Why absolute paths?**

- Robust during directory refactors
- Work consistently in all contexts (navigation, search, external links)
- Easier for contributors (one pattern to remember)
- Future-proof for multi-site deployments

**Path format:**

`/docs/{section-number}-{section-name}/{page-name}`

Examples:

- `/docs/00-getting-started/00-quickstart`
- `/docs/01-guides/05-team-guide`
- `/docs/02-customization/overlays`
- `/docs/03-concepts/team-mode`
- `/docs/04-reference/cli-reference`

**How to find the correct path:**

1. Check the `_meta.json` file in that section for the section number
2. Use the file name without the `.md` extension
3. Join with `/docs/` prefix

The generation script automatically transforms these to absolute URLs for GitHub:

```markdown
See [team mode](/docs/03-concepts/team-mode) for details.
```

### External links

External links remain unchanged:

```markdown
[GitHub repository](https://github.com/AlignTrue/aligntrue)
```

### Anchor links

Anchor links are preserved:

```markdown
See [installation](#installation) below.
```

## Testing locally

### Test docs site

```bash
cd apps/docs
pnpm dev
# Open http://localhost:3001
```

### Test generation script

```bash
pnpm generate:repo-files
```

### Test both

```bash
pnpm docs:build
```

This runs generation then builds the docs site.

## CI validation

CI enforces the docs-first workflow by validating that repo files match their generated versions.

### Validation script

The validation script (`scripts/validate-repo-files.ts`) will be added in Phase 3 to:

- Run generation in dry-run mode
- Compare generated output with committed files
- Fail if differences detected (manual edits found)

### What happens if you edit repo files directly

If you manually edit `README.md`, `CONTRIBUTING.md`, `DEVELOPMENT.md`, or `POLICY.md`:

1. Local workflow works fine
2. CI fails with validation error
3. Error message points to this docs editing guide
4. You need to:
   - Revert the manual edits
   - Make changes in `apps/docs/content/` instead
   - Run `pnpm generate:repo-files`
   - Commit both docs source and generated files

## Auto-generation headers

Generated files include a header warning against manual edits:

```markdown
<!-- AUTO-GENERATED from apps/docs/content - DO NOT EDIT DIRECTLY -->
<!-- Edit the source files in apps/docs/content and run 'pnpm generate:repo-files' -->
```

And a footer linking back to the docs site:

```markdown
---

**This file is auto-generated from the AlignTrue documentation site.**
**To propose changes, edit the source files in `apps/docs/content/` and run `pnpm generate:repo-files`.**
```

## Benefits of docs-first

1. **Single source of truth** - Docs site is canonical
2. **No drift** - Repo files always match docs
3. **Better structure** - Multi-page docs vs single flat files
4. **Easier maintenance** - Edit in one place, export everywhere
5. **Aligned with philosophy** - IR-first → exports (just like AlignTrue itself)

## Common tasks

### Add a new docs page

1. Create file in `apps/docs/content/`
2. Update `_meta.json` in that directory
3. Add cross-links from related pages
4. Run `pnpm generate:repo-files` if it affects repo files

### Reorganize docs structure

1. Move/rename files in `apps/docs/content/`
2. Update all `_meta.json` files
3. Update cross-references
4. Run `pnpm generate:repo-files`
5. Test navigation on docs site

### Update README content

1. Edit `apps/docs/content/index.mdx`
2. Run `pnpm generate:repo-files`
3. Verify `README.md` looks correct
4. Commit both files

## Questions?

- See [getting started](/docs/06-contributing/getting-started) for development setup
- See [workspace structure](/docs/08-development/workspace) for repo layout
- See [architecture](/docs/08-development/architecture) for design principles
