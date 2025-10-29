# Development guide

## Prerequisites

- **Node.js** 20 or later (`.node-version` file included for Volta/asdf/nvm)
- **pnpm** 9 or later

Install pnpm if you don't have it:

```bash
npm install -g pnpm@9
```

## Quick start

Bootstrap the entire project with one command:

```bash
pnpm bootstrap
```

This installs dependencies and builds all packages. You're ready to develop!

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

This will install dependencies for all workspace packages and set up Git hooks automatically.

### 2. Development commands

#### Run the web app locally

```bash
pnpm dev
```

Opens the Next.js app at `http://localhost:3000` (from `apps/web`)

#### Build all packages

```bash
pnpm build
```

#### Run tests

```bash
pnpm test        # All tests across all packages
pnpm test:fast   # Fast reporter for quick feedback
```

#### Type-check all packages

```bash
pnpm typecheck
```

#### Format

```bash
pnpm format        # Format code with Prettier
pnpm format:check  # Check formatting without changes
```

#### Clean

```bash
# Remove all node_modules and build artifacts
pnpm clean

# Remove temp files created by AI/debugging
pnpm clean-temp
```

## Workspace structure

```
aligntrue/
├── apps/
│   ├── web/          # Next.js catalog site
│   └── docs/         # Nextra documentation
├── packages/
│   ├── schema/       # JSON Schema, canonicalization, hashing
│   ├── cli/          # aligntrue/aln CLI
│   └── mcp/          # MCP server (Phase 2+)
└── basealigns/       # Temporary: will move to aligns repo
```

## Working on packages

### packages/schema

Core validation and canonicalization logic.

```bash
cd packages/schema
pnpm test:watch    # Run tests in watch mode
pnpm build         # Build to dist/
```

### packages/cli

The CLI that consumes the schema package.

```bash
cd packages/cli
pnpm build
node dist/index.js --help
```

### apps/web

The Next.js catalog site.

```bash
cd apps/web
pnpm dev           # Start dev server
pnpm build         # Production build
```

## Code quality

### TypeScript

- All packages use strict TypeScript
- Extends `tsconfig.base.json` from repo root
- No `any` types allowed
- Use `unknown` and narrow types

### Formatting

EditorConfig is configured at the root. Use:

- 2 spaces for indentation
- LF line endings
- UTF-8 encoding

### Testing

- Unit tests go in `packages/*/tests/`
- Keep tests fast (<1s per test)
- Make tests deterministic (no real time, network, or randomness)
- See [Running tests locally](#running-tests-locally) for detailed commands

## Common tasks

### Add a new package

1. Create directory under `packages/`
2. Add `package.json` with workspace dependencies
3. Create `tsconfig.json` extending base
4. Add to workspace commands in root `package.json`

### Update dependencies

```bash
pnpm update --latest --recursive
```

### Check for security issues

```bash
pnpm audit
```

## Troubleshooting

### "Command not found: pnpm"

Install pnpm globally:

```bash
npm install -g pnpm@9
```

### "Module not found" errors

Reinstall dependencies:

```bash
pnpm clean
pnpm install
```

### Type errors after changes

Run type-check to see all errors:

```bash
pnpm typecheck
```

### Hooks not running

If Git hooks aren't running after `pnpm install`:

```bash
pnpm prepare
```

This manually runs the Husky setup.

## Running tests locally

### All tests

Run the full test suite across all packages:

```bash
pnpm test
```

### Specific package

Test a single package:

```bash
pnpm --filter @aligntrue/cli test
pnpm --filter @aligntrue/schema test
pnpm --filter @aligntrue/core test
```

### Specific test file

Run a specific test file:

```bash
pnpm --filter @aligntrue/cli vitest run tests/commands/sync.test.ts
```

### Watch mode

Run tests in watch mode for rapid feedback during development:

```bash
# Watch all tests in a package
pnpm --filter @aligntrue/cli vitest

# Watch specific test file
pnpm --filter @aligntrue/cli vitest tests/commands/sync.test.ts

# Watch with UI
pnpm --filter @aligntrue/cli vitest --ui
```

### With coverage

Generate coverage reports:

```bash
pnpm --filter @aligntrue/cli vitest --coverage
```

### Deterministic test environment

Match CI environment exactly (useful for debugging CI failures):

```bash
TZ=UTC pnpm test
```

### Fast feedback mode

Use the fast reporter for quicker output:

```bash
pnpm test:fast
```

## Git hooks and quality guardrails

This project uses Husky to automatically run quality checks. Hooks are installed automatically when you run `pnpm install`.

### Pre-commit hook

Runs automatically before each commit (takes ~2-3 seconds):

- Formats code with Prettier
- Only runs on staged files for speed

**Note:** If you modify `package.json`, manually run `pnpm install` to update the lockfile before committing.

If the hook fails, fix the issues and try committing again.

### Commit message hook

Validates commit messages follow Conventional Commits format:

```bash
# Good commit messages
feat: Add drift detection command
fix: Resolve lockfile sync issue
docs: Update DEVELOPMENT.md with testing guide
chore: Update dependencies

# Bad commit messages (will be rejected)
updated stuff
WIP
fixes bug
```

Format: `type: Subject in sentence case`

Valid types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`

### Pre-push hook

Runs automatically before pushing (takes ~30-60 seconds):

- Full typecheck across all packages
- Full test suite (all packages)
- Full build to catch build errors
- Mirrors CI validation

This ensures you never push code that will fail CI.

### Bypassing hooks (emergency only)

If hooks are genuinely broken (not just failing validation):

```bash
git commit --no-verify   # Skip pre-commit
git push --no-verify     # Skip pre-push
```

**Only use when hooks are broken, not to skip validation.**

## Versioning with Changesets

We use Changesets for managing package versions and changelogs.

### Creating a changeset

After making changes, create a changeset describing your changes:

```bash
pnpm changeset
```

Follow the prompts to:

1. Select which packages changed
2. Choose version bump type (major/minor/patch)
3. Write a summary of changes

The changeset file will be committed with your changes.

### Versioning packages

To consume changesets and bump versions:

```bash
pnpm version
```

This updates `package.json` versions and `CHANGELOG.md` files.

### Publishing packages

After versioning, publish to npm:

```bash
pnpm release
```

This builds all packages and publishes them to npm.

## CI/CD

CI runs on every PR:

- Lockfile sync validation
- `pnpm typecheck` - Type checking
- `pnpm test` - Tests
- `pnpm build` - Production build
- Integration tests
- Golden repository validation

All must pass before merge.

**Note:** Pre-push hooks mirror CI checks, so if pre-push passes, CI should pass too.

## Troubleshooting

### Pre-commit hook fails with formatting errors

The hook auto-formats code with Prettier. If it still fails, check the error output for issues with the lockfile update or other problems.

### Pre-push hook is too slow

Pre-push runs the full validation suite (~30-60 seconds). This is intentional to catch issues before CI.

For faster iteration during development, use watch mode for tests instead of relying on hooks.

### Commit message rejected

Ensure your commit message follows Conventional Commits format:

```bash
<type>: <description>
```

Example: `feat: Add new command` or `fix: Resolve memory leak`

## Contributing

See `CONTRIBUTING.md` for contribution guidelines.
