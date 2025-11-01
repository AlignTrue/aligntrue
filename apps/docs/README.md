# AlignTrue Documentation

Nextra-based documentation site for AlignTrue.

## Environment Variables

Create `apps/docs/.env.local` with:

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Production:** Set `NEXT_PUBLIC_SITE_URL=https://aligntrue.ai` in Vercel environment variables.

## Development

```bash
pnpm dev
```

## Sitemaps

- `/sitemap.docs.xml` - Lists all docs routes
- All paths are prefixed with `/docs` for public URLs
- Requires `NEXT_PUBLIC_SITE_URL` to be set to the public origin

## Testing

```bash
pnpm test
```
