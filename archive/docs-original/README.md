# Archived Original Documentation

**Date:** 2025-10-31  
**Reason:** Migrated to Nextra documentation site

## What happened

All documentation files from `/docs` have been migrated to the Nextra documentation site at `apps/docs/pages/`.

## New structure

Documentation is now organized as:

- **Getting Started:** `apps/docs/pages/getting-started/`
  - Quick start guide

- **Concepts:** `apps/docs/pages/concepts/`
  - Catalog, team mode, overlays, drift detection, sync behavior, git workflows

- **Reference:** `apps/docs/pages/reference/`
  - CLI commands, import workflow, git sources, backup/restore, auto-updates, file watcher, privacy, troubleshooting

- **Contributing:** `apps/docs/pages/contributing/`
  - Getting started, adding exporters, team onboarding, testing workflow

## Migration details

Original flat structure in `/docs` reorganized into Nextra-compatible hierarchy with:

- Frontmatter for SEO (title, description)
- Navigation metadata (`_meta.json` files)
- Proper cross-references using relative paths

## Viewing documentation

Development server:

```bash
cd apps/docs
pnpm dev
```

Documentation will be available at http://localhost:3000

## Files archived

All original markdown files from `/docs`:

- quickstart.md, catalog.md, team-mode.md, overlays.md
- drift-detection.md, sync-behavior.md, git-workflows.md
- commands.md, import-workflow.md, git-sources.md
- backup-restore.md, auto-updates.md, file-watcher-setup.md
- PRIVACY.md, pre-1.0-policy.md
- troubleshooting.md, troubleshooting-overlays.md
- extending-aligntrue.md, onboarding.md

These files remain archived for reference but are no longer the canonical documentation source.
