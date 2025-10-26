# @aligntrue/sources

Multi-source rule pulling with caching for AlignTrue.

## Features

- **Local provider** - Read rules from local filesystem
- **Catalog provider** - Fetch from AlignTrue catalog (Phase 1)
- **Git provider** - Clone and read from git repos (Phase 2+)
- **URL provider** - Fetch from arbitrary URLs (Phase 2+)
- **Cache management** - Local cache in .aligntrue/.cache/

## Usage

```typescript
import { createProvider } from '@aligntrue/sources';

const provider = createProvider({ type: 'local', path: './rules' });
const content = await provider.fetch('my-rule.yaml');
```

## Package Status

🚧 **Phase 1, Week 1** - Stub interfaces, implementation in progress

