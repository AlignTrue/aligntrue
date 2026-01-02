# @aligntrue/ui-base

Shared UI primitives and design tokens for AlignTrue.

## ⚠️ Zero-Build Package

This package is **non-compiled and ships raw source files** directly to consumers. It has **no build step** and **no asset bundling**.

### Do's and Don'ts

✅ **DO:**

- Embed SVGs inline in JSX components
- Import CSS files
- Use plain TypeScript/React
- Reference images as data URIs or base64
- Use CSS variables for theming

❌ **DON'T:**

- Import `.svg`, `.png`, `.jpg`, or other media files
- Use `require()` for assets
- Assume Next.js will apply loaders (it won't for this package)
- Create external asset files expected to be bundled

**Why?** The UI package is consumed by multiple apps with different Next.js configurations. By keeping it asset-free, we ensure it works everywhere without special configuration.

## Contents

- **Design tokens** - CSS custom properties for colors, typography, spacing, and border radius
- **AlignTrueLogo** - SVG logo with theme-aware color inheritance
- **Tailwind preset** - Configuration that references design tokens

## Usage

### Import design tokens

```tsx
// In your app's global CSS file
import "@aligntrue/ui-base/styles/tokens.css";
```

### Use AlignTrueLogo component

```tsx
import { AlignTrueLogo } from "@aligntrue/ui-base";

export function Header() {
  return (
    <header>
      <AlignTrueLogo size="md" className="text-slate-900 dark:text-white" />
    </header>
  );
}
```

The logo inherits text color from CSS (theme-aware) and uses the `--brand-accent` CSS variable for the colon accent.

### Configure Tailwind

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";
import preset from "@aligntrue/ui-base/tailwind-preset";

const config: Config = {
  presets: [preset],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
};

export default config;
```

## Token categories

### Colors

- **neutral** - Grayscale palette (50-950)
- **primary** - Accent color (50-950)

### Typography

- **font-sans** - System UI sans-serif stack
- **font-mono** - Monospace stack
- Font sizes: sm, base, lg, xl, 2xl, 3xl, 4xl

### Spacing

4px base scale: 1, 2, 3, 4, 5, 6, 8, 10, 12, 16

### Border radius

sm, base (default), md, lg, xl

## Notes

Current tokens are minimal placeholders. These can be refined when branding is finalized without breaking consuming code.
