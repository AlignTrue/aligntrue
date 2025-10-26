# @aligntrue/markdown-parser

Literate markdown parser for AlignTrue - extracts fenced ```aligntrue blocks and converts to IR.

## Features

- Extract fenced code blocks with ```aligntrue language tag
- Validate one block per section rule
- Preserve prose guidance before blocks
- Normalize whitespace before hashing
- Build canonical IR from YAML blocks

## Usage

```typescript
import { parseMarkdown, buildIR } from '@aligntrue/markdown-parser';

const result = parseMarkdown(markdownContent);
const ir = buildIR(result.blocks);
```

## Package Status

🚧 **Phase 1, Week 1** - Stub interfaces, implementation in progress

