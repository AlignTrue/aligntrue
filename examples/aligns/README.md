# Example aligns

These example aligns demonstrate proper AlignTrue align format and can be imported via GitHub URLs or copied locally.

## Usage

### Import via GitHub URL

Reference aligns directly from this repository:

```yaml
# .aligntrue.yaml
sources:
  - type: git
    url: https://github.com/AlignTrue/aligntrue
    path: examples/aligns/testing.yaml
```

Or use raw GitHub URLs:

```bash
curl -o .aligntrue/rules.yaml https://raw.githubusercontent.com/AlignTrue/aligntrue/main/examples/aligns/global.yaml
```

### Copy locally

```bash
cp examples/aligns/testing.yaml .aligntrue/rules.yaml
aligntrue sync
```

### Reference from config

```yaml
sources:
  - type: local
    path: examples/aligns/testing.yaml
```

## Available Aligns

### Base Aligns (Universal)

- `global.yaml` - Universal baseline rules for all projects
- `docs.yaml` - Documentation standards and README requirements
- `typescript.yaml` - TypeScript strict mode and conventions
- `testing.yaml` - Testing best practices and determinism
- `tdd.yaml` - Test-driven development workflow
- `debugging.yaml` - Systematic debugging practices
- `security.yaml` - Security, secrets scanning, and supply chain
- `rule-authoring.yaml` - Best practices for writing AlignTrue rules

### Stack-Specific Aligns

- `nextjs_app_router.yaml` - Next.js App Router patterns and best practices
- `vercel_deployments.yaml` - Vercel deployment configuration and environment management
- `web_quality.yaml` - Web performance, Core Web Vitals, and accessibility standards

## Align Format

All examples use YAML format with the following structure:

```yaml
id: "aligns/namespace/align-name"
version: "1.0.0"
profile: "align"
spec_version: "1"
summary: "Brief description"
tags: ["tag1", "tag2"]
rules:
  - id: "category.subcategory.rule-name"
    severity: "error"
    applies_to:
      - "**/*.ts"
    guidance: |
      Clear guidance for AI assistants
```

## Sharing Your Own Aligns

There is no central catalog registry. Share your aligns by:

1. **Publishing to GitHub** - Users can import via git URLs
2. **Sharing files directly** - Users can copy YAML files locally
3. **Creating a collection** - Organize multiple aligns in a repository

Each align file contains its own metadata in YAML frontmatter. See the [Creating Aligns](/docs/06-contributing/creating-aligns) guide for namespace conventions.

## Testing

These examples are used in CLI tests and serve as golden fixtures for validation.

To validate an example:

```bash
aligntrue check --ci --config path/to/example.yaml
```
