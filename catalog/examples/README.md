# Catalog Example Rules

These example rules demonstrate proper AlignTrue pack format and serve as local test fixtures.

## Usage

Copy any example to your project:

```bash
cp catalog/examples/testing.yaml .aligntrue/rules.yaml
aligntrue sync
```

Or reference from config:

```yaml
sources:
  - type: local
    path: ../../catalog/examples/testing.yaml
```

## Examples

- `global.yaml` - Universal baseline rules
- `testing.yaml` - Testing best practices
- `typescript.yaml` - TypeScript strict mode and conventions
- `security.yaml` - Security and secrets scanning
- `nextjs_app_router.yaml` - Next.js App Router patterns
- `tdd.yaml` - Test-driven development workflow
- `debugging.yaml` - Debugging practices and tools
- `docs.yaml` - Documentation standards
- `rule-authoring.yaml` - Best practices for writing rules
- `vercel_deployments.yaml` - Vercel deployment configuration
- `web_quality.yaml` - Web performance and quality standards

## Format

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

## Testing

These examples are used in CLI tests and serve as golden fixtures for validation.

To validate an example:

```bash
aligntrue check --ci --config path/to/example.yaml
```
