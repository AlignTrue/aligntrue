---
title: Available Packs
description: Browse 11 curated rule packs for AI coding agents
---

# Available Packs

Browse 11 curated rule packs for AI coding agents. All packs are CC0-licensed and maintained by AlignTrue.

## Foundation Packs

- **[Base Global](https://github.com/AlignTrue/aligntrue/blob/main/catalog/examples/global.yaml)** - Essential baseline rules for all AI coding agents. Ensures deterministic behavior, clear output formatting, and consistent code quality practices.

- **[Base Documentation](https://github.com/AlignTrue/aligntrue/blob/main/catalog/examples/docs.yaml)** - Docs-as-code baseline enforcing readme-first development, CI-enforced quality, and behavior-synced documentation updates.

- **[TypeScript Standards](https://github.com/AlignTrue/aligntrue/blob/main/catalog/examples/typescript.yaml)** - TypeScript development standards for correctness, safety, and maintainability. Enforces strict compiler settings and no 'any' types.

- **[Testing Baseline](https://github.com/AlignTrue/aligntrue/blob/main/catalog/examples/testing.yaml)** - Testing baseline ensuring fast, deterministic, useful tests with clear strategy. Emphasizes test pyramid balance and speed requirements.

- **[TDD Workflow](https://github.com/AlignTrue/aligntrue/blob/main/catalog/examples/tdd.yaml)** - Test-Driven Development workflow implementing red-green-refactor cycle. Enforces writing tests before implementation.

- **[Debugging Workflow](https://github.com/AlignTrue/aligntrue/blob/main/catalog/examples/debugging.yaml)** - Systematic debugging workflow ensuring reproduce-before-fix discipline. Covers reproduce, reduce, root-cause, fix, and prevent cycles.

- **[Security and Compliance](https://github.com/AlignTrue/aligntrue/blob/main/catalog/examples/security.yaml)** - Security and compliance baseline covering secrets management, supply chain security, and dependency auditing.

- **[Rule Authoring Guide](https://github.com/AlignTrue/aligntrue/blob/main/catalog/examples/rule-authoring.yaml)** - Meta-guide for authoring AlignTrue rules with clear scope, actionable directives, and explicit precedence.

## Framework & Stack Packs

- **[Next.js App Router](https://github.com/AlignTrue/aligntrue/blob/main/catalog/examples/nextjs_app_router.yaml)** - Best practices for Next.js App Router covering server/client boundaries, caching strategies, and data fetching patterns.

- **[Vercel Deployments](https://github.com/AlignTrue/aligntrue/blob/main/catalog/examples/vercel_deployments.yaml)** - Vercel deployment best practices covering environment tiers, runtime selection, and preview hygiene.

- **[Web Quality Standards](https://github.com/AlignTrue/aligntrue/blob/main/catalog/examples/web_quality.yaml)** - Core Web Vitals targets, performance budgets, and accessibility standards. Enforces LCP under 2.5s and WCAG 2.0 AA compliance.

## Pack Details

<details>
<summary>View as table</summary>

| Pack                        | ID                                | Description                                                                                                                                        | Categories                         | Compatible Tools                                                     |
| --------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------- |
| **Base Global**             | `packs/base/base-global`          | Essential baseline rules for all AI coding agents. Ensures deterministic behavior, clear output formatting, and consistent code quality practices. | foundations, code-quality          | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf, Aider |
| **Base Documentation**      | `packs/base/base-docs`            | Docs-as-code baseline enforcing readme-first development, CI-enforced quality, and behavior-synced documentation updates.                          | foundations, development-workflow  | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf, Aider |
| **TypeScript Standards**    | `packs/base/base-typescript`      | TypeScript development standards for correctness, safety, and maintainability. Enforces strict compiler settings and no 'any' types.               | code-quality                       | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf        |
| **Testing Baseline**        | `packs/base/base-testing`         | Testing baseline ensuring fast, deterministic, useful tests with clear strategy. Emphasizes test pyramid balance and speed requirements.           | code-quality, development-workflow | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf, Aider |
| **TDD Workflow**            | `packs/base/base-tdd`             | Test-Driven Development workflow implementing red-green-refactor cycle. Enforces writing tests before implementation.                              | development-workflow, code-quality | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf        |
| **Debugging Workflow**      | `packs/base/base-debugging`       | Systematic debugging workflow ensuring reproduce-before-fix discipline. Covers reproduce, reduce, root-cause, fix, and prevent cycles.             | development-workflow               | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf, Aider |
| **Security and Compliance** | `packs/base/base-security`        | Security and compliance baseline covering secrets management, supply chain security, and dependency auditing.                                      | security, code-quality             | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf, Aider |
| **Rule Authoring Guide**    | `packs/base/base-rule-authoring`  | Meta-guide for authoring AlignTrue rules with clear scope, actionable directives, and explicit precedence.                                         | development-workflow, foundations  | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf, Aider |
| **Next.js App Router**      | `packs/stacks/nextjs-app-router`  | Best practices for Next.js App Router covering server/client boundaries, caching strategies, and data fetching patterns.                           | frameworks                         | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf        |
| **Vercel Deployments**      | `packs/stacks/vercel-deployments` | Vercel deployment best practices covering environment tiers, runtime selection, and preview hygiene.                                               | infrastructure                     | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf        |
| **Web Quality Standards**   | `packs/stacks/web-quality`        | Core Web Vitals targets, performance budgets, and accessibility standards. Enforces LCP under 2.5s and WCAG 2.0 AA compliance.                     | performance, code-quality          | Cursor, Claude Code, GitHub Copilot, Cody, Continue, Windsurf        |

</details>

## How to Use

All packs are available in the [`catalog/examples/`](https://github.com/AlignTrue/aligntrue/tree/main/catalog/examples) directory. Click any pack card above to view the source YAML file.

To use a pack in your project, copy the YAML content into your `.aligntrue/rules.md` file or reference it in your AlignTrue configuration.

## License

All packs are released under CC0-1.0 (public domain dedication). Use them freely in any project.
