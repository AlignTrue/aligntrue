---
description: Contribute to AlignTrue as a content creator, code contributor, or community member.
---

# Contributing to AlignTrue

Thank you for your interest in contributing to AlignTrue! We welcome contributions from everyone: whether you're creating Aligns, improving documentation, adding exporters, or fixing bugs in the core codebase.

## Contribution types

AlignTrue has many ways to get involved:

### Content contributions

Create and maintain rule sets (Aligns) that help others align their AI agents.

**[Create Aligns](/docs/07-contributing/creating-aligns)** — Write rules that solve real problems for your domain or stack.

**[Edit documentation](/docs/07-contributing/editing-docs)** — Improve docs on the site or contribute to our docs-first architecture.

### Code contributions

Extend AlignTrue's core platform and integrations.

**[Add exporters](/docs/07-contributing/adding-exporters)** — Support new AI agents and platforms.

**[Development setup](/docs/06-development/setup)** — Local environment, build, and test workflow.

## Getting started

1. **New to contributing?** Start with [How to contribute](/docs/07-contributing/getting-started).
2. **Unsure what to work on?** Check [GitHub Issues](https://github.com/AlignTrue/aligntrue/issues) for `good-first-issue` labels.
3. **Want to discuss first?** Join [GitHub Discussions](https://github.com/AlignTrue/aligntrue/discussions).

## Key workflows

### Before you start

- Review the [Code of Conduct](#code-of-conduct) below
- Check [Development setup](/docs/06-development/setup) to get your environment ready
- Read [Testing workflow](/docs/07-contributing/testing-workflow) — all contributions need tests

### While working

- Create a feature branch
- Write tests alongside your changes
- Follow the relevant guide ([Aligns](/docs/07-contributing/creating-aligns), [docs](/docs/07-contributing/editing-docs), [exporters](/docs/07-contributing/adding-exporters))
- Keep a fast loop running: `pnpm test:fast`

### Before submitting a PR

1. Run the workspace checks: `pnpm check`
2. Mirror CI locally: `pnpm pre-ci`
3. Update `CHANGELOG.md` if needed
4. Open a GitHub **Draft PR** with a clear description of what changed and why

## Code of conduct

We aim to build a welcoming, constructive community:

- **Be respectful** — Treat all contributors with respect and consideration
- **Be constructive** — Focus on improving the quality of work, not criticizing people
- **Be objective** — Ground discussions in concrete examples and data
- **Be clear** — Explain your reasoning when proposing or reviewing changes

We have zero tolerance for harassment, discrimination, or hostile behavior.

## Common questions

### I want to contribute but don't know what to work on

- Browse [GitHub Issues](https://github.com/AlignTrue/aligntrue/issues) and filter by `good-first-issue`
- Check [GitHub Issues](https://github.com/AlignTrue/aligntrue/issues?q=is%3Aissue+is%3Aopen+label%3Aaccepted) for accepted ideas
- Ask in [GitHub Discussions](https://github.com/AlignTrue/aligntrue/discussions)

### What if my work is incomplete?

- Open a GitHub Draft PR (no `[WIP]` prefix needed)
- Push your branch frequently so reviewers can follow along
- Describe what's done and what's left
- We're happy to provide feedback before completion

### How long does review take?

- Small PRs (< 200 lines): 1-3 days
- Medium PRs: 3-5 days
- Large changes: We may request phased submission to keep reviews manageable
- If you have not heard back in 3 business days, feel free to add a gentle ping

### Can I work on this issue?

- Comment on the issue to claim it; maintainers will confirm or suggest next steps
- If an accepted, unassigned issue has no response after 3 business days, you can proceed and note that you're taking it
- Some issues are reserved for maintainers — they'll be labeled

## Learning resources

### Documentation

- [Getting started](/docs/00-getting-started/00-quickstart)
- [How AlignTrue works](/docs) — Core concepts and architecture
- [Development guide](/docs/06-development/)
- [Architecture](/docs/06-development/architecture)

### Code references

- [Schema validation](https://github.com/AlignTrue/aligntrue/tree/main/packages/schema)
- [CLI commands](https://github.com/AlignTrue/aligntrue/tree/main/packages/cli)
- [Core library](https://github.com/AlignTrue/aligntrue/tree/main/packages/core)
- [Exporters](https://github.com/AlignTrue/aligntrue/tree/main/packages/exporters)

### Examples

- [`examples/aligns/README.md`](https://github.com/AlignTrue/aligntrue/tree/main/examples/aligns/README.md) — ready-to-use rule sets and authoring patterns
- [`examples/golden-repo`](https://github.com/AlignTrue/aligntrue/tree/main/examples/golden-repo) — end-to-end baseline repo with overlays scenarios
- [`examples/overlays-demo`](https://github.com/AlignTrue/aligntrue/tree/main/examples/overlays-demo) — focused overlays walkthrough

## Getting help

Stuck or need guidance?

- **Issues**: [GitHub Issues](https://github.com/AlignTrue/aligntrue/issues) — Report bugs or ask for features
- **Discussions**: [GitHub Discussions](https://github.com/AlignTrue/aligntrue/discussions) — Ask questions, share ideas
- **Documentation**: [Full docs](/docs) — Search for concepts or commands
- **Development guide**: [Setup and workflow](/docs/06-development/setup)

## Contribution checklist

Before submitting:

- [ ] I have read the Code of Conduct
- [ ] I have reviewed the relevant contribution guide
- [ ] I have tested my changes locally
- [ ] I have added tests for new functionality
- [ ] I have updated documentation (if needed)
- [ ] I have updated `CHANGELOG.md` (for user-facing changes)
- [ ] All checks pass: `pnpm check`
- [ ] All pre-CI checks pass: `pnpm pre-ci`

---

**Thank you** for helping make AlignTrue better for everyone!
