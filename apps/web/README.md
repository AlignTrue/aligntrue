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

## Sitemaps

- `/sitemap.xml` - Sitemap index that points to:
  - `/sitemap.main.xml` (web)
  - `/sitemap.docs.xml` (docs project)
- `/robots.txt` - Advertises the sitemap index
- Requires `NEXT_PUBLIC_SITE_URL` to be set to the public origin

## Testing

```bash
pnpm test
```
