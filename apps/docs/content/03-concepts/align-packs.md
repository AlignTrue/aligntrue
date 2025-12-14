---
description: Bundle multiple rules into a reusable .align.yaml pack for CLI and Catalog.
---

# Align packs (.align.yaml)

Use a `.align.yaml` manifest to publish a multi-file Align that keeps its folder structure for previews, downloads, and sync. Packs work in both the CLI and the Align Catalog.

## When to use a pack

- Share a curated bundle (multiple rules, skills, MCP configs) with a single URL.
- Keep subdirectories intact (e.g., `frontend/`, `backend/`).
- Ship author defaults (exporters, mode) and per-file customizations.

### What works today

- **Remote:** GitHub URLs (repo root, subdirectory, or direct manifest) are auto-resolved as packs first; if no `.align.yaml` is found, the CLI falls back to plain git import.
- **Local:** Use a direct file path or a git URL to the repo that contains the manifest.

## Manifest formats

> Catalog note: the Align Catalog only stores title, description, author, and files. Fields like `id`, `version`, `license`, `tags`, and `defaults` matter for CLI authoring but are not stored in the catalog; catalog-created packs auto-generate what they need.

### Minimal

```yaml
id: aligntrue/example-starter
version: 1.0.0
summary: "Example starter pack with global, testing, and TypeScript rules"
author: "@aligntrue"
includes:
  rules:
    - "rules/*.md"
```

### Full (all fields)

```yaml
id: author/pack-name
version: 1.2.3
summary: "One-line description"
description: "Longer description for catalog previews"
author: "@handle"
license: MIT
homepage: https://docs.example.com
repository: https://github.com/author/repo
tags: [security, frontend]
compatible_agents: [cursor, claude, github-copilot]
defaults:
  exporters: [cursor, agents]
  mode: solo
includes:
  rules:
    - "rules/**/*.md"
  skills:
    - "skills/**/*.md"
  mcp:
    - "mcp/**/*.yaml"
customizations:
  rules/backend.md:
    plugs:
      service_name: payments
    frontmatter:
      globs: ["services/payments/**"]
      enabled: true
```

## Field reference

- **id** (required): `author/name` slug (`^[a-z0-9-]+/[a-z0-9-]+$`).
- **version** (required): SemVer.
- **summary, description, author, license, homepage, repository**: optional metadata for discovery. Use `description` for longer catalog blurbs.
- **includes**:
  - `rules`, `skills`, `mcp`: arrays of relative globs; no absolute paths or `..`; resolved from the manifest directory.
- **defaults** (optional):
  - `exporters`: default exporters to enable (e.g., `cursor`, `agents`).
  - `mode`: `solo` or `team`.
- **customizations** (optional): keyed by relative file path; supports `plugs` and `frontmatter` overrides (e.g., `globs`, `enabled`, additional frontmatter keys).
- **tags**, **compatible_agents**: optional lists for discovery.

## Limits

- Up to **100 files** total.
- Max **500KB per file**.
- Max **2MB per pack**.

## Create a pack

1. Add your rule files under a folder (e.g., `rules/`).
2. Create `.align.yaml` in that folder with `id`, `version`, and `includes`.
3. Keep glob paths relative to the manifest location.
4. Validate locally if needed: `pnpm validate path/to/.align.yaml`.
5. See the live example in `examples/example-pack/`.

## Use packs with the CLI

- Import during init:  
  `aligntrue init --source https://github.com/org/repo`  
  (auto-detects `.align.yaml` in the repo or subdirectory)
- Keep as a connected source:  
  `aligntrue add source https://github.com/org/repo/path/to/pack`  
  `aligntrue sync`
- Pin a version or branch:  
  `aligntrue add source https://github.com/org/repo@v1.2.3/path/to/pack`
- Direct manifest URL also works:  
  `aligntrue init --source https://raw.githubusercontent.com/org/repo/main/path/.align.yaml`

Behavior:

- Pack resolution runs first for GitHub URLs; on failure it falls back to regular git import.
- Matching files keep their relative paths when exported or downloaded.

## Use packs with the Align Catalog

- Paste a GitHub URL to a repo, directory, or `.align.yaml` into the Catalog.
- Preview individual files, switch agent formats, and download a zip that preserves paths.
- See the full flow in the [Align Catalog guide](/docs/01-guides/10-align-catalog).

## Examples

- Starter pack: `examples/example-pack/`

## Troubleshooting

- **No .align.yaml found:** ensure the manifest exists on the target ref/path; GitHub only for automatic pack detection.
- **No files matched includes:** verify relative globs from the manifest directory and avoid `..` or absolute paths.
