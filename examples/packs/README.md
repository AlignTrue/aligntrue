# Example packs

These example packs demonstrate proper AlignTrue pack format and can be imported via GitHub URLs or copied locally.

## Usage

### Import via GitHub URL

Reference packs directly from this repository:

```yaml
# .aligntrue.yaml
sources:
  - type: git
    url: https://github.com/AlignTrue/aligntrue
    path: examples/packs/testing.yaml
```

Or use raw GitHub URLs:

```bash
curl -o .aligntrue/rules.yaml https://raw.githubusercontent.com/AlignTrue/aligntrue/main/examples/packs/global.yaml
```

### Copy locally

```bash
cp examples/packs/testing.yaml .aligntrue/rules.yaml
aligntrue sync
```

### Reference from config

```yaml
sources:
  - type: local
    path: examples/packs/testing.yaml
```

## Available Packs

### Base Packs (Universal)

- `global.yaml` - Universal baseline rules for all projects
- `docs.yaml` - Documentation standards and README requirements
- `typescript.yaml` - TypeScript strict mode and conventions
- `testing.yaml` - Testing best practices and determinism
- `tdd.yaml` - Test-driven development workflow
- `debugging.yaml` - Systematic debugging practices
- `security.yaml` - Security, secrets scanning, and supply chain
- `rule-authoring.yaml` - Best practices for writing AlignTrue rules

### Stack-Specific Packs

- `nextjs_app_router.yaml` - Next.js App Router patterns and best practices
- `vercel_deployments.yaml` - Vercel deployment configuration and environment management
- `web_quality.yaml` - Web performance, Core Web Vitals, and accessibility standards

## Pack Format

All examples use YAML format with the following structure:

```yaml
id: "packs/namespace/pack-name"
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

## Sharing Your Own Packs

There is no central catalog registry. Share your packs by:

1. **Publishing to GitHub** - Users can import via git URLs
2. **Sharing files directly** - Users can copy YAML files locally
3. **Creating a collection** - Organize multiple packs in a repository

See `examples/packs.yaml` and `examples/namespaces.yaml` for namespace conventions.

## Testing

These examples are used in CLI tests and serve as golden fixtures for validation.

To validate an example:

```bash
aligntrue check --ci --config path/to/example.yaml
```
