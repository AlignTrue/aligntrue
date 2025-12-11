<!--
  STARTER RULE: This is a starting point to help you get going.
  Update, expand, or replace it based on your project's needs.
-->

# AI Collaboration Guidance

This project assumes all code is AI-edited. Design for safe, cheap future changes.

## Code structure and contracts

- Define minimal interfaces and contracts first.
- Add tests second to verify the contract.
- Prefer small modules with explicit contracts.
- Keep functions short and names predictable.
- Minimize side effects and hidden state.

## Explicitness over cleverness

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
