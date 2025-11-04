# Development Server Ports

AlignTrue uses a single Next.js application for both marketing and documentation.

## Port Assignments

- **Port 3000**: Documentation site with marketing homepage (`apps/docs`)

## Running Development Server

```bash
# Run docs site (port 3000)
pnpm dev
```

This will start the documentation site with the marketing homepage at http://localhost:3000

## Production

The docs site is deployed to Vercel and serves both marketing and documentation:

- Production: https://aligntrue.ai → marketing homepage
- Production: https://aligntrue.ai/docs → documentation

## Troubleshooting

If you see "Address already in use" errors:

```bash
# Check what's using port 3000
lsof -i :3000

# Kill all Next.js processes
pkill -f "next dev"
```

## Architecture

The single-app architecture provides:

- Simplified deployment (one Vercel project)
- Consistent styling across marketing and docs
- No rewrite proxy complexity
- Faster development iteration
- Easier maintenance

## Archived Apps

The catalog website (`apps/web`) was archived to `archive/apps-web` as part of pre-launch simplification. See `.cursor/rules/potential_future_features.mdc` for restoration triggers and approach.
