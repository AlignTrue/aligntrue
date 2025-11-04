# Vercel Path Routing Configuration

## Current Architecture (Post-Catalog Archive)

The docs app is now the main and only site. No path routing or rewrites needed.

## Environment Variables

The docs project requires:

```
NEXT_PUBLIC_SITE_URL=https://aligntrue.ai
```

Set this in Vercel project settings for `aligntrue-docs`.

## Verification

After deployment, verify:

```bash
# Root sitemap includes homepage and all docs pages
curl https://aligntrue.ai/sitemap.xml

# Robots.txt should reference sitemap.xml
curl https://aligntrue.ai/robots.txt
```

## Sitemap Structure

- **`/sitemap.xml`**: Root sitemap containing homepage and all `/docs/**` pages
- **`/robots.txt`**: Points to `/sitemap.xml`

## Historical Note

Previously, this document described path routing between separate web and docs apps with federated sitemaps (`sitemap.main.xml`, `sitemap.docs.xml`, and a sitemap index). The catalog website has been archived to `archive/apps-web/` and the docs app now serves as the main website.
