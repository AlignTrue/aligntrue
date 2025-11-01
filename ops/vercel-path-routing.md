# Vercel Path Routing Configuration

Path-based routing required for sitemap federation across web and docs apps.

## Required Rewrites

The following paths must route to the docs project:

- `/docs/**` → docs project
- `/sitemap.docs.xml` → docs project

All other paths route to the web project by default.

## Environment Variables

Both projects require:

```
NEXT_PUBLIC_SITE_URL=https://aligntrue.ai
```

Set this in Vercel project settings for both:

- `aligntrue-web` (or equivalent web project name)
- `aligntrue-docs` (or equivalent docs project name)

## Verification

After deployment, verify:

```bash
# Index should list both sub-sitemaps
curl https://aligntrue.ai/sitemap.xml

# Main sitemap (web project)
curl https://aligntrue.ai/sitemap.main.xml

# Docs sitemap (docs project, rewritten from /sitemap.docs.xml)
curl https://aligntrue.ai/sitemap.docs.xml

# Robots.txt should reference sitemap.xml
curl https://aligntrue.ai/robots.txt
```

## Current Configuration

See `apps/web/vercel.json` for the current rewrite rules.
