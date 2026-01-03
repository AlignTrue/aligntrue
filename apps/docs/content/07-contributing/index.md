---
title: Contributing
description: How to contribute to the AlignTrue ops platform.
---

# Contributing to AlignTrue

AlignTrue (ops platform) is in beta. Contributions are welcome—please bias toward small, reviewable changes and include tests where practical.

## Ways to contribute

- File issues for bugs, gaps, or unclear docs.
- Open PRs with focused changes; keep them small and descriptive.
- Improve docs when you change behavior or add APIs.

## Development basics

- Node 20+, pnpm 10 (see `package.json` engines).
- Install: `pnpm install`
- Build: `pnpm build`
- Fast checks: `pnpm test:fast`
- Full checks (CI parity): `pnpm ci`

## Coding guidelines

- TypeScript strict; avoid `any`.
- Prefer deterministic, side-effect-light modules; keep functions small.
- Follow existing module boundaries (`platform/*`, `packages/*`, `apps/*`).
- Use workspace `workspace:*` deps; run `pnpm validate:workspace` after dependency edits.

## Testing

- Add unit tests near the code you change.
- Run `pnpm test:fast` before opening a PR; run `pnpm ci` if changing core contracts.

## Security

- Do not log secrets or PII.
- Report vulnerabilities via `SECURITY.md`.

## Process

1. Branch from `main`.
2. Make the change and add tests/docs.
3. Run checks (`pnpm test:fast`, or `pnpm ci` for deeper changes).
4. Open a PR with clear summary and risk notes.
