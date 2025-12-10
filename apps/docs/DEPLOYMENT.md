# Deployment guide

This guide covers deploying the AlignTrue documentation site to Vercel.

## Architecture

The site is a unified static-export Next.js application with:

- **Root route** at `/` that client-redirects to `/docs` (no separate marketing landing page)
- **Documentation** at `/docs/*`
- **Sitemap** at `/sitemap.xml` (lists docs and the root redirect entry)
- **Robots.txt** at `/robots.txt`

## Vercel Project Configuration

### Project Settings

In Vercel Dashboard → Project Settings:

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

## Pre-Deploy Checklist

```bash
# 1. Build locally
cd apps/docs
pnpm build

# 2. Serve the static export locally
# (Next.js output is static; use any static file server)
pnpm dlx serve@latest out -l 3000
# Visit http://localhost:3000 (should redirect you to /docs)

# 3. Verify root redirect renders the fallback link to /docs
curl -s http://localhost:3000 | head -20

# 4. Verify docs section responds
curl -I http://localhost:3000/docs

# 5. Verify sitemap includes docs and the root entry
curl http://localhost:3000/sitemap.xml | head -30

# 6. Verify robots.txt
curl http://localhost:3000/robots.txt
```

## Post-Deploy Verification

```bash
# 1. Root responds and shows redirect copy (JS redirect)
curl -s https://aligntrue.ai | head -20

# 2. Docs section loads
curl -I https://aligntrue.ai/docs

# 3. Sitemap is accessible and includes both the root entry and docs
curl https://aligntrue.ai/sitemap.xml | grep -E "<loc>|</loc>" | head -20

# 4. Robots.txt points to sitemap
curl https://aligntrue.ai/robots.txt

# 5. Security headers are present
curl -I https://aligntrue.ai | grep -E "X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security"

# 6. Assets are accessible
curl -I https://aligntrue.ai/aligntrue-og-image.png
curl -I https://aligntrue.ai/favicon.ico
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

This site was previously split into separate catalog and docs apps. As of the current architecture:

- ✅ Unified single Next.js app at `apps/docs`
- ✅ Root route at `/` redirects to `/docs`
- ✅ Documentation at `/docs/*` with Nextra
- ✅ Single sitemap at `/sitemap.xml`
- ✅ No rewrites or middleware needed
- ❌ No separate catalog app (archived to `archive/apps-web/`)

## Related Files

- `vercel.json` - Deployment configuration
- `next.config.mjs` - Next.js configuration
- `app/layout.tsx` - Root layout with metadata and analytics
- `app/page.tsx` - Homepage component
- `app/docs/layout.tsx` - Docs layout with Nextra
- `app/sitemap.xml/route.ts` - Sitemap generator
- `app/robots.txt/route.ts` - Robots.txt generator
