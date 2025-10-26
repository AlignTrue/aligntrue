# @aligntrue/exporters

Agent-specific exporters for AlignTrue - Cursor, AGENTS.md, VS Code MCP config.

## Features

- **Cursor exporter** - Generate .cursor/rules/*.mdc with content hash footer
- **AGENTS.md exporter** - Universal format for multiple agents
- **VS Code MCP exporter** - Generate .vscode/mcp.json configuration
- **Hybrid registry** - Declarative manifests + optional handlers
- **Fidelity notes** - Surface semantic mapping limitations

## Phase 1 Exporters

- ✅ Cursor (.mdc)
- ✅ AGENTS.md
- ✅ VS Code MCP config

## Usage

```typescript
import { CursorExporter } from '@aligntrue/exporters/cursor';

const exporter = new CursorExporter();
const result = await exporter.export(ir, { outputDir: '.cursor/rules' });
```

## Package Status

🚧 **Phase 1, Week 1** - Stub interfaces, implementation in progress

