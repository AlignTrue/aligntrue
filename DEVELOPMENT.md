# Development Guide

## Prerequisites

- **Node.js** 20 or later
- **pnpm** 9 or later

Install pnpm if you don't have it:

```bash
npm install -g pnpm@9
```

## Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

This will install dependencies for all workspace packages.

### 2. Development Commands

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
pnpm test
```

#### Type-check all packages

```bash
pnpm typecheck
```

#### Lint

```bash
pnpm lint
```

#### Clean

```bash
# Remove all node_modules and build artifacts
pnpm clean

# Remove temp files created by AI/debugging
pnpm clean-temp
```

## Workspace Structure

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

## Working on Packages

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

## Code Quality

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

## Common Tasks

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

## CI/CD

CI runs on every PR:

- `pnpm typecheck` - Type checking
- `pnpm lint` - Linting
- `pnpm test` - Tests
- `pnpm build` - Production build

All must pass before merge.

## Contributing

See `CONTRIBUTING.md` for contribution guidelines.

## Phase 1 Status

We are currently in Phase 1 preparation:

- ✅ Workspace structure set up
- ✅ Spec v1 documented
- ✅ Base aligns converted to Spec v1
- 🚧 Next: Implement Stage 1.0 (Spec v1 + Canonicalization)

See `.cursor/rules/phase1_priorities.mdc` for the full roadmap.

