import type { RuleFile } from "@aligntrue/core";
import { computeContentHash } from "@aligntrue/schema";

/**
 * Create starter templates
 */
export function createStarterTemplates(): RuleFile[] {
  const templates: Array<{ title: string; content: string }> = [
    {
      title: "global",
      content: `# Global Guidelines

## Code Style
- Keep functions small and focused
- Use descriptive variable names
- Prefer composition over inheritance
- Use TypeScript for all new code

## Git Workflow
- Write clear commit messages (Conventional Commits preferred)
- Review your own PRs before requesting review
- Keep PRs small and focused
`,
    },
    {
      title: "testing",
      content: `# Testing Standards

## Principles
- Write tests for all new features
- Test behavior, not implementation details
- Keep tests independent and deterministic
- Use descriptive test names

## Stack
- Vitest for unit/integration tests
- Playwright for E2E tests
`,
    },
    {
      title: "typescript",
      content: `# TypeScript Guidelines

## Rules
- Use strict mode (noImplicitAny, strictNullChecks)
- Avoid \`any\`, use \`unknown\` if necessary
- Prefer interfaces/types over classes for data
- Use discriminated unions for state management
`,
    },
  ];

  return templates.map((t) => {
    const content = t.content;
    const hash = computeContentHash(content);
    const filename = `${t.title}.md`;

    return {
      content,
      frontmatter: {
        title: t.title,
        content_hash: hash,
        original_source: "starter-template",
      },
      path: filename,
      filename,
      hash,
    };
  });
}
