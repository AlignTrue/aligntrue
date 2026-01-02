---
description: Core concepts behind AlignTrue - understand how rules, sync, and team collaboration work
---

# Concepts

AlignTrue's core concepts explained. Start with the glossary to understand terminology, then explore how sync works, backup strategies, and team collaboration features.

> New here? Read the Glossary, then How sync works before diving into the other concepts.

## Quick overview

Use this section to skim and jump directly to what you need.

- **[Glossary](/docs/03-concepts/glossary)** - Defines core terms like scopes, exporters, bundles, and locks—start here.
- **[How sync works](/docs/03-concepts/sync-behavior)** - Walks through the source-of-truth flow from rules to agent exports so you know what runs.
- **[Backup](/docs/03-concepts/backup)** - Shows what to back up (rules, lockfiles) and where to store them for safety.
- **[Preventing duplicate rules](/docs/03-concepts/preventing-duplicate-rules)** - Avoids repeating instructions across multiple exporters to keep agent context lean.
- **[Team mode](/docs/03-concepts/team-mode)** (team) - Explains collaborative flows, lockfiles, and approval patterns before turning team mode on.
- **[Drift detection](/docs/03-concepts/drift-detection)** (team; after team mode) - Detects when local rules diverge from approved versions and how to respond.
- **[Git workflows](/docs/03-concepts/git-workflows)** (team; after team mode) - Covers git sources, vendoring, and sharing strategies once collaboration is enabled.

## Learning path

### Solo developers start here:

1. Read [Glossary](/docs/03-concepts/glossary) - learn key terms.
2. Review [How sync works](/docs/03-concepts/sync-behavior) - understand the core flow.
3. Learn about [Backup](/docs/03-concepts/backup) - protect your work.
4. Explore [Preventing duplicate rules](/docs/03-concepts/preventing-duplicate-rules) - optimize agent context.

### Teams add these after enabling team mode:

5. Understand [Team mode](/docs/03-concepts/team-mode) - enable collaboration.
6. Monitor with [Drift detection](/docs/03-concepts/drift-detection) - track alignment and remediate.
7. Share with [Git workflows](/docs/03-concepts/git-workflows) - manage rule sources and vendoring.

## See also

- **[Getting started](/docs/00-getting-started/00-quickstart)** - Quickstart and setup
- **[Guides](/docs/01-guides)** - How-to guides for solo and team workflows
- **[Customization](/docs/02-customization)** - Scopes, overlays, and plugs
- **[Reference](/docs/04-reference/cli-reference)** - CLI commands, configuration, and agent support
