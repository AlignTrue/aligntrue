# Vercel path routing configuration

## Current architecture (two active apps)

- `apps/web` → `aligntrue.ai` (homepage + catalog demos)
  - Rewrites `/docs` and `/docs/*` to `https://docs.aligntrue.ai/docs`
  - Hosts short URL redirects (e.g., `/quickstart`, `/team`, `/agents`)
- `apps/docs` → `docs.aligntrue.ai` (documentation)
  - Redirects `/` → `/docs` on the docs domain

Each Vercel project reads its own `vercel.json` from its project root (`apps/web/vercel.json` and `apps/docs/vercel.json`). There is no root-level `vercel.json`.

## Environment variables

Docs project (`apps/docs`):

```
NEXT_PUBLIC_SITE_URL=https://aligntrue.ai
```

## Verification (post-deploy)

```bash
# Main site serves marketing
curl -I https://aligntrue.ai

# Docs rewrite from main domain
curl -I https://aligntrue.ai/docs

# Docs domain redirects to /docs
curl -I https://docs.aligntrue.ai

# Sitemaps
curl -I https://aligntrue.ai/sitemap.xml
curl -I https://docs.aligntrue.ai/sitemap.xml
```

## Historical note

Earlier revisions described a single-app deployment. We now run two Vercel projects (web + docs) with the web app handling rewrites and short URLs.
