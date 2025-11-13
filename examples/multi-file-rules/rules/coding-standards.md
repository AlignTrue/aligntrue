# Coding Standards

## Code Style

- Use consistent formatting (Prettier/ESLint for JS/TS, Black for Python)
- Follow language-specific style guides (Airbnb for JS, PEP 8 for Python)
- Keep line length under 100 characters
- Use meaningful variable and function names

## Naming Conventions

- **Variables**: camelCase for JS/TS, snake_case for Python
- **Constants**: UPPER_SNAKE_CASE
- **Classes**: PascalCase
- **Files**: Match the primary export (e.g., `UserService.ts`)

## Comments and Documentation

- Write self-documenting code first
- Add comments for "why", not "what"
- Document public APIs with JSDoc/docstrings
- Keep README files up to date

## Error Handling

- Use try-catch blocks for expected errors
- Log errors with context (user ID, request ID, etc.)
- Return user-friendly error messages
- Never expose stack traces to end users

## Testing Standards

- Write unit tests for all business logic
- Aim for 80%+ code coverage
- Use integration tests for API endpoints
- Run tests in CI before merging

## Code Review Guidelines

Before submitting a PR:

- Run linter and fix all warnings
- Ensure all tests pass
- Update documentation if needed
- Keep PRs small (< 400 lines of changes)

During review:

- Be constructive and specific
- Approve only if you'd be comfortable maintaining the code
- Check for security issues and edge cases
