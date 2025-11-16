---
id: "large-rules/code-review"
version: "1.0.0"
spec_version: "1"
summary: "Code review standards and pull request guidelines"
---

# Code Review Standards

## Pull Request Guidelines

Create good pull requests:

- Keep PRs small and focused (< 400 lines)
- Write clear PR description
- Link related issues
- Include screenshots for UI changes
- Add tests for new functionality
- Update documentation
- Run tests locally before submitting
- Respond to feedback promptly

## PR Description Template

Use consistent PR template:

```markdown
## What

Brief description of changes

## Why

Reason for changes

## How

Implementation approach

## Testing

How to test the changes

## Screenshots

(if applicable)

## Checklist

- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes
- [ ] Reviewed own code
```

## Review Checklist

Review systematically:

- Does code solve the stated problem?
- Is code readable and maintainable?
- Are tests adequate?
- Are there edge cases not handled?
- Is error handling appropriate?
- Are there performance concerns?
- Is documentation updated?
- Are there security issues?
- Does it follow project conventions?

## Providing Feedback

Give constructive feedback:

- Be specific and actionable
- Explain the "why" behind suggestions
- Distinguish between must-fix and nice-to-have
- Praise good solutions
- Ask questions rather than demand changes
- Focus on code, not the person
- Provide examples when helpful
- Be respectful and professional

Feedback examples:

- Good: "Consider extracting this logic into a separate function for better testability"
- Bad: "This is wrong"

## Receiving Feedback

Handle feedback professionally:

- Don't take feedback personally
- Ask for clarification if needed
- Explain your reasoning when appropriate
- Be open to different approaches
- Thank reviewers for their time
- Address all feedback (implement or explain why not)
- Mark conversations as resolved

## Review Priorities

Focus review on:

1. Correctness: Does it work as intended?
2. Security: Are there vulnerabilities?
3. Performance: Are there obvious bottlenecks?
4. Maintainability: Can others understand and modify it?
5. Tests: Is it adequately tested?
6. Style: Does it follow conventions? (lowest priority)

## Approval Process

Follow approval workflow:

- Require at least one approval
- Require approvals from code owners
- Address all blocking comments
- Re-review after significant changes
- Don't approve your own PRs
- Don't merge without approval
- Use "Request changes" for blocking issues

## Merge Strategy

Choose merge strategy consistently:

- Squash commits for clean history
- Rebase for linear history
- Merge commits for preserving context
- Delete branch after merge
- Update branch before merging
- Resolve conflicts carefully

## Automated Checks

Require automated checks to pass:

- Linting and formatting
- Unit tests
- Integration tests
- Build success
- Security scans
- Code coverage thresholds
- No merge conflicts

## Review Turnaround

Respond to reviews promptly:

- Review within 24 hours when possible
- Set status to "In Review" when ready
- Notify reviewers of updates
- Don't let PRs go stale
- Escalate blocked PRs
- Communicate delays

## Self-Review

Review own code first:

- Read through all changes
- Check for debugging code
- Verify tests pass
- Run linter and formatter
- Check for commented code
- Verify documentation
- Test manually if needed
