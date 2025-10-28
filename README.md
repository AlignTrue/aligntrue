# AlignTrue

AI-native rules and alignment platform. Turn small, composable YAML rules (Aligns) into deterministic bundles and agent-ready exports.

## Workspace Structure

This is a pnpm monorepo with the following packages:

```
aligntrue/
├── apps/
│   ├── web/          # Next.js catalog site (aligntrue.ai)
│   └── docs/         # Nextra documentation site (/docs)
├── packages/
│   ├── schema/       # JSON Schema, canonicalization, hashing
│   ├── cli/          # Node CLI (aligntrue/aln)
│   └── mcp/          # MCP server (Phase 2+)
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+

### Installation

```bash
pnpm install
```

### Development

```bash
# Start web app dev server
pnpm dev

# Build all packages
pnpm build

# Run all tests
pnpm test

# Type check all packages
pnpm typecheck
```

## Repositories

- **AlignTrue/aligntrue** (MIT, this repo): Web catalog, CLI, schema packages
- **AlignTrue/aligns** (CC0): Public rules registry
- **AlignTrue/cloud** (private): Commercial features (future)

## Documentation

**Project Documentation:**
- [Contributing Guide](CONTRIBUTING.md)
- [Development Guide](DEVELOPMENT.md)
- [Security Policy](SECURITY.md)

Full documentation will be available at aligntrue.com/docs.

## License

MIT (see LICENSE file)
