---
id: "large-rules/performance"
version: "1.0.0"
spec_version: "1"
summary: "Performance optimization, profiling, and caching strategies"
---

# Performance optimization

## Profiling first

Always profile before optimizing:

- Use profiling tools to identify bottlenecks
- Measure before and after changes
- Focus on hot paths
- Don't optimize prematurely
- Profile in production-like environment
- Use real data for profiling
- Document performance improvements
- Set performance budgets

## Algorithm complexity

Choose efficient algorithms:

- Understand Big O notation
- Prefer O(1) and O(log n) over O(n²)
- Use appropriate data structures
- Consider space-time tradeoffs
- Optimize critical paths first
- Use binary search over linear search
- Cache computed results
- Avoid nested loops when possible

## Database performance

Optimize database queries:

- Use indexes strategically
- Avoid N+1 queries
- Use connection pooling
- Implement query caching
- Paginate large result sets
- Use EXPLAIN to analyze queries
- Denormalize when necessary
- Use read replicas for read-heavy loads

## Caching strategies

Implement effective caching:

- Cache at multiple levels (CDN, application, database)
- Use appropriate cache invalidation strategy
- Set reasonable TTLs
- Cache expensive computations
- Use cache-aside pattern
- Monitor cache hit rates
- Handle cache failures gracefully
- Warm up caches proactively

Cache levels:

1. CDN: Static assets, API responses
2. Application: Computed values, database queries
3. Database: Query results
4. Browser: Static resources

## API Performance

Optimize API responses:

- Implement response compression (gzip, brotli)
- Use pagination for large datasets
- Implement field filtering (GraphQL, sparse fieldsets)
- Cache responses with appropriate headers
- Use HTTP/2 or HTTP/3
- Minimize response payload size
- Implement rate limiting
- Use connection keep-alive

## Frontend performance

Optimize frontend loading:

- Minimize bundle size
- Code split by route
- Lazy load components
- Optimize images (WebP, compression, responsive)
- Use CDN for static assets
- Implement service workers
- Preload critical resources
- Defer non-critical scripts

## Memory management

Manage memory efficiently:

- Avoid memory leaks
- Clean up event listeners
- Close database connections
- Clear intervals and timeouts
- Use weak references when appropriate
- Stream large files instead of loading into memory
- Monitor memory usage
- Profile memory allocation

## Concurrency

Handle concurrent operations:

- Use async/await for I/O operations
- Implement connection pooling
- Use worker threads for CPU-intensive tasks
- Avoid blocking the event loop
- Use queues for background jobs
- Implement backpressure
- Set appropriate timeouts
- Handle race conditions

## Asset optimization

Optimize static assets:

- Minify JavaScript and CSS
- Compress images
- Use modern image formats (WebP, AVIF)
- Implement responsive images
- Use SVG for icons
- Bundle and tree-shake dependencies
- Remove unused code
- Use content hashing for cache busting

## Monitoring performance

Track performance metrics:

- Monitor response times
- Track error rates
- Measure throughput
- Monitor resource usage (CPU, memory, disk)
- Set up performance alerts
- Use APM tools (New Relic, Datadog)
- Track Core Web Vitals for frontend
- Create performance dashboards

## Load testing

Test under load:

- Simulate realistic traffic patterns
- Test with production-like data volumes
- Identify breaking points
- Test autoscaling behavior
- Measure latency percentiles (p50, p95, p99)
- Test sustained load and spike scenarios
- Document performance benchmarks
- Test before major releases
