# Development Server Ports

AlignTrue uses two Next.js applications with fixed port assignments to prevent conflicts.

## Port Assignments

- **Port 3000**: Catalog website (`apps/web`)
- **Port 3001**: Documentation site (`apps/docs`)

## Running Development Servers

### Individual Apps

```bash
# Run catalog website only (port 3000)
pnpm dev:web

# Run docs site only (port 3001)
pnpm dev:docs
```

### Both Apps Simultaneously

```bash
# Run both apps at the same time
pnpm dev:all
```

This will start:

- Catalog at http://localhost:3000
- Docs at http://localhost:3001

## Production

The docs site is served via Vercel path rewrites from the main domain:

- Production: https://aligntrue.com → catalog (apps/web)
- Production: https://aligntrue.com/docs → documentation (apps/docs)

## Troubleshooting

If you see "Address already in use" errors:

```bash
# Check what's using port 3000 or 3001
lsof -i :3000
lsof -i :3001

# Kill all Next.js processes
pkill -f "next-server"
```

## Why Fixed Ports?

Fixed port assignments prevent:

- Accidental port conflicts between apps
- Confusion about which app is running
- Issues with Vercel local testing and path rewrites
- Port drift when running multiple dev sessions
