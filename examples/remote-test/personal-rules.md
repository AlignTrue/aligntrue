---
id: "personal/coding-preferences"
version: "1.0.0"
spec_version: "1"
summary: "Personal coding preferences and local tooling configuration"
---

# Personal coding preferences

These are my personal coding preferences that complement team standards.

## Editor configuration

Use VSCode with these extensions:

- Prettier for code formatting
- ESLint for linting
- GitLens for git history
- Error Lens for inline diagnostics

Configure auto-save on focus change and format on save.

## Code style preferences

I prefer functional programming patterns when appropriate:

- Use `const` by default, `let` only when reassignment is needed
- Prefer arrow functions for callbacks and short functions
- Use array methods (map, filter, reduce) over loops
- Favor immutability and pure functions

## Import organization

Organize imports in this order:

1. Node built-ins
2. External packages
3. Internal absolute imports
4. Internal relative imports

Add blank lines between groups for clarity.

## Comment style

Write comments that explain "why" not "what":

- Document business logic and non-obvious decisions
- Add TODO comments with your initials and date
- Use JSDoc for public APIs and exported functions
- Keep comments concise and up-to-date

## Testing preferences

I prefer test-driven development:

- Write tests before implementation
- Use descriptive test names that read like sentences
- Arrange-Act-Assert pattern for test structure
- Mock external dependencies, not internal modules

## Git workflow

My git workflow preferences:

- Commit early and often with atomic commits
- Write commit messages in present tense
- Use conventional commits format (feat:, fix:, docs:, etc.)
- Rebase feature branches before merging
- Squash commits for cleaner history

## Local development tools

I use these tools for local development:

- `nvm` for Node version management
- `pnpm` for package management
- `tmux` for terminal multiplexing
- `ripgrep` for fast code search
- `jq` for JSON processing

## Debugging approach

My debugging workflow:

- Start with reading error messages literally
- Use debugger breakpoints over console.log
- Reproduce issues with minimal test cases
- Document findings in issue comments
- Add tests to prevent regressions

## Performance mindset

I prioritize performance where it matters:

- Profile before optimizing
- Focus on algorithmic complexity first
- Cache expensive computations
- Lazy load when possible
- Measure impact with benchmarks

## Documentation habits

I maintain documentation as I code:

- Update README when adding features
- Document API changes in CHANGELOG
- Add inline comments for complex logic
- Create diagrams for architecture decisions
- Keep examples up-to-date
