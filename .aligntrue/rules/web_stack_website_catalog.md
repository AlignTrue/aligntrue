---
description: Web stack guide for the homepage and catalog (auto-applies in apps/web/)
nested_location: apps/web
content_hash:
---

# Web stack guide for homepage/catalog

**Applies to:** `apps/web/` (marketing homepage + catalog)

Keep the site fast, accessible, and predictable. Use **vanilla shadcn/ui + Tailwind only**—no bespoke CSS, inline styles, or one-off class names that override shadcn defaults.

---

## Core principles

1. shadcn/ui + Tailwind utilities only. Do not add custom CSS, inline styles, or ad-hoc class names that override defaults. Favor utility classes and shadcn props.
2. Mobile-first, accessible by default. Maintain keyboard navigation and semantics.
3. Keep styling semantic: use shadcn color tokens (`primary`, `secondary`, `muted`, etc.). Do not hardcode hex values.
4. Prefer server components; add `"use client"` only when necessary.
5. Minimize surface area: reuse primitives, avoid new patterns unless justified.
6. If a layout issue appears, first use Tailwind spacing/grid/flex or shadcn variants. Do not hide scrollbars or add backdrop/blur/shadow tweaks beyond shadcn defaults.

---

## Tech stack

- Next.js 16 (App Router), React 19
- shadcn/ui (style: new-york) with Radix primitives and `class-variance-authority`
- Tailwind CSS with CSS variables (`tailwind.config.js`, `app/globals.css`)
- `next-themes` for dark mode (class strategy)
- `lucide-react` icons, `next/font` for Plus Jakarta Sans + JetBrains Mono

---

## Project layout (apps/web)

- `app/` — layouts, pages, and route handlers (`app/api/**`)
- `components/` — shared marketing/catalog components
- `components/ui/` — shadcn primitives (use these first)
- `lib/` — data utilities, fetchers, transforms
- `types/` — shared type declarations

Do not introduce parallel component systems. Extend existing shadcn primitives via variants rather than new bespoke components.

---

## Styling rules (critical)

- Use only Tailwind utilities and shadcn variants. No new global CSS. Existing `globals.css` includes legacy hero styling; do not add more custom selectors, animations, or masks. Prefer replacing custom blocks with Tailwind utilities when touching those areas.
- Keep class names semantic and minimal. Do not introduce non-standard names to override defaults.
- Use semantic tokens: `bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`, etc. Avoid hardcoded colors/shadows/blur/backdrop/opacity hacks.
- Spacing and layout: Tailwind `flex`, `grid`, `gap`, `space-y/x`, `mx/px/py`, `max-w-*`, `min-h-*`. Avoid manual pixel nudges when a utility exists.
- Component elevation: follow the pattern in `components/ui/card.tsx` (variants `surface`, `elevated`, `feature`). Add variants via cva, not ad-hoc classes.
- Scroll behavior: do not hide scrollbars; use native overflow utilities (`overflow-auto`, `overflow-hidden` only when necessary and justified).

---

## Component patterns

- Use shadcn primitives from `components/ui/` (e.g., Button, Card, Tabs, Input, Badge, Select).
- Extend with cva variants (see `card.tsx` for the pattern). Keep variants small, named, and semantic.
- Icons: prefer `lucide-react`, size with utilities or cva defaults (`[&_svg]:size-4` pattern in Button). Keep icons decorative unless conveying meaning; set `aria-hidden` when appropriate.
- Buttons: use `variant` and `size` props; avoid inline colors. Use `asChild` for links.
- Tabs, Select, Input: rely on existing styles; do not restyle via custom CSS.

---

## Layout & pages

- Root layout: `app/layout.tsx` sets fonts and theme provider. Keep it minimal; no page-specific styles or scripts here.
- Pages and sections: use semantic HTML (`section`, `nav`, `header`, `main`, `footer`). Include skip links where relevant.
- Grids and cards: use Tailwind `grid`/`flex` with responsive columns (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) and `gap-*`.
- Content width: cap with `max-w-*` and center with `mx-auto`; avoid arbitrary widths.
- Animations: avoid adding new keyframes or motion; prefer CSS transitions on existing shadcn surfaces. If animation is essential, justify and keep to Tailwind-friendly patterns.

---

## Data & APIs

- Route handlers live under `app/api/**`. Return `Response.json()` for JSON. Example: `app/api/aligns/recent/route.ts` with `dynamic = "force-dynamic"` for dynamic data.
- Parse and validate query params defensively (see `parseLimit` pattern); cap limits for safety.
- Client components should fetch via `fetch` with graceful error handling and minimal serialized props.

---

## Theming and colors

- `next-themes` with `class` strategy; HTML tag has `suppressHydrationWarning`.
- Colors and radius come from CSS variables in `globals.css` and `tailwind.config.js`. Always use semantic tokens; do not hardcode light/dark values.
- Respect light/dark contrast. Avoid custom backdrops, blurs, or drop shadows beyond shadcn defaults.

---

## Typography and icons

- Fonts: `Plus_Jakarta_Sans` (`--font-sans`), `JetBrains_Mono` (`--font-mono`) via `next/font` in `app/layout.tsx`. Do not add additional web fonts.
- Use `text-balance`/`text-pretty` sparingly where readability helps. Avoid excessive letter/word spacing tweaks.
- Icons: prefer consistent sizing via utilities (`size-4`/`size-5`) and align with flex gaps.

---

## Images and media

- Use `next/image` with explicit `width`/`height`. Prefer SVG or small assets.
- Avoid background images and heavy gradients. If needed, use Tailwind utilities and semantic colors, not new CSS blocks.
- Do not lazy-load above-the-fold hero imagery that should be `priority`; use sparingly.

---

## Performance and RSC usage

- Default to server components; add `"use client"` only when state/effects are required.
- Keep serialized props small; derive data on the server when possible.
- Use `next/font` for fonts; avoid self-hosted or extra fonts.
- Avoid adding global scripts. If needed, use `next/script` with `strategy`.
- Budget guidance (mobile p75): LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.10, TTFB ≤ 800ms. Keep per-route JS/CSS lean; avoid new heavy deps.

---

## Accessibility

- Provide skip links for `main`. Maintain logical heading order.
- All interactive elements must be keyboard reachable; use native elements or proper ARIA roles.
- Form controls need labels/aria-label. Buttons should have discernible text.
- Maintain WCAG AA contrast via semantic tokens; do not override with low-contrast colors.

---

## Deployment and config

- Vercel rewrites in `vercel.json` forward `/docs/*` to docs domain. Keep configs minimal and deterministic.
- Environment variables: never commit secrets. Client vars must be `NEXT_PUBLIC_*`.
- Keep `next.config.mjs` lean; avoid custom webpack unless essential.

---

## Pre-merge checks

Run from repo root (or filter):

```bash
pnpm lint
pnpm --filter web build
```

Add tests only when behavior warrants; avoid snapshotting rendered markup unless stable and valuable.

---

## Prohibited

- Custom CSS blocks, keyframes, masks, or backdrops beyond existing legacy hero styles (do not extend them).
- Inline styles or ad-hoc class names to override shadcn defaults.
- Hiding scrollbars or adding blur/shadow tweaks not in shadcn defaults.
- Adding new fonts or heavy dependencies without justification.
