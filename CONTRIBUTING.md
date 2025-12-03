<!--
  ⚠️  AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY

  This file is generated from documentation source.
  To make changes, edit the source file and run: pnpm generate:repo-files

  Source: apps/docs/content/07-contributing/creating-aligns.md
-->

# Creating Aligns

Thank you for your interest in contributing to AlignTrue! This guide will help you create high-quality Aligns that pass validation and provide value to the community.

## Quick start

Get started creating aligns:

1. **Review examples** in the [`examples/aligns/`](https://github.com/AlignTrue/aligntrue/tree/main/examples/aligns) directory
2. **Create** your align following the [template](#minimal-example)
3. **Share** via GitHub URL, local file, or your own repository

No central registry exists - share aligns however works best for your team.

## Authoring your first align

### Review examples

Browse example aligns in [`examples/aligns/`](https://github.com/AlignTrue/aligntrue/tree/main/examples/aligns) in this repository.

Examples include:

- Base aligns (global, testing, security, etc.)
- Stack-specific aligns (Next.js, Vercel, etc.)
- Inline comments explaining best practices
- Proper align structure and formatting

### Choose your namespace

Pick the appropriate namespace for your align:

- **`aligns/base/*`** - Rules that apply across all stacks
  - Example: `aligns/base/base-testing`, `aligns/base/base-security`
  - Use when: Your rules work for any project type

- **`aligns/stacks/*`** - Rules specific to a framework or stack
  - Example: `aligns/stacks/nextjs-app-router`, `aligns/stacks/django-backend`
  - Use when: Your rules target a specific tech stack

### Minimal example

Here's a minimal align using natural markdown sections:

````markdown
# TypeScript Configuration Align

## Ensure TypeScript configuration

All TypeScript projects should have a properly configured `tsconfig.json` file.

### Setup

Run `npx tsc --init` to create a tsconfig.json if missing.

### Recommended configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```
````

Enable strict mode for better type safety and fewer runtime errors.

````

For more examples, browse existing aligns in the [`examples/aligns/`](https://github.com/AlignTrue/aligntrue/tree/main/examples/aligns) directory.

## Testing locally

### Prerequisites

You'll need:

- Node.js 20+ and pnpm 9+
- The `AlignTrue/aligntrue` repository cloned

### Validate your align

From the `aligntrue` repository:

```bash
# Install dependencies
pnpm install

# Validate your align
pnpm --filter @aligntrue/schema validate path/to/your-align.yaml
````

### Verify deterministic hash

Run validation twice and confirm the integrity hash is identical both times:

```bash
pnpm --filter @aligntrue/schema validate path/to/your-align.yaml
# Note the integrity hash in output

pnpm --filter @aligntrue/schema validate path/to/your-align.yaml
# Hash should match exactly
```

If hashes differ, your align may have non-deterministic content (timestamps, random values, etc.).

### Compute integrity hash

If your align has `<computed>` as the integrity value, compute the real hash:

```bash
# From the aligntrue repository
pnpm --filter @aligntrue/schema compute-hash path/to/your-align.yaml
```

Copy the hash from the output and paste it into your align's `integrity.value` field.

## Using recommended conventions

When creating plugs for your align, prefer established conventions to maximize interoperability:

- See [Conventions Reference](https://aligntrue.ai/docs/02-customization/conventions) for recommended plug keys
- Using standard keys like `test.cmd`, `docs.url`, `org.name` improves user experience
- Users can reuse fills across multiple templates from different authors
- If your use case has no standard equivalent, document custom plugs clearly in your README

**Example:** Instead of creating a custom `run_tests` key, use the standard `test.cmd` key:

```yaml
plugs:
  slots:
    test.cmd:
      description: "Command to run tests"
      format: command
      required: true
      example: "pnpm test"
```

This allows users to set the fill once and reuse it across any align that follows conventions.

## Writing effective guidance

Aligns use natural markdown to provide clear, actionable guidance. Focus on helping developers understand what to do and why.

An Align's guidance is what AI agents and developers will read to understand the rule.

### Clear and specific

Write guidance that answers:

- **What** should be done
- **Why** it matters
- **How** to do it (with examples)

**Good example:**

````markdown
## Use TypeScript strict mode

Enable strict mode in all TypeScript projects for better type safety.

### Why

Strict mode catches more errors at compile time and prevents common runtime issues.

### How

Add to `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```
````

Run `npx tsc --init` to create a new config if needed.

````

### Actionable instructions

Make it easy for developers to follow your guidance:

- **Bad**: "Fix your tests"
- **Good**: "Run `pnpm test` before committing to catch errors early"

- **Bad**: "Use better logging"
- **Good**: "Replace `console.log()` with `logger.info()` for structured logging"

Include specific commands, file names, and code examples.

Users should be able to copy-paste your hint and make progress.

### Choose the right severity

- **MUST**: Blocking issues that break builds or cause errors
  - Uninstalled imports
  - Missing required configuration
  - Security vulnerabilities

- **SHOULD**: Warnings about problems that don't block
  - Missing tests
  - Incomplete documentation
  - Deprecated patterns

- **MAY**: Suggestions and style preferences
  - console.log statements
  - TODO comments
  - Formatting preferences

## Sharing your align

### Via GitHub

1. **Publish to GitHub** - Users can import via git URLs:

```yaml
sources:
  - type: git
    url: https://github.com/yourorg/rules-repo
    path: aligns/your-align.yaml
````

2. **Share raw URL** - Users can download directly:

```bash
curl -o .aligntrue/rules.yaml https://raw.githubusercontent.com/yourorg/rules-repo/main/aligns/your-align.yaml
```

### Via local files

Share the YAML file directly - users can copy it to their project:

```bash
cp your-align.yaml .aligntrue/rules.yaml
aligntrue sync
```

### Quality checklist

Before sharing your align, verify:

- [ ] Schema validation passes locally
- [ ] Integrity hash is computed (not `<computed>`)
- [ ] Evidence messages are specific and actionable
- [ ] Autofix hints are concrete commands or steps
- [ ] Align summary clearly states purpose in one sentence
- [ ] Namespace follows conventions (aligns/base or aligns/stacks)
- [ ] All check types use one of the 5 supported types

## Code of conduct

We aim to build a welcoming, constructive community:

- **Be respectful**: Treat all contributors with respect and consideration
- **Be constructive**: Focus on improving the quality of rules, not criticizing authors
- **Be objective**: Ground discussions in concrete examples and data
- **Be clear**: Explain your reasoning when proposing or reviewing changes

We have zero tolerance for harassment, discrimination, or hostile behavior.

## Getting help

Stuck? Here's how to get help:

- **Documentation**: Read the full docs at [aligntrue.ai/docs](/docs)
  - [Align Spec v1](https://github.com/AlignTrue/aligntrue/blob/main/spec/align-spec-v1.md) - Complete specification
  - [Schema validation](https://github.com/AlignTrue/aligntrue/tree/main/packages/schema) - IR validation and checks
  - [Canonicalization](https://github.com/AlignTrue/aligntrue/tree/main/packages/schema#canonicalization) - How hashing works

- **Examples**: Browse example aligns in [`examples/aligns/`](https://github.com/AlignTrue/aligntrue/tree/main/examples/aligns)
  - [testing.md](https://github.com/AlignTrue/aligntrue/blob/main/examples/aligns/testing.md) - Testing rules
  - [security.md](https://github.com/AlignTrue/aligntrue/blob/main/examples/aligns/security.md) - Security rules
  - [nextjs_app_router.md](https://github.com/AlignTrue/aligntrue/blob/main/examples/aligns/nextjs_app_router.md) - Stack-specific rules

- **Discussions**: Ask questions in [GitHub Discussions](https://github.com/AlignTrue/aligntrue/discussions)

- **Issues**: Report bugs or problems in [GitHub Issues](https://github.com/AlignTrue/aligntrue/issues)

## Sharing with the community

Consider sharing your align with the community:

1. **GitHub repository** - Create a public repo with your aligns
2. **Documentation** - Add a README explaining what your aligns do
3. **Examples** - Include usage examples and configuration
4. **Community** - Share in [GitHub Discussions](https://github.com/AlignTrue/aligntrue/discussions)

Well-documented aligns help others learn and adopt best practices.

## Advanced topics

### Dependencies between aligns

Aligns can depend on other aligns using the `deps` field:

```yaml
deps:
  - id: "aligns/base/base-global"
    version: "^1.0.0"
```

Dependencies are resolved and merged in order. Keep dependencies minimal.

### Scoping rules

Use `scope.applies_to` to narrow where your align applies:

```yaml
scope:
  applies_to: ["backend"] # or ["frontend"], ["cli"], etc.
```

This helps users understand when to use your align.

### Testing your align

To test your align locally:

1. **Add to `.aligntrue/config.yaml`:**

```yaml
sources:
  - type: local
    path: ./your-align.md
```

2. **Sync to agents:**

```bash
aligntrue sync
```

3. **Verify the output** in your agent files to ensure guidance displays correctly.

## Questions?

If this guide doesn't answer your question:

- Check the [documentation](/docs)
- Search [existing discussions](https://github.com/AlignTrue/aligntrue/discussions)
- Open a [new discussion](https://github.com/AlignTrue/aligntrue/discussions/new)

We're here to help!

---

**Thank you** for contributing to AlignTrue and helping make AI-human alignment better for everyone.

---

_This file is auto-generated from the AlignTrue documentation site. To make changes, edit the source files in `apps/docs/content/` and run `pnpm generate:repo-files`._
