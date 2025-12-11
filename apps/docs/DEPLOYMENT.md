# Deployment guide

This guide covers deploying the AlignTrue documentation site to Vercel.

## Architecture

Two Vercel projects:

- `apps/web` → **aligntrue.ai** (marketing + catalog). It proxies `/docs/*` to the docs site via rewrite.
- `apps/docs` → **docs.aligntrue.ai** (documentation). Serves `/` and `/docs/*`, plus `/sitemap.xml` and `/robots.txt`.

## Vercel Project Configuration

### Project Settings

In Vercel Dashboard → Project Settings for the **docs** project:

1. **Root Directory**: `apps/docs`
2. **Framework Preset**: Next.js
3. **Build Command**: `pnpm build` (from vercel.json)
4. **Install Command**: `pnpm install` (from vercel.json)

### Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

#### Production

```
NEXT_PUBLIC_SITE_URL=https://aligntrue.ai
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX  # Optional, for Google Analytics
```

#### Preview

```
NEXT_PUBLIC_SITE_URL=https://your-preview-url.vercel.app
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX  # Optional
```

## Deployment Commands

### Option 1: Deploy from apps/docs (Recommended)

```bash
cd apps/docs
vercel --prod
```

### Option 2: Deploy from repo root with explicit path

```bash
vercel --prod --cwd apps/docs
```

### First-time Setup

```bash
cd apps/docs
vercel link
# Select your team/account
# Select the website-docs project
# Confirm root directory
```

## Pre-Deploy Checklist (docs project)

```bash
# 1. Build locally
cd apps/docs
pnpm build

# 2. Serve the static export locally
# (Next.js output is static; use any static file server)
pnpm dlx serve@latest out -l 3000

# 3. Verify docs respond
curl -I http://localhost:3000/docs

# 4. Verify sitemap includes docs
curl http://localhost:3000/sitemap.xml | head -30

# 5. Verify robots.txt
curl http://localhost:3000/robots.txt
```

## Post-Deploy Verification

```bash
# 1. Docs domain responds
curl -I https://docs.aligntrue.ai

# 2. Docs section loads
curl -I https://docs.aligntrue.ai/docs

# 3. Sitemap is accessible and includes docs
curl https://docs.aligntrue.ai/sitemap.xml | grep -E "<loc>|</loc>" | head -20

# 4. Robots.txt points to sitemap
curl https://docs.aligntrue.ai/robots.txt

# 5. Security headers are present
curl -I https://docs.aligntrue.ai | grep -E "X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security"

# 6. Assets are accessible
curl -I https://docs.aligntrue.ai/aligntrue-og-image.png
curl -I https://docs.aligntrue.ai/favicon.ico
```

## Security Headers

The site includes the following security headers (configured in `vercel.json`):

- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME-type sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer information
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` - Enforces HTTPS

## Troubleshooting

### Build fails with "Module not found"

- Ensure you're running from `apps/docs` or using `--cwd apps/docs`
- Verify `pnpm install` completed successfully
- Check that `@aligntrue/ui` is in workspace dependencies

### Sitemap doesn't include homepage

- Verify `NEXT_PUBLIC_SITE_URL` is set in Vercel environment variables
- Check that `content/index.mdx` exists
- Review `lib/docs-routes.ts` logic

### Security headers not applied

- Verify `vercel.json` is in `apps/docs/` directory
- Check Vercel project root directory is set to `apps/docs`
- Redeploy after vercel.json changes

### Assets (favicon, og-image) not found

- Verify files exist in `apps/docs/public/`
- Check file names match exactly: `aligntrue-og-image.png`, `favicon.ico`
- Clear browser cache and test in incognito mode

## Migration Notes

This repo now runs two active apps:

- `apps/web` serves the marketing site and catalog at `aligntrue.ai` and rewrites `/docs/*` to `docs.aligntrue.ai`.
- `apps/docs` serves documentation at `docs.aligntrue.ai` with `/docs/*`, `/sitemap.xml`, and `/robots.txt`.

## Related Files

- `vercel.json` - Deployment configuration
- `next.config.mjs` - Next.js configuration
- `app/layout.tsx` - Root layout with metadata and analytics
- `app/page.tsx` - Homepage component
- `app/docs/layout.tsx` - Docs layout with Nextra
- `app/sitemap.xml/route.ts` - Sitemap generator
- `app/robots.txt/route.ts` - Robots.txt generator
