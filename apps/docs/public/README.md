# Public assets

This directory contains static assets served at the root path.

## Required Files

### aligntrue-og-image.png (1800x945)

Open Graph and Twitter card image for social media sharing.

**To add:**

1. Resize your AlignTrue logo image to 1800x945 pixels
2. Save as `aligntrue-og-image.png` in this directory
3. The image will be automatically used for:
   - Open Graph (Facebook, LinkedIn, etc.)
   - Twitter cards
   - Other social media platforms

### favicon.ico

Site favicon displayed in browser tabs.

**To add:**

1. Place your `favicon.ico` file in this directory
2. Next.js will automatically serve it at `/favicon.ico`

## Current Status

- [ ] aligntrue-og-image.png - Needs to be added (1800x945 pixels)
- [ ] favicon.ico - Needs to be added

## Usage

These files are referenced in:

- `apps/docs/app/layout.tsx` - Metadata configuration
- Automatically served by Next.js at root paths
