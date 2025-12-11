---
id: "large-rules/backend-api"
version: "1.0.0"
spec_version: "1"
summary: "Backend API development patterns and best practices"
---

# Backend API Development

## RESTful API Design

Follow REST principles for API endpoints:

- Use nouns for resources, not verbs
- HTTP methods map to CRUD: GET (read), POST (create), PUT/PATCH (update), DELETE (delete)
- Use plural nouns for collections: `/users`, `/products`
- Use path parameters for resource IDs: `/users/123`
- Use query parameters for filtering and pagination: `/users?role=admin&page=2`

## Request validation

Validate all incoming requests:

- Validate request body against schema (use Zod, Joi, or similar)
- Check required fields are present
- Validate data types and formats
- Enforce length limits on strings
- Sanitize inputs to prevent injection attacks
- Return 400 Bad Request with detailed error messages for validation failures

Example validation error response:

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "email", "message": "Must be a valid email address" },
    { "field": "age", "message": "Must be a number between 0 and 120" }
  ]
}
```

## Error handling

Implement consistent error handling:

- Use standard HTTP status codes appropriately
- Return error responses in consistent format
- Include error codes for client-side handling
- Log errors with context (request ID, user ID, timestamp)
- Never expose stack traces or internal details to clients
- Use custom error classes for different error types

Status code guidelines:

- 200: Success
- 201: Resource created
- 204: Success with no content
- 400: Client error (bad request)
- 401: Unauthenticated
- 403: Unauthorized (authenticated but no permission)
- 404: Resource not found
- 409: Conflict (e.g., duplicate resource)
- 422: Unprocessable entity (semantic errors)
- 500: Server error

## Response formatting

Use consistent response formats:

- Wrap data in a `data` field for successful responses
- Include metadata when relevant (pagination, timestamps)
- Use camelCase for JSON keys
- Return null for missing optional fields, omit undefined fields
- Include resource links for HATEOAS when appropriate

Success response example:

```json
{
  "data": {
    "id": "123",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "meta": {
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

## Pagination

Implement pagination for list endpoints:

- Use limit/offset or cursor-based pagination
- Include pagination metadata in response
- Default to reasonable page size (e.g., 20-50 items)
- Allow clients to specify page size within limits
- Return total count when feasible

Pagination response:

```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "perPage": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": true
  }
}
```

## Authentication

Implement secure authentication:

- Use JWT tokens or session-based auth
- Store tokens securely (httpOnly cookies or secure storage)
- Implement token refresh mechanism
- Set appropriate token expiration times
- Validate tokens on every protected endpoint
- Use middleware for authentication checks

## Authorization

Implement role-based access control:

- Define clear roles and permissions
- Check permissions at the route level
- Use middleware for authorization checks
- Return 403 Forbidden for unauthorized access
- Log authorization failures for security monitoring
- Implement least privilege principle

## Rate limiting

Protect APIs with rate limiting:

- Implement per-user or per-IP rate limits
- Use sliding window or token bucket algorithms
- Return 429 Too Many Requests when limit exceeded
- Include rate limit headers in responses (X-RateLimit-Limit, X-RateLimit-Remaining)
- Allow different limits for different endpoints
- Whitelist internal services from rate limits

## API Versioning

Version your APIs for backward compatibility:

- Use URL versioning: `/api/v1/users`, `/api/v2/users`
- Maintain old versions during deprecation period
- Document breaking changes clearly
- Provide migration guides for version upgrades
- Use semantic versioning for API versions
- Announce deprecations well in advance

## Logging and Monitoring

Implement comprehensive logging:

- Log all requests with request ID, method, path, status, duration
- Log errors with full context and stack traces
- Use structured logging (JSON format)
- Include correlation IDs for distributed tracing
- Set up alerts for error rate spikes
- Monitor API performance metrics (latency, throughput)

## Database queries

Optimize database interactions:

- Use connection pooling
- Implement query timeouts
- Use indexes for frequently queried fields
- Avoid N+1 queries (use eager loading)
- Paginate large result sets
- Use read replicas for read-heavy workloads
- Cache frequently accessed data

## Async operations

Handle long-running operations properly:

- Return 202 Accepted for async operations
- Provide status endpoint to check operation progress
- Use job queues for background processing
- Implement idempotency for retry safety
- Set reasonable timeouts
- Provide webhooks or polling for completion notification

## Testing

Test API endpoints thoroughly:

- Write integration tests for all endpoints
- Test happy paths and error cases
- Test authentication and authorization
- Test rate limiting behavior
- Test with invalid inputs
- Use test fixtures for consistent data
- Mock external dependencies

## Documentation

Document APIs comprehensively:

- Use OpenAPI/Swagger specification
- Document all endpoints, parameters, and responses
- Provide example requests and responses
- Document error codes and their meanings
- Keep documentation in sync with code
- Generate interactive API documentation
