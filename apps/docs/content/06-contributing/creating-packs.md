---
title: Creating packs
description: Author and publish high-quality Align packs that pass validation and provide value to the community.
---

# Creating packs

Thank you for your interest in contributing to AlignTrue! This guide will help you create high-quality Align packs that pass validation and provide value to the community.

## Quick start

Get started creating packs:

1. **Review examples** in the [`examples/packs/`](https://github.com/AlignTrue/aligntrue/tree/main/examples/packs) directory
2. **Create** your pack following the [template](#minimal-example)
3. **Share** via GitHub URL, local file, or your own repository

No central registry exists - share packs however works best for your team.

## Authoring your first pack

### Review examples

Browse example packs in [`examples/packs/`](https://github.com/AlignTrue/aligntrue/tree/main/examples/packs) in this repository.

Examples include:

- Base packs (global, testing, security, etc.)
- Stack-specific packs (Next.js, Vercel, etc.)
- Inline comments explaining best practices
- Proper pack structure and formatting

### Choose your namespace

Pick the appropriate namespace for your pack:

- **`packs/base/*`** - Rules that apply across all stacks
  - Example: `packs/base/base-testing`, `packs/base/base-security`
  - Use when: Your rules work for any project type

- **`packs/stacks/*`** - Rules specific to a framework or stack
  - Example: `packs/stacks/nextjs-app-router`, `packs/stacks/django-backend`
  - Use when: Your rules target a specific tech stack

### Minimal example

Here's a minimal pack using natural markdown sections:

````markdown
# TypeScript Configuration Pack

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

For more examples, browse existing packs in the [`examples/packs/`](https://github.com/AlignTrue/aligntrue/tree/main/examples/packs) directory.

## Testing locally

### Prerequisites

You'll need:

- Node.js 22+ and pnpm 9+
- The `AlignTrue/aligntrue` repository cloned

### Validate your pack

From the `aligntrue` repository:

```bash
# Install dependencies
pnpm install

# Validate your pack
pnpm --filter @aligntrue/schema validate path/to/your-pack.yaml
````

### Verify deterministic hash

Run validation twice and confirm the integrity hash is identical both times:

```bash
pnpm --filter @aligntrue/schema validate path/to/your-pack.yaml
# Note the integrity hash in output

pnpm --filter @aligntrue/schema validate path/to/your-pack.yaml
# Hash should match exactly
```

If hashes differ, your pack may have non-deterministic content (timestamps, random values, etc.).

### Compute integrity hash

If your pack has `<computed>` as the integrity value, compute the real hash:

```bash
# From the aligntrue repository
pnpm --filter @aligntrue/schema compute-hash path/to/your-pack.yaml
```

Copy the hash from the output and paste it into your pack's `integrity.value` field.

## Writing effective guidance

Packs use natural markdown to provide clear, actionable guidance. Focus on helping developers understand what to do and why.

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

## Sharing your pack

### Via GitHub

1. **Publish to GitHub** - Users can import via git URLs:

```yaml
sources:
  - type: git
    url: https://github.com/yourorg/rules-repo
    path: packs/your-pack.yaml
````

2. **Share raw URL** - Users can download directly:

```bash
curl -o .aligntrue/rules.yaml https://raw.githubusercontent.com/yourorg/rules-repo/main/packs/your-pack.yaml
```

### Via local files

Share the YAML file directly - users can copy it to their project:

```bash
cp your-pack.yaml .aligntrue/rules.yaml
aligntrue sync
```

### Quality checklist

Before sharing your pack, verify:

- [ ] Schema validation passes locally
- [ ] Integrity hash is computed (not `<computed>`)
- [ ] Evidence messages are specific and actionable
- [ ] Autofix hints are concrete commands or steps
- [ ] Pack summary clearly states purpose in one sentence
- [ ] Namespace follows conventions (packs/base or packs/stacks)
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

- **Examples**: Browse example packs in [`examples/packs/`](https://github.com/AlignTrue/aligntrue/tree/main/examples/packs)
  - [testing.yaml](https://github.com/AlignTrue/aligntrue/blob/main/examples/packs/testing.yaml) - Testing rules
  - [security.yaml](https://github.com/AlignTrue/aligntrue/blob/main/examples/packs/security.yaml) - Security rules
  - [nextjs_app_router.yaml](https://github.com/AlignTrue/aligntrue/blob/main/examples/packs/nextjs_app_router.yaml) - Stack-specific rules

- **Discussions**: Ask questions in [GitHub Discussions](https://github.com/AlignTrue/aligntrue/discussions)

- **Issues**: Report bugs or problems in [GitHub Issues](https://github.com/AlignTrue/aligntrue/issues)

## Sharing with the community

Consider sharing your pack with the community:

1. **GitHub repository** - Create a public repo with your packs
2. **Documentation** - Add a README explaining what your packs do
3. **Examples** - Include usage examples and configuration
4. **Community** - Share in [GitHub Discussions](https://github.com/AlignTrue/aligntrue/discussions)

Well-documented packs help others learn and adopt best practices.

## Advanced topics

### Dependencies between packs

Packs can depend on other packs using the `deps` field:

```yaml
deps:
  - id: "packs/base/base-global"
    version: "^1.0.0"
```

Dependencies are resolved and merged in order. Keep dependencies minimal.

### Scoping rules

Use `scope.applies_to` to narrow where your pack applies:

```yaml
scope:
  applies_to: ["backend"] # or ["frontend"], ["cli"], etc.
```

This helps users understand when to use your pack.

### Testing your pack

To test your pack locally:

1. **Add to `.aligntrue/config.yaml`:**

```yaml
sources:
  - type: local
    path: ./your-pack.md
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
