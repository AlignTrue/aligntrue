/**
 * @aligntrue/ui
 * Shared UI primitives and design tokens
 */

// Logo components
export { AlignTrueLogo, AlignTrueLogoText } from "./components/AlignTrueLogo";

// Legacy exports (deprecated)
/** @deprecated Use AlignTrueLogo instead */
export { BrandLogo } from "./components/BrandLogo";

/**
 * @deprecated SiteHeader and SiteFooter have been moved inline to their respective pages
 * for better independence between homepage and docs.
 * - Homepage: See apps/docs/app/page.tsx
 * - Docs: See apps/docs/app/docs/layout.tsx (DocsFooter)
 */
// export { SiteHeader } from "./components/SiteHeader";
// export { SiteFooter } from "./components/SiteFooter";
