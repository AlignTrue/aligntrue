# @aligntrue/core

Configuration management, sync engine, bundle/lockfile operations, and scope resolution for AlignTrue.

## Features

- **Config management** - Parse and validate .aligntrue.yaml
- **Two-way sync** - IR ↔ agent synchronization with conflict detection
- **Scope resolution** - Hierarchical path-based scopes with merge rules
- **Bundle operations** - Dependency merge (team mode)
- **Lockfile operations** - Hash tracking with off/soft/strict modes

## Usage

```typescript
import { loadConfig, syncToAgents } from '@aligntrue/core';

const config = await loadConfig('.aligntrue.yaml');
const result = await syncToAgents('aligntrue.yaml', { dryRun: true });
```

## Package Status

🚧 **Phase 1, Week 1** - Stub interfaces, implementation in progress

