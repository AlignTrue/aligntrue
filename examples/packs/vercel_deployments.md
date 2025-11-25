---
id: "packs/stacks/vercel-deployments"
version: "1.0.0"
summary: "Vercel deployment best practices: environment management, performance, reliability"
tags: ["vercel", "deployment", "nextjs", "paved-road"]
---

# Vercel deployment guide

Best practices for deploying Next.js apps on Vercel: environment management, performance optimization, and reliability.

## Environment configuration

**Three tiers:**

- **Development** - Local `vercel dev` and preview environment
- **Preview** - Ephemeral previews on each PR
- **Production** - Main branch deployment

Secrets management:

- Server-only secrets - No prefix, stored as JSON
- Client-visible - Prefix with `NEXT_PUBLIC_`
- Pull locally - `vercel env pull .env.local`

**Never hardcode secrets:**

```javascript
// ❌ Bad
const API_KEY = "sk-1234567890";

// ✅ Good
const API_KEY = process.env.API_KEY;
```

## Build optimization

**Output format:**

- Set `output: "standalone"` for smaller deployments
- Enable compression in next.config.js
- Analyze bundle size with `@next/bundle-analyzer`

**Build settings:**

- Region: Closest to users
- Node version: Latest LTS
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build`
- Output directory: `.next`

## Environment variables

**Tier strategy:**

```
NEXT_PUBLIC_API_URL=https://api.example.com   # All tiers
API_KEY=sk-xxx                                  # Server-only
DATABASE_URL=postgres://...                     # Server-only
```

**Hierarchy:**

1. Environment tier settings
2. Project-level secrets
3. Team-level secrets
4. Local `.env.local` (not committed)

## Performance optimization

**Core Web Vitals targets:**

- **LCP** ≤ 2.5s - Largest paint
- **INP** ≤ 200ms - Interaction response
- **CLS** ≤ 0.1 - Layout shift
- **TTFB** ≤ 800ms - Time to first byte

**Vercel tools:**

- **Analytics** - Real user metrics
- **Web Vitals** - Field data
- **Lighthouse** - Lab data in CI

**Optimization:**

- Preload critical resources
- Image optimization with `next/image`
- Code splitting and lazy loading
- Cache headers strategy

## ISR and Revalidation

**Incremental Static Regeneration:**

```typescript
export const revalidate = 3600; // 1 hour
```

**On-demand revalidation:**

```typescript
import { revalidatePath } from "next/cache";

export async function updatePost(id: string) {
  // ... update data ...
  revalidatePath(`/posts/${id}`);
}
```

## Error handling and monitoring

**Error page:**

- Create `app/error.tsx` for error UI
- Log errors for debugging
- User-friendly messages

**Monitoring:**

- Error reporting (Sentry, etc.)
- Performance monitoring
- Uptime monitoring
- Log aggregation

## Deployment workflow

**GitHub integration:**

- Auto-deploy main branch to production
- Preview on every PR
- Preview URL in PR comment
- Rollback by redeploying previous commit

**Pre-deployment checks:**

- Tests pass
- Linting clean
- Build succeeds
- Performance budgets met

## Secrets rotation

**Schedule:**

- Rotate API keys quarterly
- Database passwords annually
- OAuth secrets on compromise

**Deployment:**

- Update secret in Vercel dashboard
- Redeploy without code change
- Verify new secret works

## Zero-Downtime Deploys

- Vercel handles automatic rollback on build failure
- Keep database migrations backward compatible
- Use feature flags for risky changes
- Blue-green deploys for staged rollout

## Common issues

**Build timeout:**

- Reduce build dependencies
- Optimize images before build
- Use `skipLibCheck` in tsconfig

**Large function:**

- Split into multiple functions
- Use separate APIs for heavy logic
- Consider edge functions for lightweight tasks

**Cold starts:**

- Keep function sizes small
- Preload dependencies
- Use connection pooling
