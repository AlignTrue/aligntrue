---
description: Catalog-only packs that bundle multiple rules for sharing.
---

# Align packs (catalog-only)

Align packs are now catalog-native only. There is no `.align.yaml` authoring or CLI pack install path. Create packs in the catalog UI and share the catalog link.

## When to use a pack

- You want to share multiple rules with a single URL.
- You want recipients to preview or download a zip in the browser.

## How to create a pack

1. Go to the catalog bulk import page.
2. Paste one or more rule URLs and import them.
3. Click **Create pack**, fill in title/description/author, and save.
4. Share the catalog link (e.g., `https://aligntrue.ai/a/<id>`).

What is stored:

- Title, description, author
- Member rule IDs (`containsAlignIds`)
- Display metadata for the pack page

## What recipients can do

- Open the catalog link to preview rules in all agent formats.
- Download a zip that preserves relative paths.
- (CLI) Install via `aligntrue add <pack-id>` or `aligntrue add https://aligntrue.ai/a/<pack-id>`.

## Not supported

- `.align.yaml` manifest authoring
- GitHub pack resolution in the CLI
- Pack install via `aligntrue add <pack-url>`

## Mixed format packs

Some packs in the catalog contain rules authored in multiple agent formats (for example, Cursor `.mdc` files alongside `CLAUDE.md`). This typically happens when authors use custom configurations or symlinked setups.

### How AlignTrue handles this

When you install a mixed format pack:

1. All rules are converted to AlignTrue source format (`.aligntrue/rules/*.md`)
2. You select which agent(s) to export to during setup
3. AlignTrue generates the appropriate format for each agent

### What to do after install

1. Review the imported rules in `.aligntrue/rules/`
2. Run `aligntrue exporters` to configure your target agents
3. Run `aligntrue sync` to generate agent-specific files

This approach keeps a single source of truth instead of multiple format-specific files.
