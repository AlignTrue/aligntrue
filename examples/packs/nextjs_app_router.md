---
id: "packs/stacks/nextjs-app-router"
version: "1.0.0"
summary: "Best practices for Next.js App Router: server/client boundaries, caching, data fetching"
tags: ["nextjs", "react", "app-router", "paved-road"]
---

# Next.js App Router Guide

Best practices for Next.js App Router: server components by default, explicit caching strategies, validated server actions, and colocated route files.

## Core principles

1. **Server Components by default** - Only use Client Components for interactivity or browser APIs
2. **Client only for interaction** - useState, useEffect, useRef, browser APIs
3. **Validate at boundaries** - Cache reads, revalidate on writes
4. **Deterministic routing** - Metadata and routing determined at build time
5. **Keep files small** - Focused, easy-to-understand components

## File layout

File organization:

- Use `(group)` folders to organize routes logically
- Colocate `loading.tsx`, `error.tsx`, `not-found.tsx` near routes
- **No default exports** in `lib/` shared code
- Use named exports only in shared libraries

## Server components vs client components

**Default to Server Components:**

- Serve HTML directly
- Access databases and secrets safely
- Keep dependencies private
- Reduce JavaScript sent to browser

**Client Components only when you need:**

- `useState`, `useContext`, `useReducer`, `useCallback`
- `useEffect`, `useLayoutEffect`, `useRef`
- Browser APIs: localStorage, geolocation, etc.

**Pattern: Thin Client Wrapper**

Wrap Server Components with minimal Client logic.

## Data fetching and caching

Reads should be cacheable and explicit:

- **Cacheable reads**: Set `revalidate` or `fetchCache`
- **Dynamic-only when necessary**: Use `noStore()` for truly dynamic data
- **Revalidate after mutations**: Use `revalidateTag()` or `revalidatePath()`
- **Cache fetch by default**: `fetch()` is cached by default in Server Components

## Server actions for mutations

Server Actions require:

- **Validate inputs** with Zod or similar schema validation
- **Mutate**, then **revalidate** with tags or paths
- **Return small Result objects** - Errors as fields, not thrown
- **No long-running operations** - Keep to <30 seconds

## Error handling

- `error.tsx` - Client Component boundary handler
- `loading.tsx` - Suspense-like loading UI (doesn't fetch)
- `not-found.tsx` - 404 page component
- Use `throw notFound()` for 404s

## Metadata and SEO

- **Static metadata** when possible
- **generateMetadata()** for dynamic pages
- `next/font` for font optimization
- `next/image` for all images

## Common pitfalls

- Marking entire route trees with `'use client'`
- Forgetting to set `revalidate` or `fetchCache` on pages
- Default exports in `lib/` shared code
- Storing auth tokens in localStorage
- Not validating Server Action inputs
