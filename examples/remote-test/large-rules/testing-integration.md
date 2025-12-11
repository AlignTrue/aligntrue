---
id: "large-rules/testing-integration"
version: "1.0.0"
spec_version: "1"
summary: "Integration testing patterns and best practices"
---

# Integration testing

## Test structure

Organize integration tests:

- Place in `tests/integration/` directory
- Name files descriptively: `user-registration.test.ts`
- Group related tests with describe blocks
- Use beforeEach/afterEach for setup/teardown
- Keep tests independent and isolated
- Run tests in parallel when possible

## Test database

Manage test database properly:

- Use separate database for testing
- Reset database between tests
- Use transactions that rollback
- Seed test data consistently
- Use factories for test data creation
- Clean up after tests complete
- Never run tests against production database

## API Testing

Test API endpoints thoroughly:

- Test happy paths and error cases
- Test authentication and authorization
- Test input validation
- Test rate limiting
- Test with various content types
- Verify response status codes and bodies
- Test pagination and filtering
- Use supertest or similar for HTTP testing

Example:

```typescript
describe("POST /api/users", () => {
  it("creates user with valid data", async () => {
    const response = await request(app)
      .post("/api/users")
      .send({ email: "test@example.com", name: "Test User" })
      .expect(201);

    expect(response.body.data).toHaveProperty("id");
    expect(response.body.data.email).toBe("test@example.com");
  });

  it("returns 400 with invalid email", async () => {
    await request(app)
      .post("/api/users")
      .send({ email: "invalid", name: "Test User" })
      .expect(400);
  });
});
```

## Mocking external services

Mock external dependencies:

- Mock HTTP clients for external APIs
- Use nock or msw for HTTP mocking
- Mock email/SMS services
- Mock payment gateways
- Mock file storage services
- Keep mocks realistic
- Update mocks when external APIs change
- Document mock behavior

## Test fixtures

Create reusable test fixtures:

- Use factory functions for test data
- Keep fixtures minimal and focused
- Use realistic data
- Avoid hardcoded IDs
- Make fixtures composable
- Store fixtures near tests that use them

Example factory:

```typescript
export function createUser(overrides = {}) {
  return {
    email: "test@example.com",
    name: "Test User",
    role: "user",
    ...overrides,
  };
}
```

## Async testing

Handle async operations properly:

- Use async/await in tests
- Set appropriate timeouts
- Wait for operations to complete
- Don't use arbitrary delays
- Test timeout scenarios
- Handle promise rejections

## Error testing

Test error scenarios:

- Test validation errors
- Test database errors
- Test network failures
- Test timeout scenarios
- Test concurrent operations
- Test edge cases
- Verify error messages and codes

## Test coverage

Maintain good test coverage:

- Aim for 70-80% coverage
- Focus on critical paths
- Test business logic thoroughly
- Don't test framework code
- Use coverage reports to find gaps
- Don't chase 100% coverage blindly

## CI Integration

Run tests in CI pipeline:

- Run on every pull request
- Fail build on test failures
- Run tests in parallel for speed
- Use test containers for dependencies
- Cache dependencies
- Report test results
- Track test execution time
