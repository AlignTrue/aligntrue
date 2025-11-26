import type { RuleFile } from "@aligntrue/core";
import { computeContentHash } from "@aligntrue/schema";

/**
 * Create starter templates
 * Stack-agnostic best practices drawn from the agents-starter.ts guidance
 */
export function createStarterTemplates(): RuleFile[] {
  const templates: Array<{ title: string; content: string }> = [
    {
      title: "global",
      content: `<!--
  STARTER RULE: This is a starting point to help you get going.
  Update, expand, or replace it based on your project's needs.
-->

# Global Principles

Keep the codebase stable, safe, and maintainable.

Match the existing style, patterns, and conventions in this project. Prefer minimal, targeted changes over large rewrites. Make your reasoning and tradeoffs explicit.

When you are unsure or information is ambiguous, stop and ask for clarification.

## Code Quality

- Keep functions and modules focused. Avoid "god objects" and overly complex functions.
- Use clear, simple code over cleverness.
- Preserve public APIs and existing behavior unless explicitly asked to make breaking changes.
- Avoid unnecessary meta-programming and "magic" that hides control flow or behavior.

## Correctness and Safety

Follow these priorities:

1. Correctness
2. Security and safety
3. Maintainability and clarity
4. Performance

## Change Hygiene

- Prefer small, coherent changes.
- Group related edits together.
- When you touch a file, clean up nearby small issues only if safe and related to the change.
- Use clear commit messages explaining what changed and why.
`,
    },
    {
      title: "testing",
      content: `<!--
  STARTER RULE: This is a starting point to help you get going.
  Update, expand, or replace it based on your project's needs.
-->

# Testing Standards

Add or update tests for any nontrivial change. Use the existing test framework and patterns in this project.

## Test Quality

- Prefer fast, focused unit tests.
- Only use integration or end-to-end tests when necessary.
- Test behavior, not implementation details.
- Keep tests independent and deterministic.
- Use descriptive test names that explain what is being tested.

## Test Design

- Tests should act as executable specs: clear names, simple setups, deterministic assertions.
- Explain why a test is missing if you cannot add one, and call out the risk.
- When fixing a bug, add a regression test that fails before the fix and passes after.
- Aim for test coverage that gives confidence in correctness (target 80%+ for critical code).

## Test Co-location

Place test files next to source files using the \`.test.*\` or \`.spec.*\` naming convention:

- \`src/utils/parser.ts\` → \`src/utils/parser.test.ts\`
- \`src/components/Button.tsx\` → \`src/components/Button.test.tsx\`
`,
    },
    {
      title: "ai-guidance",
      content: `<!--
  STARTER RULE: This is a starting point to help you get going.
  Update, expand, or replace it based on your project's needs.
-->

# AI Collaboration Guidance

This project assumes all code is AI-edited. Design for safe, cheap future changes.

## Code Structure and Contracts

- Define minimal interfaces and contracts first.
- Add tests second to verify the contract.
- Prefer small modules with explicit contracts.
- Keep functions short and names predictable.
- Minimize side effects and hidden state.

## Explicitness Over Cleverness

- Make structure obvious: organize directories clearly and use descriptive naming.
- Prefer explicit over implicit. Avoid hidden side effects and global mutable state.
- Document contracts and invariants for nontrivial functions, focusing on why, not what.
- Keep changes localized; avoid cross-cutting edits unless refactoring with a plan.
- Use patterns consistently; explain new patterns briefly in code comments.

## Workflow

- Update docs only when behavior changes.
- If rules conflict, raise the conflict and propose a resolution.
- Tighten tests when behavior is ambiguous before making heavy edits.
- If stuck or looping, pause and request reassessment.

## Communication

- State assumptions explicitly.
- Provide actionable details: exact flags, files, and snippets.
- Be direct and honest about limits, risks, and edge cases.
- When you change patterns, explain them briefly for future agents.
`,
    },
    {
      title: "security",
      content: `<!--
  STARTER RULE: This is a starting point to help you get going.
  Update, expand, or replace it based on your project's needs.
-->

# Security and Privacy

Never log secrets, tokens, passwords, or personal data.

## Secrets and Configuration

- Use existing secrets/configuration mechanisms (environment variables, secure vaults).
- Never hardcode or commit API keys, passwords, or tokens.
- Keep sensitive data out of version control.

## Input Validation

- Validate and sanitize untrusted input (file paths, user input, external data).
- Follow established authentication and authorization patterns.
- Do not bypass security checks.

## Risk Communication

- Call out potential security risks clearly, even if outside the current request.
- Be explicit about what is validated and what is not.
- Flag security-adjacent issues that could compound over time.
`,
    },
  ];

  return templates.map((t) => {
    const content = t.content;
    const hash = computeContentHash(content);
    const filename = `${t.title}.md`;

    // Build smart defaults for frontmatter
    const frontmatterDefaults: Record<string, unknown> = {
      title: t.title,
      content_hash: hash,
      original_source: "starter-template",
    };

    // Add description for all templates
    const descriptions: Record<string, string> = {
      global: "Core coding principles and development practices for all files",
      testing: "Testing standards and best practices for this project",
      "ai-guidance": "Guidance for AI-assisted development and code generation",
      security: "Security and privacy guidelines for this project",
    };

    if (descriptions[t.title]) {
      frontmatterDefaults["description"] = descriptions[t.title];
    }

    // Global rule: set to always apply
    if (t.title === "global") {
      frontmatterDefaults["apply_to"] = "alwaysOn";
    }

    return {
      content,
      frontmatter: frontmatterDefaults,
      path: filename,
      filename,
      hash,
    };
  });
}
