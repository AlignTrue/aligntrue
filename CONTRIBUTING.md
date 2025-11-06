<!-- AUTO-GENERATED from apps/docs/content - DO NOT EDIT DIRECTLY -->
<!-- Edit the source files in apps/docs/content and run 'pnpm generate:repo-files' -->

# Contributing to AlignTrue

Thank you for your interest in contributing to AlignTrue! This guide will help you create high-quality Align packs that pass validation and provide value to the community.

## Quick start

Get started contributing in three steps:

1. **Fork** the [`AlignTrue/aligns`](https://github.com/AlignTrue/aligns) repository
2. **Create** your pack following the [template](#template-pack)
3. **Submit** a PR with passing CI

That's it! Our CI will validate your pack automatically.

## Authoring your first Align

### Use the template

Start with the template pack at [`packs/templates/starter.aligntrue.yaml`](https://github.com/AlignTrue/aligns/blob/main/packs/templates/starter.aligntrue.yaml) in the `aligns` repository.

The template includes:

- All 5 check types with examples
- Inline comments explaining best practices
- Properly computed integrity hash

### Choose your namespace

Pick the appropriate namespace for your pack:

- **`packs/base/*`** - Rules that apply across all stacks
  - Example: `packs/base/base-testing`, `packs/base/base-security`
  - Use when: Your rules work for any project type

- **`packs/stacks/*`** - Rules specific to a framework or stack
  - Example: `packs/stacks/nextjs-app-router`, `packs/stacks/django-backend`
  - Use when: Your rules target a specific tech stack

See [POLICY.md](POLICY.md) for complete namespacing rules.

### Minimal example

Here's a minimal Align pack with one rule:

```yaml
id: "packs/base/base-example"
version: "1.0.0"
profile: "align"
spec_version: "1"
summary: "Ensure all TypeScript projects have proper configuration"
tags: ["typescript", "configuration"]
deps: []

scope:
  applies_to: ["backend", "frontend"]

rules:
  - id: require-tsconfig
    severity: MUST
    check:
      type: file_presence
      inputs:
        pattern: "tsconfig.json"
        must_exist: true
      evidence: "TypeScript project missing tsconfig.json"
    autofix:
      hint: "Run `npx tsc --init` to create tsconfig.json"

integrity:
  algo: "jcs-sha256"
  value: "<computed>"
```

For more examples, browse existing packs in the [`AlignTrue/aligns`](https://github.com/AlignTrue/aligns) repository.

## Testing locally

### Prerequisites

You'll need:

- Node.js 20+ and pnpm 9+
- Both repositories cloned:
  - `AlignTrue/aligntrue` (this repo with validation tools)
  - `AlignTrue/aligns` (the registry repo for your pack)

### Validate your pack

From the `aligntrue` repository:

```bash
# Install dependencies
pnpm install

# Validate your pack
pnpm --filter @aligntrue/schema validate ../aligns/packs/base/your-pack.aligntrue.yaml
```

### Verify deterministic hash

Run validation twice and confirm the integrity hash is identical both times:

```bash
pnpm --filter @aligntrue/schema validate ../aligns/packs/base/your-pack.aligntrue.yaml
# Note the integrity hash in output

pnpm --filter @aligntrue/schema validate ../aligns/packs/base/your-pack.aligntrue.yaml
# Hash should match exactly
```

If hashes differ, your pack may have non-deterministic content (timestamps, random values, etc.).

### Compute integrity hash

If your pack has `<computed>` as the integrity value, compute the real hash:

```bash
# From the aligntrue repository
pnpm --filter @aligntrue/schema compute-hash ../aligns/packs/base/your-pack.aligntrue.yaml
```

Copy the hash from the output and paste it into your pack's `integrity.value` field.

## Machine-checkable rules

All rules in AlignTrue must be machine-checkable. No vibes, no subjective judgments.

### The 5 check types

Every rule must use one of these check types:

1. **`file_presence`** - Check if files exist or don't exist

   ```yaml
   check:
     type: file_presence
     inputs:
       pattern: "README.md"
       must_exist: true
   ```

2. **`path_convention`** - Validate file paths match patterns

   ```yaml
   check:
     type: path_convention
     inputs:
       pattern: "src/**/*.test.{ts,tsx}"
       convention: "kebab-case"
   ```

3. **`manifest_policy`** - Check package.json or lockfile constraints

   ```yaml
   check:
     type: manifest_policy
     inputs:
       manifest: "package.json"
       lockfile: "pnpm-lock.yaml"
       require_pinned: true
   ```

4. **`regex`** - Pattern matching in file contents

   ```yaml
   check:
     type: regex
     inputs:
       include: ["**/*.ts"]
       pattern: "\\bconsole\\.log\\("
       allow: false
   ```

5. **`command_runner`** - Execute commands and check exit codes
   ```yaml
   check:
     type: command_runner
     inputs:
       command: "pnpm typecheck"
       expect_exit_code: 0
   ```

See the checks documentation for complete details on each type.

### Evidence messages

Evidence messages must be actionable and specific:

- **Bad**: "Validation failed"
- **Good**: "Missing test file for src/utils/parser.ts"

- **Bad**: "Fix your configuration"
- **Good**: "tsconfig.json missing 'strict: true' in compilerOptions"

Include file names, line numbers, or specific missing values when available.

### Autofix hints

When you provide an autofix hint, make it concrete:

- **Bad**: "Add tests"
- **Good**: "Run `pnpm test --init src/utils/parser.test.ts`"

- **Bad**: "Use a logger"
- **Good**: "Replace with `logger.debug()` or remove the statement"

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

See [POLICY.md](POLICY.md) for complete severity guidelines.

## Pull request checklist

Before submitting your PR, verify:

- [ ] Schema validation passes locally
- [ ] Integrity hash is computed (not `<computed>`)
- [ ] Evidence messages are specific and actionable
- [ ] Autofix hints are concrete commands or steps
- [ ] Pack summary clearly states purpose in one sentence
- [ ] Namespace follows conventions (packs/base or packs/stacks)
- [ ] All check types use one of the 5 supported types
- [ ] No linter errors in CI

## Code of conduct

We aim to build a welcoming, constructive community:

- **Be respectful**: Treat all contributors with respect and consideration
- **Be constructive**: Focus on improving the quality of rules, not criticizing authors
- **Be objective**: Ground discussions in concrete examples and data
- **Be clear**: Explain your reasoning when proposing or reviewing changes

We have zero tolerance for harassment, discrimination, or hostile behavior.

## Getting help

Stuck? Here's how to get help:

- **Documentation**: Read the full docs at [aligntrue.ai/docs](https://aligntrue.ai/docs)
  - [Align Spec v1](spec/align-spec-v1.md) - Complete specification

- **Examples**: Browse existing packs in [`AlignTrue/aligns`](https://github.com/AlignTrue/aligns)
  - [base-testing](https://github.com/AlignTrue/aligns/blob/main/packs/base/base-testing.aligntrue.yaml) - Testing rules
  - [base-security](https://github.com/AlignTrue/aligns/blob/main/packs/base/base-security.aligntrue.yaml) - Security rules
  - [nextjs-app-router](https://github.com/AlignTrue/aligns/blob/main/packs/stacks/nextjs-app-router.aligntrue.yaml) - Stack-specific rules

- **Discussions**: Ask questions in [GitHub Discussions](https://github.com/AlignTrue/aligns/discussions)

- **Issues**: Report bugs or problems in [GitHub Issues](https://github.com/AlignTrue/aligns/issues)

## What happens next?

After you submit your PR:

1. **Automated checks run**: CI validates schema, checks hash, runs testkit
2. **Maintainer review**: A maintainer reviews your pack for quality and fit
3. **Feedback or approval**: You may receive feedback for improvements, or approval
4. **Merge**: Once approved, your pack is merged and appears in the examples directory
5. **Verification**: Example packs in `AlignTrue/aligntrue` are automatically verified

Typical review time is 2-5 days for new packs, faster for updates.

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

### Testing check runners

You can test check runners locally with:

```bash
# From the aligntrue repository
pnpm --filter @aligntrue/checks run-checks ../aligns/packs/base/your-pack.aligntrue.yaml /path/to/test/repo
```

This runs your checks against a test repository and shows findings.

## Questions?

If this guide doesn't answer your question:

- Check the [documentation](https://aligntrue.ai/docs)
- Search [existing discussions](https://github.com/AlignTrue/aligns/discussions)
- Open a [new discussion](https://github.com/AlignTrue/aligns/discussions/new)

We're here to help!

---

**Thank you** for contributing to AlignTrue and helping make AI-human alignment better for everyone.

---

**This file is auto-generated from the [AlignTrue documentation site](https://aligntrue.ai/docs).**  
**To propose changes, edit the source files in `apps/docs/content/` and run `pnpm generate:repo-files`.**
