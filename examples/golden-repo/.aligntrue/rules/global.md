<!--
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
