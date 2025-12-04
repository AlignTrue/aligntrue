---
id: "multi-file-rules/security"
version: "1.0.0"
summary: "Security best practices for authentication, authorization, and data protection"
---

# Security Best Practices

## Authentication and Authorization

- Use OAuth 2.0 or OpenID Connect for authentication
- Implement role-based access control (RBAC)
- Never store passwords in plain text - use bcrypt or Argon2
- Rotate API keys and secrets regularly

## Input Validation

- Validate all user input on the server side
- Use parameterized queries to prevent SQL injection
- Sanitize HTML input to prevent XSS attacks
- Implement rate limiting on public endpoints

## Data Protection

- Encrypt sensitive data at rest using AES-256
- Use TLS 1.3 for data in transit
- Implement proper key management (use KMS)
- Follow GDPR/CCPA requirements for user data

## Secrets Management

- Never commit secrets to version control
- Use environment variables or secret management services
- Rotate secrets on a regular schedule
- Audit secret access logs

## Security Headers

Always include these HTTP security headers:

```
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000
```

## Dependency Security

- Run `npm audit` or equivalent regularly
- Keep dependencies up to date
- Use Dependabot or Renovate for automated updates
- Review security advisories for your stack
