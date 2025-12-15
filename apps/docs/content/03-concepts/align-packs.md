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
- (CLI) Not yet supported for Align packs; use download + manual add for now.

## Not supported

- `.align.yaml` manifest authoring
- GitHub pack resolution in the CLI
- Pack install via `aligntrue add <pack-url>`
