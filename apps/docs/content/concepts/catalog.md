# Catalog and discovery

AlignTrue maintains a central catalog of rule packs that you can browse, search, and install into your projects. The catalog website at [aligntrue.ai](https://aligntrue.ai) provides an interactive interface to discover packs, while the CLI enables one-command installation.

**Note**: You can use any rules with AlignTrue, the ones in the catalog are just ones we've found and collected.

## Overview

The catalog contains vetted, community-maintained packs covering common scenarios:

- **Base Global** - Essential baseline rules for all projects
- **TypeScript** - Type safety and strict mode practices
- **Testing** - Unit and integration testing standards
- **Security** - Security controls and compliance guidelines
- **Web Quality** - Next.js, Tailwind, and web performance practices
- And more, organized by category

Each pack includes metadata about compatibility, customization options, trust scores, and installation instructions.

## Browsing the catalog website

Visit [aligntrue.ai/catalog](https://aligntrue.ai/catalog) to explore available packs.

### Viewing packs

Each pack card displays:

- **Pack name** - Friendly title (e.g., "Base Global")
- **Description** - One-sentence summary of what the pack covers
- **Summary bullets** - Key features and highlights
- **Badges** - Visual indicators for compatibility, customization needs, and updates
- **Meta info** - License, last updated date, maintainer, popularity

Click any pack name to view its detail page.

### Detail pages

Pack detail pages include:

- **Full description** - Complete overview of rules and scope
- **Compatibility** - Which coding agents support this pack (Cursor, Claude Code, GitHub Copilot, etc.)
- **Rule preview** - Inline editor showing what rules will be installed
- **Customization** - Required fields (plugs) and how to configure them
- **Exporters** - Preview of output format for your agent (Cursor `.mdc`, AGENTS.md, etc.)
- **Related packs** - Suggestions for complementary packs
- **Install commands** - Copy-paste commands to add this pack

## Searching and filtering

Use the catalog search bar to find packs by keyword, category, or tool.

### Search

Type in the search box to find packs by:

- **Name** - Exact pack names (e.g., "TypeScript")
- **Description** - Keyword matches (e.g., "testing", "performance")
- **Tags** - Searchable tags (e.g., "determinism", "security")

Search is client-side and instant with no latency.

### Filters

Refine results using filters:

- **Tool** - Narrow by agent (Cursor, Claude Code, GitHub Copilot, VS Code, etc.)
- **Category** - Filter by topic (code-quality, security, performance, etc.)
- **License** - Show only CC0, MIT, or other licenses
- **Last updated** - Find packs updated recently
- **Has plugs** - Show only customizable packs or base packs
- **Overlay friendly** - Show packs compatible with overlays

### Sorting

Sort results by:

- **Most copied (7d)** - Popular packs in the past week
- **Trending** - Packs gaining adoption
- **Recently updated** - Latest releases
- **Name (A-Z)** - Alphabetical order

## Installing packs

### From the catalog website

1. Open [aligntrue.ai/catalog](https://aligntrue.ai/catalog)
2. Search or browse to find a pack
3. Click the pack name to view details
4. Click the **Install** button
5. Copy the commands shown in the modal
6. Paste into your terminal and run

Example install modal shows:

```bash
# Install AlignTrue CLI (skip if you already have it)
curl -fsSL https://aligntrue.ai/install.sh | bash

# Add pack
aligntrue add catalog:packs/base/base-global@1.0.0 --from=catalog_web

# Configure plugs (if needed)
aln plugs set AUTHOR_NAME "Your Name"
```

### From the CLI

If you prefer the command line, install directly without visiting the website:

```bash
# Install pack from catalog
aligntrue add catalog:packs/base/base-global@1.0.0

# For team mode, use team add command
aligntrue team add base-global@aligntrue/catalog@v1.0.0
```

### Configuration

When you install a pack, AlignTrue:

1. **Downloads** the pack from the catalog
2. **Validates** the pack schema and integrity
3. **Adds** it to your `.aligntrue.yaml` config under `sources`
4. **Prompts** for any required customization (plugs)
5. **Syncs** rules to your agents (.cursor, AGENTS.md, etc.)

Your config now includes:

```yaml
sources:
  - type: catalog
    id: packs/base/base-global
    version: 1.0.0
```

## Customizing installed packs

Some packs include customizable fields called **plugs**.

### Viewing plugs

On the pack detail page, the **Customization** section shows:

- **Plug key** - Variable name (e.g., `AUTHOR_NAME`)
- **Description** - What this field controls
- **Type** - String, boolean, enum, etc.
- **Default** - Suggested or empty if required

### Setting plugs

After installing, configure plugs with:

```bash
# Set a plug value
aln plugs set AUTHOR_NAME "Jane Doe"

# Set multiple
aln plugs set PROJECT_NAME "myapp" SLACK_CHANNEL "#dev"

# View current values
aln plugs list
```

Plugs are stored in your `.aligntrue.yaml` under the pack's `customization` section.

## Overlays and pack combinations

Install multiple packs together and combine rules using overlays.

### Common combinations

- **Base Global** + **TypeScript** - Full baseline with strict types
- **Base Global** + **Testing** + **TypeScript** - Full quality stack
- **Security** + **Web Quality** - Web app compliance

### Using overlays

After installing multiple packs, use overlays to:

- Enable/disable specific rules per project or branch
- Remap rule severity (warning → error in CI, etc.)
- Combine conflicting rules from different packs

See the [overlays guide](/concepts/overlays) for details.

## Trust and maintenance

### Pack quality signals

Each pack includes:

- **Trust score** - 0–100 based on maintenance, updates, and adoption
- **Maintainer** - GitHub user or organization responsible
- **Last updated** - When the pack was last changed
- **Copies (7d)** - How many times it was installed in the past week
- **License** - Reuse and modification rights (CC0, MIT, etc.)

### Vetted packs

Packs in the main catalog are reviewed by AlignTrue maintainers for:

- Schema validity
- Clear documentation
- No malicious content
- Basic quality standards

Community-maintained packs may have lower trust scores and are marked accordingly.

## Sharing packs

### Share a pack

On any pack detail page, click **Share** to get a copy-paste URL:

```
https://aligntrue.ai/catalog/base-global?utm_source=share
```

Send this link to teammates or community members.

### Check team rules

For team-specific rules, see the [git workflows](/concepts/git-workflows) guide on sharing rules via git repositories.

## Privacy and analytics

Installing packs from the catalog is transparent:

- **Install tracking** - Packs are installed with `--from=catalog_web` flag so we can measure adoption
- **No required login** - Catalog browsing and installation don't require authentication
- **Optional telemetry** - Set `ALIGNTRUE_TELEMETRY=on` to share broader usage data (off by default)

See the [privacy controls](/reference/privacy) reference for details.

## Troubleshooting

### Pack won't install

Check the error message. Common issues:

- **CLI not installed** - Run `curl -fsSL https://aligntrue.ai/install.sh | bash`
- **Network error** - Ensure internet connection. Use `--offline` to use cache
- **Integrity check failed** - Pack may be corrupted. Try again or report to maintainers

### Plug configuration

If plugs don't take effect:

- Run `aln plugs list` to verify values are set
- Run `aligntrue sync` to re-export to agents
- Check your agent's config file (.cursor, AGENTS.md, etc.) for the rule

### Pack conflicts

If two packs define the same rule differently, use overlays to remap severity or disable one pack.

See [overlays troubleshooting](/reference/troubleshooting-overlays).

## Next steps

- **Combine packs** - Add multiple packs and use overlays to balance them
- **Create a pack** - Share your rules with the community (see [contributing](/contributing/getting-started))
- **Team mode** - Use packs in team settings with versioning and approval workflows (see [team mode](/concepts/team-mode))
