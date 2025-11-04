---
title: Examples
description: Working examples and curated rule packs for AlignTrue
---

# Examples

Learn by example with working demonstrations and 11 curated rule packs.

## Working examples (GitHub)

Complete, runnable examples in the AlignTrue repository:

### Golden repository

**Full-featured demo** with multiple agents, scopes, and team mode.

- Multiple exporters (Cursor, AGENTS.md, VS Code MCP)
- Hierarchical scopes for monorepo structure
- Team mode with lockfile and allow list
- Overlay customizations
- Test scripts for validation

[View golden-repo on GitHub →](https://github.com/AlignTrue/aligntrue/tree/main/examples/golden-repo)

**Files:** YAML format (`.aligntrue.yaml`, `.aligntrue.lock.json`)

### Markdown authoring examples

**Literate markdown** examples showing fenced code block syntax.

- Simple rules with inline documentation
- Multi-block validation examples
- Round-trip markdown ↔ YAML workflows

[View markdown examples on GitHub →](https://github.com/AlignTrue/aligntrue/tree/main/examples/markdown)

**Files:** Markdown format (`.md` with ` ```aligntrue` blocks)

### Team repository example

**Team collaboration** setup with vendored packs.

- Vendored pack management
- Team approval workflows
- Git submodule integration

[View team-repo on GitHub →](https://github.com/AlignTrue/aligntrue/tree/main/examples/team-repo)

**Files:** YAML format with vendor directory

---

## Curated rule packs

11 production-ready rule packs maintained by AlignTrue. All packs are CC0-licensed (public domain).

### Foundation packs

- **[Base Global](https://github.com/AlignTrue/aligntrue/blob/main/examples/packs/global.yaml)** - Essential baseline rules for all AI coding agents. Ensures deterministic behavior, clear output formatting, and consistent code quality practices.

- **[Base Documentation](https://github.com/AlignTrue/aligntrue/blob/main/examples/packs/docs.yaml)** - Docs-as-code baseline enforcing readme-first development, CI-enforced quality, and behavior-synced documentation updates.

- **[TypeScript Standards](https://github.com/AlignTrue/aligntrue/blob/main/examples/packs/typescript.yaml)** - TypeScript development standards for correctness, safety, and maintainability. Enforces strict compiler settings and no 'any' types.

- **[Testing Baseline](https://github.com/AlignTrue/aligntrue/blob/main/examples/packs/testing.yaml)** - Testing baseline ensuring fast, deterministic, useful tests with clear strategy. Emphasizes test pyramid balance and speed requirements.

- **[TDD Workflow](https://github.com/AlignTrue/aligntrue/blob/main/examples/packs/tdd.yaml)** - Test-Driven Development workflow implementing red-green-refactor cycle. Enforces writing tests before implementation.

- **[Debugging Workflow](https://github.com/AlignTrue/aligntrue/blob/main/examples/packs/debugging.yaml)** - Systematic debugging workflow ensuring reproduce-before-fix discipline. Covers reproduce, reduce, root-cause, fix, and prevent cycles.

- **[Security and Compliance](https://github.com/AlignTrue/aligntrue/blob/main/examples/packs/security.yaml)** - Security and compliance baseline covering secrets management, supply chain security, and dependency auditing.

- **[Rule Authoring Guide](https://github.com/AlignTrue/aligntrue/blob/main/examples/packs/rule-authoring.yaml)** - Meta-guide for authoring AlignTrue rules with clear scope, actionable directives, and explicit precedence.

### Framework & Stack Packs

- **[Next.js App Router](https://github.com/AlignTrue/aligntrue/blob/main/examples/packs/nextjs_app_router.yaml)** - Best practices for Next.js App Router covering server/client boundaries, caching strategies, and data fetching patterns.

- **[Vercel Deployments](https://github.com/AlignTrue/aligntrue/blob/main/examples/packs/vercel_deployments.yaml)** - Vercel deployment best practices covering environment tiers, runtime selection, and preview hygiene.

- **[Web Quality Standards](https://github.com/AlignTrue/aligntrue/blob/main/examples/packs/web_quality.yaml)** - Core Web Vitals targets, performance budgets, and accessibility standards. Enforces LCP under 2.5s and WCAG 2.0 AA compliance.

## Pack details

<details>
<summary>View as table</summary>

| Pack                        | ID                               | Description                                                                                                                                        | Categories                         | Compatible Tools                                                     |
| --------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------- |
| **Base Global**             | `packs/base/base-global`         | Essential baseline rules for all AI coding agents. Ensures deterministic behavior, clear output formatting, and consistent code quality practices. | foundations, code-quality          | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf, Aider |
| **Base Documentation**      | `packs/base/base-docs`           | Docs-as-code baseline enforcing readme-first development, CI-enforced quality, and behavior-synced documentation updates.                          | foundations, development-workflow  | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf, Aider |
| **TypeScript Standards**    | `packs/base/base-typescript`     | TypeScript development standards for correctness, safety, and maintainability. Enforces strict compiler settings and no 'any' types.               | code-quality                       | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf        |
| **Testing Baseline**        | `packs/base/base-testing`        | Testing baseline ensuring fast, deterministic, useful tests with clear strategy. Emphasizes test pyramid balance and speed requirements.           | code-quality, development-workflow | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf, Aider |
| **TDD Workflow**            | `packs/base/base-tdd`            | Test-Driven Development workflow implementing red-green-refactor cycle. Enforces writing tests before implementation.                              | development-workflow, code-quality | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf        |
| **Debugging Workflow**      | `packs/base/base-debugging`      | Systematic debugging workflow ensuring reproduce-before-fix discipline. Covers reproduce, reduce, root-cause, fix, and prevent cycles.             | development-workflow               | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf, Aider |
| **Security and Compliance** | `packs/base/base-security`       | Security and compliance baseline covering secrets management, supply chain security, and dependency auditing.                                      | security, code-quality             | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf, Aider |
| **Rule Authoring Guide**    | `packs/base/base-rule-authoring` | Meta-guide for authoring AlignTrue rules with clear scope, actionable directives, and explicit precedence.                                         | development-workflow, foundations  | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf, Aider |
| **Next.js App Router**      | `packs/frameworks/nextjs-app`    | Best practices for Next.js App Router covering server/client boundaries, caching strategies, and data fetching patterns.                           | frameworks, web                    | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf        |
| **Vercel Deployments**      | `packs/platforms/vercel`         | Vercel deployment best practices covering environment tiers, runtime selection, and preview hygiene.                                               | platforms, web                     | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf        |
| **Web Quality Standards**   | `packs/base/base-web-quality`    | Core Web Vitals targets, performance budgets, and accessibility standards. Enforces LCP under 2.5s and WCAG 2.0 AA compliance.                     | web, code-quality                  | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf        |

</details>

## Using packs

### Quick install

```bash
# Add a pack to your project
aligntrue add packs/base/base-global

# Sync to your agents
aligntrue sync
```

### Browse on GitHub

All pack YAML files are available in the [AlignTrue repository](https://github.com/AlignTrue/aligntrue/tree/main/examples/packs).

### Customize with overlays

Need to adjust a pack for your project? Use overlays:

```bash
# Remap severity
aligntrue override add rule-id --set severity=warning

# Disable a rule
aligntrue override add rule-id --set enabled=false
```

See [Overlays Guide](/docs/02-concepts/overlays) for details.

## Contributing packs

Want to share your rules with the community? See [Creating Packs](/docs/05-contributing/creating-packs) for guidelines.

---

**Note:** All packs are CC0-licensed (public domain) and maintained by AlignTrue. Community contributions welcome!
