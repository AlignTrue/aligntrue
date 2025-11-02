# AlignTrue Web

Catalog website and marketing pages for AlignTrue.

## Environment Variables

Create `apps/web/.env.local` with:

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Production:** Set `NEXT_PUBLIC_SITE_URL=https://aligntrue.ai` in Vercel environment variables.

## Development

```bash
pnpm dev
```

### Development vs Production Behavior

**Docs Route (`/docs`):**

- **Development:** Returns 404 (expected behavior)
- **Production:** Proxies to `https://aligntrue-docs.vercel.app/docs/:path*`

**Why:** Next.js rewrites (configured in `next.config.ts` and `vercel.json`) don't resolve external URLs in development mode. This is standard Next.js behavior and doesn't affect production deployment.

To test docs integration locally, run the docs site separately:

```bash
pnpm dev:docs  # in separate terminal
# Then visit http://localhost:3001/docs
```

## Sitemaps

- `/sitemap.xml` - Sitemap index that points to:
  - `/sitemap.main.xml` (web)
  - `/sitemap.docs.xml` (docs project)
- `/robots.txt` - Advertises the sitemap index
- Requires `NEXT_PUBLIC_SITE_URL` to be set to the public origin

## Linting

```bash
pnpm lint          # Check for issues
pnpm lint:fix      # Auto-fix issues
```

## Testing

```bash
pnpm test          # Run all tests
pnpm test:watch    # Watch mode
```
