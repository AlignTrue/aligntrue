/**
 * AGENTS.md starter template (Natural Markdown)
 * Clean, user-friendly format without explicit rule structure
 */

export function generateAgentsMdStarter(_projectId?: string): string {
  return `# AGENTS

<!-- Default rules to get you started. Update, remove, or replace them as needed. -->

## Global principles

1. Keep the codebase stable, safe, and maintainable.

2. Match the existing style, patterns, and conventions in this repo.

3. Prefer minimal, targeted changes over large rewrites.

4. Make your reasoning and tradeoffs explicit.

5. If you are missing information or something is ambiguous, stop and ask.

6. Optimize the codebase so future AI agents can understand, modify, and extend it safely.

---

## Project awareness

- Before changing anything, scan the repo structure:

  - Package and build files (for example: \`package.json\`, \`pyproject.toml\`, \`go.mod\`, \`pom.xml\`, \`Cargo.toml\`)

  - Lockfiles and tool configs (for example: \`pnpm-lock.yaml\`, \`yarn.lock\`, \`requirements.txt\`, \`.prettierrc\`, \`.eslintrc.*\`, \`ruff.toml\`)

  - CI and deployment files (for example: \`.github/workflows\`, \`Dockerfile\`, \`docker-compose.yml\`)

- Align with the existing stack. Do not introduce new languages, frameworks, or package managers unless explicitly requested.

- When you make assumptions about the stack or architecture, state them clearly.

- Prefer explicit, text-based configuration and rules that are easy for tools and AI to parse over opaque or binary formats.

---

## Coding guidelines

- Match the existing formatting and lint rules.

  - Use the project’s formatter and linter. Do not invent new formatting rules.

- Prefer clear, simple code over cleverness.

- Follow these priorities when coding:

  1. Correctness

  2. Security and safety

  3. Maintainability and clarity

  4. Performance

- Keep functions and modules focused. Avoid “god objects” and huge functions.

- Preserve public APIs and existing behavior unless the change request explicitly allows breaking changes.

- When you touch a file, clean up nearby small issues only if it is obviously safe and related to the change.

- Avoid unnecessary meta-programming and “magic” that hides control flow or behavior from static reading.

---

## AI maintainable code

- Make structure obvious, keep directories organized, and use descriptive naming.

- Prefer explicit over implicit. Avoid hidden side effects and global mutable state.

- Document contracts and invariants for nontrivial functions, focusing on why, not what.

- Keep changes localized; avoid cross-cutting edits unless refactoring with a plan.

- Use patterns consistently; explain new patterns briefly.

- Write code that is easy to analyze.

- Tests should act as executable specs: clear names, simple setups, deterministic assertions.

- Make rules and workflows tool-friendly (plain text, easy to parse).

- When conventions for AI change, update docs or rule files accordingly.

---

## Tests

- For any nontrivial change:

  - Add or update tests that cover the change.

  - Use the existing test framework and patterns in this repo.

- Prefer fast, focused unit tests; only use integration or end-to-end tests when necessary.

- Design tests so both humans and AI can understand intent.

- Explain why a test is missing if you cannot add one, and call out the risk.

- When fixing a bug, add a regression test that fails before the fix and passes after.

---

## Dependencies

- Minimize new dependencies.

- Before adding one:

  - Check for existing functionality in the codebase or standard library.

  - Prefer maintained, widely-used libraries.

- If you add a dependency, explain why it is needed and outline tradeoffs.

- Do not change package managers or dependency systems without explicit instruction.

---

## Performance and reliability

- Avoid wasteful patterns such as unnecessary nested loops or repeated heavy computations.

- Be mindful of I/O; prefer streaming/pagination when handling large data.

- Handle errors thoughtfully: fail fast on programmer errors but provide helpful messages for users.

- Flag any performance or reliability impact and suggest how to measure it.

---

## Security and privacy

- Never log secrets, tokens, passwords, or personal data.

- Use existing secrets/configuration mechanisms rather than hard coding.

- Validate and sanitize untrusted input (file paths, queries, user code).

- Follow established auth patterns; do not bypass checks.

- Call out potential security risks clearly even if they are outside the request.

---

## Documentation

- Update docs when behavior, APIs, or flows change.

- Keep README and top-level docs accurate for install, usage, and workflows.

- Use docstrings/comments to explain “why.”

- Where helpful, add short structural notes or pointers for future AI agents.

---

## Git and change hygiene

- Prefer small, coherent changes.

- Group related edits together.

- Use clear commit/PR titles plus a short risk/next-step summary.

- Avoid large refactors unless approved; propose a plan if needed.

---

## Interaction style

- Be concise but precise.

- Summarize understanding before writing a lot of code.

- Highlight files needing edits and describe each briefly.

- Call out breaking changes, migrations, or manual steps.

- When you change patterns, explain them for future agents.

- If instructions conflict, follow the user’s explicit guidance and note the conflict.

---

## When to stop and ask

- Stop and ask when requirements are ambiguous or conflict.

- Stop when a change introduces a new framework/language/manager or requires a breaking API change.

- Ask when unsure about business rules, security, or migration steps.

- Lay out options, tradeoffs, and your recommendation before waiting for guidance.
`;
}

/**
 * Get the default path for AGENTS.md starter template
 */
export function getAgentsMdStarterPath(): string {
  return "AGENTS.md";
}
