# @aligntrue/ui

Shared UI primitives and design tokens for AlignTrue.

## Contents

- **Design tokens** - CSS custom properties for colors, typography, spacing, and border radius
- **BrandLogo** - Simple text-based logo component (placeholder, can be swapped for SVG)
- **Tailwind preset** - Configuration that references design tokens

## Usage

### Import design tokens

```tsx
// In your app's global CSS file
import "@aligntrue/ui/styles/tokens.css"
```

### Use BrandLogo component

```tsx
import { BrandLogo } from "@aligntrue/ui"

export function Header() {
  return (
    <header>
      <BrandLogo className="text-2xl" />
    </header>
  )
}
```

### Configure Tailwind

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss"
import preset from "@aligntrue/ui/tailwind-preset"

const config: Config = {
  presets: [preset],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
}

export default config
```

## Token Categories

### Colors

- **neutral** - Grayscale palette (50-950)
- **primary** - Accent color (50-950)

### Typography

- **font-sans** - System UI sans-serif stack
- **font-mono** - Monospace stack
- Font sizes: sm, base, lg, xl, 2xl, 3xl, 4xl

### Spacing

4px base scale: 1, 2, 3, 4, 5, 6, 8, 10, 12, 16

### Border Radius

sm, base (default), md, lg, xl

## Notes

Current tokens are minimal placeholders for Phase 1. These can be refined when branding is finalized without breaking consuming code.

