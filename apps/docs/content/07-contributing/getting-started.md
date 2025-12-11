---
title: How to contribute
description: Getting started with AlignTrue contributions — find issues, understand the workflow, and make your first PR.
---

# How to contribute

This guide explains how to find issues, understand the contribution workflow, and submit your first pull request.

## Finding something to work on

### Look for good first issues

GitHub has a `good-first-issue` label for problems ideal for new contributors:

1. Go to [AlignTrue issues](https://github.com/AlignTrue/aligntrue/issues)
2. Filter by label: `good-first-issue`
3. Pick one that interests you and comment to claim it

### Browse open issues

Not limited to first issues? You can:

- Look at [open issues](https://github.com/AlignTrue/aligntrue/issues) and filter by type (bug, enhancement, documentation)
- Search by component (cli, exporters, schema, docs)
- Check [GitHub Issues](https://github.com/AlignTrue/aligntrue/issues?q=is%3Aissue+is%3Aopen+label%3Aaccepted) for accepted ideas

### Ask what's needed

Unsure what would help? Ask in [GitHub Discussions](https://github.com/AlignTrue/aligntrue/discussions). The team is happy to suggest areas that need work.

## Contribution workflow

### 1. Set up your environment

See [Development setup](/docs/06-development/setup) for:

- Node.js and pnpm requirements
- How to clone and install dependencies
- Local development commands

### 2. Create a feature branch

Start a new branch from `main`:

```bash
git checkout main
git pull origin main
git checkout -b fix/brief-description
```

Use a clear branch name:

- `fix/...` for bug fixes
- `feat/...` for new features
- `docs/...` for documentation
- `refactor/...` for code improvements

### 3. Make your changes

Work on your contribution:

- Follow the relevant guide:
  - [Creating Aligns](/docs/07-contributing/creating-aligns) for rule sets
  - [Editing documentation](/docs/07-contributing/editing-docs) for docs
  - [Adding exporters](/docs/07-contributing/adding-exporters) for new agents
  - [Development guide](/docs/06-development) for code changes
- Write tests alongside your changes
- Run tests frequently: `pnpm test`

### 4. Verify quality

Before submitting, run checks locally:

```bash
# Format and lint
pnpm lint

# Run tests
pnpm test

# Build docs site (for docs changes)
pnpm --filter @aligntrue/docs build
```

- Pre-commit mirrors these checks and also builds affected packages when TypeScript files are staged (`pnpm build:packages`). Running them before committing avoids hook failures.

### 5. Write a good commit message

Use clear, present-tense commit messages:

```bash
git commit -m "feat(exporters): Add Cursor exporter with content hash"
```

Format: `type(scope): description`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`

- Subject must be sentence case (start with a capital letter).
- Keep scope small and accurate; omit it only when it adds no clarity.

### 6. Update CHANGELOG.md (for user-facing changes)

If your change affects users, add an entry to `CHANGELOG.md`:

```markdown
### Added

- New align for TypeScript projects
```

For CHANGELOG entries, follow the format shown in the example above: start with a category (Added, Changed, Fixed, etc.) and write a clear, user-facing description.

### 7. Push and open a PR

Push your branch:

```bash
git push origin fix/brief-description
```

Then open a pull request on GitHub:

- Use a clear title: "Fix flaky test in sync command"
- Describe what changed and why
- Reference any related issues: "Fixes #123"
- Link to any relevant docs

### 8. Respond to review

- Maintainers will review your PR
- Address feedback and push updates
- Ask questions if anything is unclear
- Once approved, maintainers will merge

## PR acceptance criteria

Your PR will be reviewed against:

- **Code quality**: Follows project patterns and style
- **Tests**: Changes have appropriate test coverage
- **Documentation**: User-facing changes are documented
- **No breaking changes**: Unless explicitly planned
- **Commit hygiene**: Clear messages and appropriate scope

All PRs should follow these criteria: pass CI checks, include tests, maintain code quality, and have clear commit messages.

## Testing requirements

All contributions need tests. See [Testing workflow](/docs/07-contributing/testing-workflow) for:

- Test structure and patterns
- How to write determinism tests
- Coverage expectations
- Running tests locally

## Common scenarios

### "I'm only fixing documentation"

1. Edit files in `apps/docs/content/`
2. The pre-commit hook auto-regenerates protected files
3. Build locally with `pnpm --filter @aligntrue/docs build` if you want to preview changes
4. Just commit your source edits; regenerated repo files are handled by the hook when relevant

See [Editing documentation](/docs/07-contributing/editing-docs) for details.

### "I want to add a new exporter"

See the [Adding exporters](/docs/07-contributing/adding-exporters) guide for:

- Manifest structure
- Handler implementation
- Required tests
- Contribution process

### "I want to create Aligns"

See [Creating Aligns](/docs/07-contributing/creating-aligns) for:

- Naming conventions
- Validation requirements
- Sharing with the community

### "My PR is incomplete"

- Mark it as a draft in GitHub
- Prefix title with `[WIP]`
- Describe what's done and what's left
- We can provide early feedback

### "I need help with my PR"

Comment on the PR with questions. We're happy to help debug or explain patterns.

## Etiquette

### Claiming issues

- Comment on an issue if you want to work on it
- If no one claims it in 2 weeks, it's fair game
- Some issues may be reserved for maintainers (labeled accordingly)

### Asking questions

- Ask in [discussions](https://github.com/AlignTrue/aligntrue/discussions) rather than opening issues for questions
- Share context and what you've already tried

### Reviewing others' PRs

- All community members are welcome to review PRs
- Be respectful and constructive
- Suggest improvements, don't demand changes

## Next steps

- **Ready to contribute?** Pick an issue from [good-first-issue](https://github.com/AlignTrue/aligntrue/issues?q=label%3Agood-first-issue)
- **Want more context?** Read the [Contributing index](/docs/07-contributing)
- **Need setup help?** See [Development setup](/docs/06-development/setup)
- **Specific guide?** Choose your contribution type:
  - [Creating Aligns](/docs/07-contributing/creating-aligns)
  - [Editing documentation](/docs/07-contributing/editing-docs)
  - [Adding exporters](/docs/07-contributing/adding-exporters)
  - [Testing workflow](/docs/07-contributing/testing-workflow)
