---
id: "large-rules/security-auth"
version: "1.0.0"
spec_version: "1"
summary: "Authentication, authorization, and security best practices"
---

# Security and Authentication

## Password Security

Handle passwords securely:

- Never store passwords in plain text
- Use bcrypt, scrypt, or Argon2 for hashing
- Use appropriate cost factor (10-12 for bcrypt)
- Implement password strength requirements
- Prevent password reuse
- Support password reset securely
- Rate limit password attempts
- Never log passwords

## JWT Tokens

Implement JWT securely:

- Sign tokens with strong secret
- Set appropriate expiration times (15-30 min for access tokens)
- Use refresh tokens for long-lived sessions
- Store tokens securely (httpOnly cookies)
- Validate token signature and expiration
- Include minimal claims in tokens
- Implement token revocation if needed
- Rotate signing keys periodically

## Session Management

Manage sessions securely:

- Generate cryptographically random session IDs
- Set secure and httpOnly flags on cookies
- Implement session timeout
- Regenerate session ID after login
- Clear sessions on logout
- Store sessions securely (Redis, database)
- Implement concurrent session limits

## OAuth and Social Login

Implement OAuth securely:

- Validate redirect URIs
- Use state parameter to prevent CSRF
- Validate OAuth tokens
- Store OAuth tokens securely
- Handle token refresh
- Implement proper scopes
- Validate user data from providers

## Authorization

Implement role-based access control:

- Define clear roles and permissions
- Check permissions at every protected endpoint
- Use middleware for authorization
- Implement least privilege principle
- Log authorization failures
- Test authorization logic thoroughly
- Document permission requirements

## Input Validation

Validate all inputs:

- Validate on server side (never trust client)
- Use schema validation (Zod, Joi, etc.)
- Sanitize inputs to prevent injection
- Validate file uploads (type, size, content)
- Implement rate limiting
- Reject unexpected fields
- Return clear validation errors

## SQL Injection Prevention

Prevent SQL injection:

- Use parameterized queries always
- Never concatenate user input into SQL
- Use ORM with proper escaping
- Validate and sanitize inputs
- Use least privilege database accounts
- Log suspicious query patterns

## XSS Prevention

Prevent cross-site scripting:

- Escape output in templates
- Use Content Security Policy headers
- Sanitize HTML input
- Use framework's built-in escaping
- Validate URLs before redirects
- Set X-XSS-Protection header

## CSRF Protection

Prevent cross-site request forgery:

- Use CSRF tokens for state-changing operations
- Validate CSRF tokens on server
- Use SameSite cookie attribute
- Validate Origin/Referer headers
- Don't use GET for state changes

## API Security

Secure API endpoints:

- Use HTTPS everywhere
- Implement rate limiting
- Validate API keys/tokens
- Use API versioning
- Implement request signing for sensitive operations
- Log API access
- Monitor for abuse patterns
- Implement IP whitelisting when appropriate

## Secrets Management

Handle secrets securely:

- Never commit secrets to git
- Use environment variables
- Use secret management services (AWS Secrets Manager, Vault)
- Rotate secrets regularly
- Encrypt secrets at rest
- Limit access to secrets
- Audit secret access
- Use different secrets per environment

## Security Headers

Set security headers:

- Content-Security-Policy
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security
- Referrer-Policy
- Permissions-Policy

## Dependency Security

Manage dependencies securely:

- Keep dependencies up to date
- Run security audits regularly (npm audit, snyk)
- Review dependency licenses
- Pin dependency versions
- Use lock files
- Monitor for vulnerabilities
- Have a patching process
