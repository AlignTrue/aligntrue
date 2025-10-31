# AlignTrue Documentation Site Structure

This directory contains all user-facing and contributor documentation organized for Nextra (Next.js-based documentation site).

## Directory Structure

```
docs/site/
├── user-guide/         Quick start and getting started guides
├── concepts/           Core concepts and features
├── contributing/       Contributor guides
└── reference/          Complete reference documentation
```

## Content Organization

### User Guide (1 doc)

- `quickstart.md` - <5 minute setup guide

### Concepts (6 docs)

- `catalog.md` - Pack discovery and installation
- `drift-detection.md` - Detecting and categorizing rule drift
- `git-workflows.md` - Git-based rule sharing
- `overlays.md` - Fork-safe customization with overlays
- `sync-behavior.md` - Two-way sync between IR and agents
- `team-mode.md` - Team collaboration features

### Contributing (4 docs)

- `getting-started.md` - Development setup and workflow
- `adding-exporters.md` - Adding new agent adapters
- `team-onboarding.md` - Onboarding developers to teams
- `testing-workflow.md` - Testing guidelines and practices

### Reference (11 docs)

- `cli-reference.md` - Complete CLI command reference
- `auto-updates.md` - Automatic update system
- `backup-restore.md` - Backup and restore commands
- `file-watcher-setup.md` - Setting up auto-sync with file watchers
- `git-sources.md` - Configuring git-based rule sources
- `import-workflow.md` - Importing rules from agents
- `pre-1.0-policy.md` - Pre-1.0 versioning and compatibility policy
- `privacy.md` - Privacy controls and consent system
- `troubleshooting.md` - General troubleshooting guide
- `troubleshooting-overlays.md` - Overlay-specific troubleshooting
- `yaml-libraries.md` - YAML library design decisions

## Nextra Setup (Future)

When ready to deploy the docs site:

1. Install Nextra dependencies:

   ```bash
   cd docs/site
   pnpm add next nextra nextra-theme-docs
   ```

2. Create `next.config.js`:

   ```js
   const withNextra = require("nextra")({
     theme: "nextra-theme-docs",
     themeConfig: "./theme.config.tsx",
   });

   module.exports = withNextra();
   ```

3. Create `theme.config.tsx` with navigation structure matching this README

4. Add `_meta.json` files to each directory to control sidebar order

5. Add frontmatter to all docs for SEO:
   ```yaml
   ---
   title: Document Title
   description: One-line description for SEO
   ---
   ```

## Navigation Structure (Recommended)

```
AlignTrue Documentation
├── Getting Started
│   └── Quickstart
├── Concepts
│   ├── Catalog
│   ├── Team Mode
│   ├── Overlays
│   ├── Drift Detection
│   ├── Sync Behavior
│   └── Git Workflows
├── Contributing
│   ├── Getting Started
│   ├── Testing Workflow
│   ├── Adding Exporters
│   └── Team Onboarding
└── Reference
    ├── CLI Reference
    ├── Import Workflow
    ├── Backup & Restore
    ├── Auto Updates
    ├── File Watcher Setup
    ├── Git Sources
    ├── Privacy
    ├── Pre-1.0 Policy
    ├── Troubleshooting
    ├── Overlay Troubleshooting
    └── YAML Libraries
```

## Maintenance

- **Keep in sync with main docs/**: These are copies for the docs site
- **Add frontmatter**: Each doc should have title and description
- **Cross-reference**: Link related docs together
- **Update navigation**: Keep `_meta.json` files current

## Status

✅ Directory structure created  
✅ 22 docs copied from main docs/  
⏸️ Nextra setup deferred (deploy when ready)  
⏸️ Frontmatter added to 3 docs (add to remaining 19 as needed)
