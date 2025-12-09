---
description: Use .align.yaml to ship multi-file rule packs with scoped paths.
---

# Align YAML packs

`.align.yaml` manifests let you publish multiple rule files as a single pack. AlignTrue will resolve the manifest, pull all included files, and keep their directory structure for previews and downloads.

## Manifest format

```yaml
id: aligntrue/example-pack
version: 1.0.0
summary: Starter rules for frontend + backend scopes
author: "@aligntrue"
includes:
  rules:
    - scopes/frontend/**/*.md
    - scopes/backend/**/*.md
  skills:
    - skills/**/*.md
  mcp:
    - mcp/**/*.yaml
```

## Limits

- 100 files max (all includes combined)
- 500KB per file max
- 2MB total pack size max

## Usage (CLI)

- Import once: `npx aligntrue init --source https://github.com/org/repo` (auto-detects `.align.yaml` in the repo or directory)
- Keep as source: `aligntrue add source https://github.com/org/repo && aligntrue sync`

## Usage (Catalog)

- Paste a GitHub directory or manifest URL into the catalog
- Preview any file via the picker, select an agent format, and download a zip that preserves the original folder structure
