# AlignTrue Documentation

Nextra-based documentation site for AlignTrue.

## Environment Variables

Create `apps/docs/.env.local` with:

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

**Production:** Set the following in Vercel environment variables:

- `NEXT_PUBLIC_SITE_URL=https://aligntrue.ai`
- `NEXT_PUBLIC_GA_ID=<your-google-analytics-4-id>` (optional, for analytics)

## Static Assets

The `apps/docs/public/` directory contains:

- `aligntrue-og-image.png` (1800x945) - Open Graph and Twitter card image
- `favicon.ico` - Site favicon

These assets are automatically served at the root path (e.g., `/aligntrue-og-image.png`, `/favicon.ico`).

## Analytics

The site includes:

- **Vercel Analytics** - Automatic, privacy-friendly analytics
- **Google Analytics 4** - Optional, enabled when `NEXT_PUBLIC_GA_ID` is set

## SEO Features

- Open Graph metadata for social media sharing
- Twitter card support
- Structured data (JSON-LD) for search engines
- Automatic sitemap generation
- robots.txt configuration

## Development

```bash
pnpm dev
```

## Sitemap

- `/sitemap.xml` - Unified sitemap including homepage (`/`) and all docs routes (`/docs/*`)
- Homepage is served at root (`/`), documentation at `/docs`
- Requires `NEXT_PUBLIC_SITE_URL` to be set to the public origin

## Testing

```bash
# Run all tests (includes link checker)
pnpm test

# Run standalone link checker from repo root
pnpm validate:docs-links
```

The test suite includes automated link validation that:

- Scans all `.md` and `.mdx` files in `content/`
- Validates internal `/docs/` links against actual file structure
- Reports broken links with file location and line number
- Runs automatically in CI

See `lib/check-links.ts` for the link validation module.
