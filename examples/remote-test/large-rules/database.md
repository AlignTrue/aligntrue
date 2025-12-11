---
id: "large-rules/database"
version: "1.0.0"
spec_version: "1"
summary: "Database design, migrations, and query optimization"
---

# Database best practices

## Schema design

Design database schemas carefully:

- Normalize to reduce redundancy (usually to 3NF)
- Denormalize strategically for performance
- Use appropriate data types for columns
- Define primary keys for all tables
- Use foreign keys to enforce referential integrity
- Add NOT NULL constraints where appropriate
- Use UNIQUE constraints for natural keys
- Document schema decisions

## Migrations

Manage schema changes with migrations:

- Use migration tools (Prisma, TypeORM, Knex, etc.)
- Make migrations reversible when possible
- Test migrations on staging before production
- Run migrations in transactions
- Keep migrations small and focused
- Never edit existing migrations
- Version control all migrations
- Document breaking changes

## Indexing

Create indexes strategically:

- Index foreign keys
- Index columns used in WHERE clauses
- Index columns used in ORDER BY
- Create composite indexes for multi-column queries
- Avoid over-indexing (impacts write performance)
- Monitor index usage and remove unused indexes
- Use EXPLAIN to analyze query plans
- Consider covering indexes for read-heavy queries

## Query optimization

Write efficient queries:

- Select only needed columns (avoid SELECT \*)
- Use WHERE clauses to filter early
- Avoid N+1 queries with joins or eager loading
- Use LIMIT for pagination
- Avoid complex calculations in WHERE clauses
- Use prepared statements to prevent SQL injection
- Profile slow queries and optimize
- Consider query caching for expensive queries

## Transactions

Use transactions appropriately:

- Wrap related operations in transactions
- Keep transactions short to avoid locks
- Use appropriate isolation levels
- Handle transaction rollbacks
- Avoid nested transactions
- Be aware of deadlock possibilities
- Use optimistic locking for concurrent updates
- Test transaction behavior under load

## Connection pooling

Manage database connections:

- Use connection pooling
- Configure pool size appropriately
- Set connection timeouts
- Handle connection errors gracefully
- Monitor connection pool metrics
- Close connections properly
- Avoid connection leaks

## Data integrity

Maintain data integrity:

- Use foreign key constraints
- Use check constraints for validation
- Use triggers sparingly and document them
- Implement soft deletes when needed
- Use database-level defaults
- Validate data at application level too
- Handle constraint violations gracefully

## Backup and Recovery

Implement backup strategy:

- Schedule regular automated backups
- Test backup restoration regularly
- Store backups securely and redundantly
- Document recovery procedures
- Use point-in-time recovery when available
- Monitor backup success/failure
- Retain backups according to policy

## Security

Secure database access:

- Use least privilege principle for database users
- Never use root/admin accounts in application
- Rotate database credentials regularly
- Use SSL/TLS for database connections
- Encrypt sensitive data at rest
- Audit database access logs
- Prevent SQL injection with parameterized queries
- Sanitize user inputs

## Performance monitoring

Monitor database performance:

- Track query execution times
- Monitor connection pool usage
- Watch for slow queries
- Monitor disk I/O and CPU usage
- Set up alerts for anomalies
- Use database profiling tools
- Analyze query patterns
- Optimize based on real usage data
