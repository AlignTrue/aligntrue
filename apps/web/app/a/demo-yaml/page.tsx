import { AlignDetailClient } from "../[id]/AlignDetailClient";
import type { AlignRecord } from "@/lib/aligns/types";
import type { CachedContent } from "@/lib/aligns/content-cache";

const demoPackAlign: AlignRecord = {
  id: "demo-pack",
  url: "https://github.com/AlignTrue/examples/tree/main/aligns/pack-demo",
  normalizedUrl:
    "https://github.com/AlignTrue/examples/tree/main/aligns/pack-demo",
  provider: "github",
  kind: "pack",
  title: "Sample Align Pack",
  description: "Demo pack with multiple rules scoped by path.",
  author: "@aligntrue",
  fileType: "yaml",
  createdAt: new Date().toISOString(),
  lastViewedAt: new Date().toISOString(),
  viewCount: 0,
  installClickCount: 0,
  pack: {
    files: [
      { path: "rules/typescript.md", size: 312 },
      { path: "rules/testing.md", size: 276 },
      { path: "rules/docs.md", size: 244 },
    ],
    totalBytes: 312 + 276 + 244,
  },
};

const demoPackContent: CachedContent = {
  kind: "pack",
  files: [
    {
      path: "rules/typescript.md",
      size: 312,
      content: `---
title: TypeScript defaults
description: Starter TS rules
globs:
  - "**/*.ts"
  - "**/*.tsx"
---

- Prefer strict null checks.
- Use ESLint extends: "plugin:@typescript-eslint/recommended".
- Disallow implicit any; enable noUnusedLocals/noUnusedParameters.
`,
    },
    {
      path: "rules/testing.md",
      size: 276,
      content: `---
title: Testing guidance
description: Keep tests small and fast
globs:
  - "tests/**/*.ts"
---

- Co-locate tests with code when practical.
- Avoid network calls; stub or mock instead.
- Keep tests under 200ms; mark slow tests explicitly.
`,
    },
    {
      path: "rules/docs.md",
      size: 244,
      content: `---
title: Docs and examples
description: Documentation hygiene
globs:
  - "docs/**/*.md"
---

- Keep examples runnable.
- Prefer short snippets over long walls of text.
- Document defaults and assumptions explicitly.
`,
    },
  ],
};

export default function DemoAlignPackPage() {
  return <AlignDetailClient align={demoPackAlign} content={demoPackContent} />;
}
