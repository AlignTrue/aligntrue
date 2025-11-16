---
id: "large-rules/devops-ci"
version: "1.0.0"
spec_version: "1"
summary: "CI/CD pipelines, deployment, and monitoring"
---

# DevOps and CI/CD

## CI Pipeline

Structure CI pipelines effectively:

- Run on every pull request
- Run linting and formatting checks
- Run all tests (unit, integration, e2e)
- Build application
- Run security scans
- Generate test coverage reports
- Fail fast on errors
- Cache dependencies for speed
- Run jobs in parallel when possible

## Deployment Strategy

Choose appropriate deployment strategy:

- Blue-green deployment for zero downtime
- Canary deployments for gradual rollout
- Rolling deployments for incremental updates
- Feature flags for controlled releases
- Automate deployment process
- Test deployments in staging first
- Have rollback plan ready
- Document deployment procedures

## Environment Management

Manage environments properly:

- Maintain separate dev, staging, production environments
- Use infrastructure as code (Terraform, CloudFormation)
- Keep environments in sync
- Use environment-specific configurations
- Never test in production
- Limit production access
- Document environment differences

## Container Best Practices

Use containers effectively:

- Use official base images
- Keep images small (multi-stage builds)
- Don't run as root user
- Pin image versions
- Scan images for vulnerabilities
- Use .dockerignore
- Cache layers appropriately
- Document Dockerfile

Example Dockerfile:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER node
CMD ["node", "dist/index.js"]
```

## Infrastructure as Code

Manage infrastructure with code:

- Version control all infrastructure code
- Use declarative configuration
- Test infrastructure changes
- Review infrastructure changes like code
- Use modules for reusability
- Document infrastructure decisions
- Implement least privilege access
- Tag resources appropriately

## Monitoring

Implement comprehensive monitoring:

- Monitor application metrics (latency, throughput, errors)
- Monitor infrastructure metrics (CPU, memory, disk, network)
- Set up alerts for anomalies
- Use distributed tracing
- Log aggregation and analysis
- Monitor business metrics
- Create dashboards for visibility
- Test alerting system

## Logging

Implement structured logging:

- Use JSON format for logs
- Include context (request ID, user ID, timestamp)
- Log at appropriate levels (debug, info, warn, error)
- Don't log sensitive data
- Centralize logs (ELK, CloudWatch, Datadog)
- Set up log retention policies
- Make logs searchable
- Use correlation IDs for tracing

## Secrets Management

Handle secrets in CI/CD:

- Use CI/CD secret management (GitHub Secrets, GitLab CI/CD variables)
- Never commit secrets to git
- Rotate secrets regularly
- Use different secrets per environment
- Limit access to secrets
- Audit secret usage
- Encrypt secrets at rest

## Performance Testing

Test performance regularly:

- Run load tests before releases
- Test under realistic conditions
- Identify bottlenecks
- Set performance budgets
- Monitor performance trends
- Test scalability
- Document performance requirements

## Disaster Recovery

Plan for disasters:

- Document recovery procedures
- Test backup restoration regularly
- Maintain runbooks for incidents
- Have rollback procedures ready
- Practice incident response
- Keep contact list updated
- Post-mortem after incidents
- Learn from failures

## Security Scanning

Scan for vulnerabilities:

- Scan dependencies (npm audit, Snyk)
- Scan container images
- Run SAST tools
- Run DAST tools
- Scan for secrets in code
- Monitor for CVEs
- Have patching process
- Track security metrics
