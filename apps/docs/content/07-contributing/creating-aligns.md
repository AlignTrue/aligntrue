---
title: Creating Aligns
description: Author and publish high-quality Aligns that pass validation and provide value to the community.
---

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

### Naming conventions

Choose a clear, descriptive filename for your align that indicates its purpose:

- **Global/base aligns** - `global.md`, `typescript.md`, `testing.md`
  - Use when: Your rules work for any project type

- **Stack-specific aligns** - `nextjs-app-router.md`, `django-backend.md`
  - Use when: Your rules target a specific tech stack or framework

Examples are stored flat in `examples/aligns/` without namespace directories. Create descriptive filenames that make the purpose immediately clear.

### Format and location

Aligns are markdown files (`.md`) that use natural markdown sections. Prefer:

- `.aligntrue/rules/` for your own projects
- `examples/aligns/` when contributing examples to this repository

Frontmatter keeps IDs stable and helps downstream consumers:

```yaml
---
id: "aligns/base/typescript-config"
version: "1.0.0"
summary: "TypeScript configuration baseline"
tags: ["typescript", "configuration"]
---
```

Use `aligns/base/*` for global rules and `aligns/stacks/*` for stack-specific rules.

### Minimal example

Here's a minimal align using natural markdown sections:

````markdown
---
id: "aligns/base/typescript-config"
version: "1.0.0"
summary: "Ensure projects use a strict tsconfig"
tags: ["typescript", "configuration"]
---

# TypeScript configuration

## Require a tsconfig

All TypeScript projects must include `tsconfig.json`. Use `npx tsc --init` if missing.

### Recommended options

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

For more examples, browse existing aligns in the [`examples/aligns/`](https://github.com/AlignTrue/aligntrue/tree/main/examples/aligns) directory.

## Testing locally

### Prerequisites

You'll need:

- Node.js 20+ and pnpm 9+
- The `AlignTrue/aligntrue` repository cloned
- Your align saved as `.md` in `.aligntrue/rules/` (or in `examples/aligns/` if contributing here)

### Validate your align

From the `aligntrue` repository:

```bash
# Install dependencies
pnpm install

# Validate your rules
aligntrue check
```

### Verify deterministic hash

Run validation twice and confirm the hashes are identical both times:

```bash
aligntrue check
# Note the output

aligntrue check
# Output should match exactly
```

If outputs differ, your rules may have non-deterministic content (timestamps, random values, etc.).

## Using recommended conventions

When creating plugs for your align, prefer established conventions to maximize interoperability:

- See [Conventions Reference](/docs/02-customization/conventions) for recommended plug keys
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
    path: aligns/your-align.md
````

2. **Share raw URL** - Users can download directly:

```bash
curl -o .aligntrue/rules/your-align.md https://raw.githubusercontent.com/yourorg/rules-repo/main/aligns/your-align.md
aligntrue sync
```

### Via local files

Share the markdown file directly - users can copy it to their project:

```bash
cp your-align.md .aligntrue/rules/
aligntrue check && aligntrue sync
```

### Quality checklist

Before sharing your align, verify:

- [ ] File is `.md` using natural markdown sections
- [ ] Frontmatter includes `id`, `version`, and `summary` (plus `owner`/`source` in team mode)
- [ ] `aligntrue check` passes twice with identical hashes (no timestamps or random values)
- [ ] Guidance is specific, actionable, and copy-pasteable
- [ ] Plugs use recommended conventions or clearly documented custom keys
- [ ] Namespace uses `aligns/base` or `aligns/stacks` to match scope

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
  - [Schema validation](https://github.com/AlignTrue/aligntrue/tree/main/packages/schema) - IR validation and type definitions
  - [Canonicalization](https://github.com/AlignTrue/aligntrue/tree/main/packages/schema/src/canonicalize.ts) - Deterministic hashing

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

Add `deps` in frontmatter alongside your other metadata. Dependencies are resolved and merged in order—keep them minimal.

### Scoping rules

Use `scope.applies_to` to narrow where your align applies:

```yaml
scope:
  applies_to: ["backend"] # or ["frontend"], ["cli"], etc.
```

Add `scope` to frontmatter so users understand when to use your align.

### Testing your align

To test your align locally:

1. **Add to `.aligntrue/config.yaml`:**

```yaml
sources:
  - type: local
    path: ./.aligntrue/rules/your-align.md
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
