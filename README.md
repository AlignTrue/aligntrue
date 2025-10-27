# AlignTrue

AI-native rules and alignment platform. Turn small, composable YAML rules (Aligns) into deterministic bundles and agent-ready exports.

## Workspace Structure

This is a pnpm monorepo with the following packages:

```
aligntrue/
├── apps/
│   ├── web/          # Next.js catalog site (aligntrue.com)
│   └── docs/         # Nextra documentation site (/docs)
├── packages/
│   ├── schema/       # JSON Schema, canonicalization, hashing
│   ├── cli/          # Node CLI (aligntrue/aln)
│   └── mcp/          # MCP server (Phase 2+)
└── basealigns/       # Temporary: base aligns (will move to aligns repo)
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

**Core Guides:**
- [MCP Scope & Boundaries](docs/mcp-scope.md) - What AlignTrue does vs doesn't do for MCP
- [AlignTrue vs Ruler](docs/aligntrue-vs-ruler.md) - When to use each tool
- [Architecture Decisions](docs/architecture-decisions.md) - Design rationale and technical decisions

**Project Documentation:**
- [Contributing Guide](CONTRIBUTING.md)
- [Development Guide](DEVELOPMENT.md)
- [Security Policy](SECURITY.md)

Full documentation will be available at aligntrue.com/docs (Phase 4).

## License

MIT (see LICENSE file)
