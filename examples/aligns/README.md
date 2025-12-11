# Example Aligns

These example Aligns demonstrate proper AlignTrue Align format and can be imported via GitHub URLs or copied locally.

## Usage

### Import via GitHub URL

Reference Aligns directly from this repository:

```yaml
# .aligntrue.yaml
sources:
  - type: git
    url: https://github.com/AlignTrue/aligntrue
    path: examples/aligns/testing.md
```

Or use raw GitHub URLs:

```bash
curl -o .aligntrue/rules.md https://raw.githubusercontent.com/AlignTrue/aligntrue/main/examples/aligns/global.md
```

### Copy locally

```bash
cp examples/aligns/testing.md .aligntrue/rules.md
aligntrue sync
```

### Reference from config

```yaml
sources:
  - type: local
    path: examples/aligns/testing.md
```

## Available Aligns

### Base Aligns (universal)

- `global.md` - Universal baseline rules for all projects
- `docs.md` - Documentation standards and README requirements
- `typescript.md` - TypeScript strict mode and conventions
- `testing.md` - Testing best practices and determinism
- `tdd.md` - Test-driven development workflow
- `debugging.md` - Systematic debugging practices
- `security.md` - Security, secrets scanning, and supply chain

### Stack-Specific Aligns

- `nextjs_app_router.md` - Next.js App Router patterns and best practices
- `vercel_deployments.md` - Vercel deployment configuration and environment management
- `web_quality.md` - Web performance, Core Web Vitals, and accessibility standards

## Align format

All examples use markdown with YAML frontmatter:

```markdown
---
id: "aligns/namespace/align-name"
version: "1.0.0"
summary: "Brief description"
tags: ["tag1", "tag2"]
---

# Align title

Markdown content with guidance for AI assistants.
```

Each Align file contains its own metadata in YAML frontmatter with sections organized as markdown headings.

## Sharing your own Aligns

There is no central catalog registry. Share your Aligns by:

1. **Publishing to GitHub** - Users can import via git URLs
2. **Sharing files directly** - Users can copy YAML files locally
3. **Creating a collection** - Organize multiple aligns in a repository

Each Align file contains its own metadata in YAML frontmatter. See the [Creating Aligns](/docs/07-contributing/creating-aligns) guide for namespace conventions.

## Testing

These examples are used in CLI tests and serve as golden fixtures for validation.

To validate an example:

```bash
aligntrue check --ci --config path/to/example.yaml
```
