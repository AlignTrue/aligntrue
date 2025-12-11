---
id: "large-rules/documentation"
version: "1.0.0"
spec_version: "1"
summary: "Documentation standards for APIs, code, and architecture"
---

# Documentation standards

## README Requirements

Every project needs a good README:

- Project name and description
- Prerequisites and requirements
- Installation instructions
- Quick start guide
- Configuration options
- Usage examples
- API documentation link
- Contributing guidelines
- License information
- Contact/support information

## API Documentation

Document APIs comprehensively:

- Use OpenAPI/Swagger specification
- Document all endpoints
- Include request/response examples
- Document authentication requirements
- List all parameters and their types
- Document error codes and messages
- Provide example API calls
- Keep documentation in sync with code
- Generate interactive documentation

Example endpoint documentation:

```yaml
/api/users/{id}:
  get:
    summary: Get user by ID
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: string
    responses:
      200:
        description: User found
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/User"
      404:
        description: User not found
```

## Code comments

Write helpful code comments:

- Explain "why" not "what"
- Document complex algorithms
- Explain non-obvious decisions
- Add TODOs with context
- Use JSDoc for functions
- Keep comments up to date
- Remove obsolete comments
- Don't comment obvious code

Good comment:

```typescript
// Use exponential backoff to avoid overwhelming the API
// during temporary outages
const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
```

## Architecture documentation

Document system architecture:

- Create architecture diagrams
- Document key design decisions
- Explain system components
- Document data flow
- Describe integration points
- Document deployment architecture
- Explain technology choices
- Keep diagrams up to date

## ADRs (Architecture Decision Records)

Record important decisions:

- Use ADR template
- Document context and problem
- List considered options
- Explain chosen solution
- Note consequences
- Date and author decisions
- Store in version control
- Reference in code when relevant

ADR template:

```markdown
# ADR-001: Use PostgreSQL for primary database

## Status

Accepted

## Context

Need to choose database for user data storage

## Decision

Use PostgreSQL

## Consequences

- Pros: ACID compliance, rich query features
- Cons: Requires more ops expertise than NoSQL
```

## Inline documentation

Document code inline:

- Use JSDoc for TypeScript/JavaScript
- Document function parameters and return types
- Explain complex type definitions
- Document class properties
- Add examples for complex APIs
- Generate documentation from code
- Keep inline docs synchronized

Example:

```typescript
/**
 * Calculates compound interest
 * @param principal - Initial investment amount
 * @param rate - Annual interest rate (as decimal, e.g., 0.05 for 5%)
 * @param years - Number of years
 * @returns Final amount after compound interest
 * @example
 * calculateCompoundInterest(1000, 0.05, 10) // Returns 1628.89
 */
function calculateCompoundInterest(
  principal: number,
  rate: number,
  years: number,
): number {
  return principal * Math.pow(1 + rate, years);
}
```

## Changelog

Maintain a changelog:

- Follow Keep a Changelog format
- Document all notable changes
- Group by version
- Include date of release
- Categorize changes (Added, Changed, Fixed, etc.)
- Link to issues/PRs
- Write for users, not developers

## Runbooks

Create operational runbooks:

- Document common operations
- Include troubleshooting steps
- List required access/permissions
- Provide example commands
- Document rollback procedures
- Include contact information
- Test runbooks regularly
- Keep updated

## Migration guides

Document breaking changes:

- Explain what changed and why
- Provide before/after examples
- List migration steps
- Estimate migration effort
- Provide migration scripts when possible
- Announce well in advance
- Support old version during transition

## Troubleshooting guide

Help users solve problems:

- List common issues
- Provide solutions
- Include error messages
- Add diagnostic steps
- Link to related documentation
- Provide contact for help
- Update based on support tickets

## Contributing guide

Help contributors:

- Explain how to set up development environment
- Document coding standards
- Explain PR process
- List testing requirements
- Provide code of conduct
- Explain commit message format
- Link to issue tracker
