# Getting Started with AlignTrue Development

This guide covers setting up your development environment and contributing to AlignTrue.

## Prerequisites

- **Node.js** 20+ (use `nvm` for version management)
- **pnpm** 8+ (workspace package manager)
- **Git** 2.40+

## Initial Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/AlignTrue/aligntrue.git
   cd aligntrue
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Build all packages:**

   ```bash
   pnpm build
   ```

4. **Run tests:**
   ```bash
   pnpm test
   ```

## Development Workflow

### Running Tests

**Full test suite:**

```bash
pnpm test
```

**Specific package:**

```bash
cd packages/core
pnpm test
```

**Watch mode:**

```bash
pnpm test -- --watch
```

**Test with coverage:**

```bash
pnpm test -- --coverage
```

### Building Packages

**Build all:**

```bash
pnpm build
```

**Build specific package:**

```bash
cd packages/cli
pnpm build
```

**Watch mode (development):**

```bash
cd packages/cli
pnpm build -- --watch
```

### Linting and Type Checking

**Lint all packages:**

```bash
pnpm lint
```

**Type check all packages:**

```bash
pnpm typecheck
```

**Fix linting issues:**

```bash
pnpm lint:fix
```

## Project Structure

```
aligntrue/
├── packages/
│   ├── core/              Config, sync engine, overlays
│   ├── schema/            IR validation, canonicalization
│   ├── cli/               CLI commands and interface
│   ├── exporters/         Agent-specific exporters (43 adapters)
│   ├── markdown-parser/   Literate markdown parsing
│   ├── sources/           Multi-source providers (local, git, catalog)
│   ├── checks/            Machine-checkable rules engine
│   └── testkit/           Conformance vectors
├── apps/
│   └── web/               Catalog website (Next.js)
├── catalog/
│   └── examples/          11 curated packs (local catalog seed)
├── docs/                  User and contributor documentation
└── .cursor/rules/         AI development guidance (private)
```

## Making Changes

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes

- Follow TypeScript strict mode
- Add tests for new functionality
- Update documentation as needed
- Follow existing code patterns

### 3. Run Validation

```bash
pnpm typecheck  # Type check all packages
pnpm lint       # Lint all packages
pnpm test       # Run all tests
pnpm build      # Build all packages
```

### 4. Commit Your Changes

We use Conventional Commits format:

```bash
git commit -m "feat: Add new overlay selector syntax"
git commit -m "fix: Resolve sync validation bug"
git commit -m "docs: Update team mode guide"
```

**Commit types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Test updates
- `chore`: Build/tooling changes
- `perf`: Performance improvements

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then open a Pull Request on GitHub.

## Testing Guidelines

See [testing-workflow.md](./testing-workflow.md) for detailed testing practices.

**Key principles:**

- Write tests first (TDD workflow when appropriate)
- Test boundaries and edge cases
- Use descriptive test names
- Keep tests deterministic (no flaky tests)
- Mock external dependencies

## Code Style

- **TypeScript strict mode** enabled
- **ESLint + Prettier** configured at workspace root
- **Explicit over dynamic** - prefer static dispatch over registries
- **Flat over nested** - max 3 levels of directory nesting
- **Small, focused modules** - easier for AI to reason about

## Common Tasks

### Adding a New Exporter

See [adding-exporters.md](./adding-exporters.md) for detailed guide.

### Adding a New CLI Command

1. Create command file in `packages/cli/src/commands/`
2. Implement command following framework pattern
3. Add tests in `packages/cli/tests/commands/`
4. Update CLI help text
5. Document in `docs/commands.md`

### Updating Schema

1. Update `packages/schema/src/validator.ts`
2. Update JSON Schema if needed
3. Add validation tests
4. Update documentation
5. Consider pre-1.0 migration policy

## Getting Help

- **Documentation:** Check `docs/` for detailed guides
- **Architecture decisions:** See `.internal_docs/architecture-decisions.md`
- **Issues:** Open GitHub issue with detailed context
- **Discussions:** Use GitHub Discussions for questions

## Pre-commit Hooks

Git hooks are configured via Husky:

- **commit-msg:** Validates conventional commit format
- **pre-commit:** Runs linting on staged files
- **pre-push:** Full type check, tests, and build

## CI/CD

GitHub Actions runs on every push:

- Type checking across all packages
- Full test suite (1800+ tests)
- Build verification
- Lint checks

## Release Process

(Post-1.0 - currently in alpha)

1. Update `CHANGELOG.md`
2. Bump version in root `package.json`
3. Tag release: `git tag v0.x.x`
4. Push tag: `git push origin v0.x.x`
5. GitHub Actions publishes to npm

## Additional Resources

- [Testing Workflow](./testing-workflow.md)
- [Adding Exporters](./adding-exporters.md)
- [Team Onboarding](./team-onboarding.md)
- [Architecture Guidelines](.cursor/rules/architecture.mdc)
- [Implementation Specs](.cursor/rules/implementation_specs.mdc)

---

**Questions?** Open a GitHub Discussion or issue for help.
