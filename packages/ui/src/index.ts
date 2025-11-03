/**
 * @aligntrue/ui
 * Shared UI primitives and design tokens
 */

// Logo components
export { AlignTrueLogo, AlignTrueLogoText } from "./components/AlignTrueLogo";

// Theme components
export {
  ThemeProvider,
  ThemeScript,
  useTheme,
} from "./components/ThemeProvider";
export { ThemeToggle } from "./components/ThemeToggle";

// Footer components
export { SiteFooter } from "./components/SiteFooter";

// Legacy exports (deprecated)
/** @deprecated Use AlignTrueLogo instead */
export { BrandLogo } from "./components/BrandLogo";
