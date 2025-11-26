---
id: "aligns/base/base-tdd"
version: "1.0.0"
summary: "Test-driven development: red-green-refactor, small steps, design from tests"
tags: ["tdd", "testing", "design", "paved-road"]
---

# Test-Driven Development Guide

Test-driven development workflow: red-green-refactor, design from tests, and emergent architecture.

## TDD Workflow

The TDD cycle:

1. **Red** - Write failing test
2. **Green** - Simplest code that passes
3. **Refactor** - Improve without changing behavior
4. **Repeat** - For each behavior

## Benefits

- **Design emerges** from requirements
- **Fewer bugs** - Tested from the start
- **Confidence** - Comprehensive test coverage
- **Documentation** - Tests show usage
- **Faster debugging** - Failures caught immediately

## Small steps

Keep steps tiny:

- One assertion per test
- Focus on single behavior
- Make tests fail before passing
- Refactor safely with tests passing

**Avoid:**

- Skipping red-phase
- Large leaps in green-phase
- Mixing refactoring with new code
- Testing implementation details

## Design from Tests

Tests shape design:

- **Hard to test** - Design is likely poor
- **Simple to test** - Design is likely good
- **Tests are first client** - What would users need?
- **Dependencies come later** - Inject what you need

If tests are hard to write:

- Reconsider responsibilities
- Check for tight coupling
- Look for hidden assumptions
- Redesign, don't force tests

## Test organization

- **Organize by domain**, not type
- **Describe behavior**, not implementation
- **Mirror production structure** in test structure
- **Keep tests near code** - Same directory or `tests/` folder

## Mocking and Doubles

- **Mock external dependencies** - HTTP, databases, filesystems
- **Spy on behavior** - Track calls, arguments
- **Stub returns** - Controlled, predictable responses
- **Test real units** - Don't mock the code under test

## Refactoring discipline

Safe refactoring:

1. **Tests pass** (green phase)
2. **Make small changes** - Rename, extract, move
3. **Run tests after each change** - Catch mistakes immediately
4. **Revert if needed** - Git diff shows exactly what changed
5. **Commit** - Before next feature

## Emerging architecture

Don't design upfront:

- **Let tests guide structure** - What's natural to test?
- **Refactor to patterns** - Not into patterns
- **DRY emerges** - Through refactoring
- **Boundaries become clear** - Through mocking and testing

## Common TDD mistakes

- **Writing all tests first** - Defeats incremental design
- **Tests too large** - Hard to diagnose failures
- **Testing implementation** - Should test behavior only
- **Skipping refactor** - Code gets messy
- **Mocking too much** - Lose integration coverage
- **Stubborn design** - Refactor when tests make it hard

## Integration with Team

- **Code review tests** - Are they good tests?
- **Pair on hard problems** - TDD with a partner
- **Review design** - Emerging from tests
- **Retrospective** - What could be simpler?
