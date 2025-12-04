---
id: "multi-file-rules/architecture"
version: "1.0.0"
summary: "Architecture guidelines for system design and module organization"
---

# Architecture Guidelines

## System Design Principles

Follow these core principles when designing system architecture:

1. **Separation of Concerns**: Keep business logic, data access, and presentation layers distinct
2. **Dependency Injection**: Use DI for loose coupling and testability
3. **Single Responsibility**: Each module should have one reason to change
4. **Interface Segregation**: Prefer small, focused interfaces over large ones

## Module Organization

Organize code into clear, logical modules:

```
src/
├── domain/       # Business logic and entities
├── application/  # Use cases and application services
├── infrastructure/ # External dependencies (DB, APIs)
└── presentation/  # UI and API controllers
```

## API Design

When designing APIs:

- Use RESTful conventions for HTTP APIs
- Version APIs from the start (`/api/v1/`)
- Return consistent error formats
- Document with OpenAPI/Swagger

## Database Schema

- Use migrations for all schema changes
- Index foreign keys and frequently queried columns
- Normalize to 3NF, denormalize only when necessary
- Document schema decisions in migration comments

## Microservices Guidelines

If using microservices:

- Each service owns its data
- Communicate via well-defined APIs
- Use event-driven patterns for async operations
- Implement circuit breakers and retries
