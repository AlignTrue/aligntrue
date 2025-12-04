---
title: Examples
description: Working examples and curated rule aligns for AlignTrue
---

# Examples

Learn by example with working demonstrations and 11 curated rule aligns.

## Working examples (GitHub)

Complete, runnable examples in the AlignTrue repository:

### Golden repository

**Full-featured demo** with multiple agents, scopes, and team mode.

- Multiple exporters (Cursor, AGENTS.md, VS Code MCP)
- Hierarchical scopes for monorepo structure
- Team mode with lockfile for reproducibility
- Overlay customizations
- Test scripts for validation

[View golden-repo on GitHub →](https://github.com/AlignTrue/aligntrue/tree/main/examples/golden-repo)

**When to use:** Learning AlignTrue basics, solo developer workflow

**Files:** YAML format (`.aligntrue.yaml`, `.aligntrue.lock.json`)

### Overlays demo

**Fork-safe customization** without forking upstream aligns.

- Severity remapping (warn → error)
- Adding check inputs (threshold adjustments)
- Removing autofix
- Temporary overrides with comments
- Overlay status and diff commands

[View overlays-demo on GitHub →](https://github.com/AlignTrue/aligntrue/tree/main/examples/overlays-demo)

**When to use:** Customizing third-party aligns, team severity preferences

**Files:** YAML format with overlays section

### Monorepo scopes

**Path-based rule application** for monorepos with different tech stacks.

- Different rules per directory (Next.js, Node.js, Python)
- Team boundaries with scope ownership
- Include/exclude patterns
- Hierarchical merge order
- Scope validation

[View monorepo-scopes on GitHub →](https://github.com/AlignTrue/aligntrue/tree/main/examples/monorepo-scopes)

**When to use:** Monorepos, multiple tech stacks, team boundaries

**Files:** YAML format with scopes section, multiple directories

### Multi-agent workflows

**Same rules, multiple agents** - sync to Cursor, Copilot, Claude Code, and more.

- Multiple exporters (4+ agents)
- Vendor bags for agent-specific hints
- Same core rules, different agent optimizations
- Fidelity notes per agent
- Content hash verification

[View multi-agent on GitHub →](https://github.com/AlignTrue/aligntrue/tree/main/examples/multi-agent)

**When to use:** Using 2+ AI agents, agent-specific customization

**Files:** YAML format with vendor bags, multiple agent outputs

---

## Curated rule aligns

11 production-ready rule aligns maintained by AlignTrue. All aligns are CC0-licensed (public domain).

### Foundation aligns

- **[Base Global](https://github.com/AlignTrue/aligntrue/blob/main/examples/aligns/global.md)** - Essential baseline rules for all AI coding agents. Ensures deterministic behavior, clear output formatting, and consistent code quality practices. Natural markdown format.

- **[Base Documentation](https://github.com/AlignTrue/aligntrue/blob/main/examples/aligns/docs.md)** - Docs-as-code baseline enforcing readme-first development, CI-enforced quality, and behavior-synced documentation updates. Natural markdown format.

- **[TypeScript Standards](https://github.com/AlignTrue/aligntrue/blob/main/examples/aligns/typescript.md)** - TypeScript development standards for correctness, safety, and maintainability. Enforces strict compiler settings and no 'any' types. Natural markdown format.

- **[Testing Baseline](https://github.com/AlignTrue/aligntrue/blob/main/examples/aligns/testing.md)** - Testing baseline ensuring fast, deterministic, useful tests with clear strategy. Emphasizes test pyramid balance and speed requirements. Natural markdown format.

- **[TDD Workflow](https://github.com/AlignTrue/aligntrue/blob/main/examples/aligns/tdd.md)** - Test-Driven Development workflow implementing red-green-refactor cycle. Enforces writing tests before implementation. Natural markdown format.

- **[Debugging Workflow](https://github.com/AlignTrue/aligntrue/blob/main/examples/aligns/debugging.md)** - Systematic debugging workflow ensuring reproduce-before-fix discipline. Covers reproduce, reduce, root-cause, fix, and prevent cycles. Natural markdown format.

- **[Security and Compliance](https://github.com/AlignTrue/aligntrue/blob/main/examples/aligns/security.md)** - Security and compliance baseline covering secrets management, supply chain security, and dependency auditing. Natural markdown format.

### Framework & stack aligns

- **[Next.js App Router](https://github.com/AlignTrue/aligntrue/blob/main/examples/aligns/nextjs_app_router.md)** - Best practices for Next.js App Router covering server/client boundaries, caching strategies, and data fetching patterns. Natural markdown format.

- **[Vercel Deployments](https://github.com/AlignTrue/aligntrue/blob/main/examples/aligns/vercel_deployments.md)** - Vercel deployment best practices covering environment tiers, runtime selection, and preview hygiene. Natural markdown format.

- **[Web Quality Standards](https://github.com/AlignTrue/aligntrue/blob/main/examples/aligns/web_quality.md)** - Core Web Vitals targets, performance budgets, and accessibility standards. Enforces LCP under 2.5s and WCAG 2.0 AA compliance. Natural markdown format.

## Align details

<details>
<summary>View as table</summary>

| Align                       | ID                             | Description                                                                                                                                        | Categories                         | Compatible Tools                                                     |
| --------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------- |
| **Base Global**             | `aligns/base/base-global`      | Essential baseline rules for all AI coding agents. Ensures deterministic behavior, clear output formatting, and consistent code quality practices. | foundations, code-quality          | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf, Aider |
| **Base Documentation**      | `aligns/base/base-docs`        | Docs-as-code baseline enforcing readme-first development, CI-enforced quality, and behavior-synced documentation updates.                          | foundations, development-workflow  | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf, Aider |
| **TypeScript Standards**    | `aligns/base/base-typescript`  | TypeScript development standards for correctness, safety, and maintainability. Enforces strict compiler settings and no 'any' types.               | code-quality                       | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf        |
| **Testing Baseline**        | `aligns/base/base-testing`     | Testing baseline ensuring fast, deterministic, useful tests with clear strategy. Emphasizes test pyramid balance and speed requirements.           | code-quality, development-workflow | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf, Aider |
| **TDD Workflow**            | `aligns/base/base-tdd`         | Test-Driven Development workflow implementing red-green-refactor cycle. Enforces writing tests before implementation.                              | development-workflow, code-quality | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf        |
| **Debugging Workflow**      | `aligns/base/base-debugging`   | Systematic debugging workflow ensuring reproduce-before-fix discipline. Covers reproduce, reduce, root-cause, fix, and prevent cycles.             | development-workflow               | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf, Aider |
| **Security and Compliance** | `aligns/base/base-security`    | Security and compliance baseline covering secrets management, supply chain security, and dependency auditing.                                      | security, code-quality             | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf, Aider |
| **Next.js App Router**      | `aligns/frameworks/nextjs-app` | Best practices for Next.js App Router covering server/client boundaries, caching strategies, and data fetching patterns.                           | frameworks, web                    | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf        |
| **Vercel Deployments**      | `aligns/platforms/vercel`      | Vercel deployment best practices covering environment tiers, runtime selection, and preview hygiene.                                               | platforms, web                     | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf        |
| **Web Quality Standards**   | `aligns/base/base-web-quality` | Core Web Vitals targets, performance budgets, and accessibility standards. Enforces LCP under 2.5s and WCAG 2.0 AA compliance.                     | web, code-quality                  | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf        |

</details>

## Using aligns

### Quick install

```bash
# Add an align to your project
aligntrue add aligns/base/base-global

# Sync to your agents
aligntrue sync
```

### Browse on GitHub

All align YAML files are available in the [AlignTrue repository](https://github.com/AlignTrue/aligntrue/tree/main/examples/aligns).

### Customize with overlays

Need to adjust an align for your project? Use overlays:

```bash
# Remap severity
aligntrue override add rule-id --set severity=warning

# Disable a rule
aligntrue override add rule-id --set enabled=false
```

See [Overlays Guide](/docs/02-customization/overlays) for details.

## Contributing aligns

Want to share your rules with the community? See [Creating Aligns](/docs/07-contributing/creating-aligns) for guidelines.

---

**Note:** All aligns are CC0-licensed (public domain) and maintained by AlignTrue. Community contributions welcome!
