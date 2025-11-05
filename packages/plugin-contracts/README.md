# @aligntrue/plugin-contracts

**Plugin interface definitions for the AlignTrue ecosystem.**

This package contains TypeScript interfaces and type definitions for all AlignTrue plugins. It contains no implementations—only contracts that plugins must implement.

## Purpose

AlignTrue uses a plugin architecture to support multiple AI agents and development workflows. Plugin contracts define the interface between the core orchestration engine and plugin implementations.

By keeping contracts separate from implementations:

- **Clear boundaries:** Plugins depend on contracts, not on each other
- **Scalability:** New plugin types can be added without circular dependencies
- **Versioning:** Contract changes are explicit and can be versioned independently
- **Testing:** Mock implementations can implement contracts for testing

## Architecture

```
@aligntrue/schema (data structures)
   ↓
@aligntrue/plugin-contracts (interfaces)  ← This package
   ↓
@aligntrue/core (orchestration) + Plugin implementations (exporters, etc.)
```

## Plugin Types

### Exporters (Phase 1)

Exporters convert AlignTrue IR (Intermediate Representation) to agent-specific formats.

**Interface:** `ExporterPlugin`

```typescript
import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
} from "@aligntrue/plugin-contracts";

export class MyExporter implements ExporterPlugin {
  name = "my-exporter";
  version = "1.0.0";

  async export(request: ScopedExportRequest, options: ExportOptions) {
    // Convert request.rules to agent format
    // Write to options.outputDir
    return {
      success: true,
      filesWritten: [".myagent/rules.txt"],
      contentHash: "sha256...",
      fidelityNotes: ["field X not supported"],
    };
  }
}
```

**Key types:**

- `ExporterPlugin` - Main plugin interface
- `ScopedExportRequest` - Rules + scope information
- `ExportOptions` - Output directory and flags
- `ExportResult` - Files written, hash, fidelity notes
- `AdapterManifest` - Declarative manifest.json metadata

### Future Plugin Types

- **Importers:** Convert agent-specific formats back to IR (Phase 2)
- **Sources:** Fetch rules from git, catalog, URLs (expanded in Phase 2)
- **MCP Servers:** Model Context Protocol integrations (Phase 2+)

## Usage

### For Plugin Implementers

```typescript
import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
} from "@aligntrue/plugin-contracts";

export class MyExporter implements ExporterPlugin {
  // Implementation
}
```

### For Core/Orchestration

```typescript
import type { ExporterPlugin } from "@aligntrue/plugin-contracts";

function runExporter(plugin: ExporterPlugin, request: ScopedExportRequest) {
  return plugin.export(request, { outputDir: ".myagent" });
}
```

## Scoped Exports

Exporters are called once per scope with pre-merged rules:

```typescript
// Default scope
await exporter.export(
  {
    scope: { path: ".", normalizedPath: ".", isDefault: true },
    rules: [rule1, rule2],
    outputPath: ".cursor/rules/aligntrue.mdc",
  },
  options,
);

// Named scope (monorepo)
await exporter.export(
  {
    scope: { path: "apps/web", normalizedPath: "apps/web", isDefault: false },
    rules: [rule3, rule4],
    outputPath: ".cursor/rules/apps-web.mdc",
  },
  options,
);
```

## Philosophy

**Why separate contracts from implementations?**

1. **Dependency Management:** Prevents circular dependencies between core and plugins
2. **Semantic Clarity:** Interfaces represent abstract contracts, not concrete behavior
3. **Versioning:** Contract changes can be versioned independently from implementations
4. **Testing:** Easy to create mocks and stubs for testing
5. **Scalability:** New plugin types can be added without refactoring existing code

**Why not put contracts in `@aligntrue/schema`?**

Schema defines data structures (IR format, validation rules). Plugin contracts define behavioral interfaces. These are different concerns and should live in separate packages.

**Why not put contracts in `@aligntrue/core`?**

Core orchestrates plugins but shouldn't define their contracts. Plugins depend on contracts, not on the orchestration engine. This keeps the dependency graph clean:

```
Correct:   Plugin → Contracts
Incorrect: Plugin → Core (creates coupling)
```

## API Reference

See TypeScript definitions in `src/exporter.ts` for detailed documentation.

## Contributing

When adding new plugin types:

1. Create a new file: `src/<plugin-type>.ts`
2. Export types from `src/index.ts`
3. Document usage in this README
4. Update `packages/core` to use new contracts
5. Create example implementation

## License

MIT
