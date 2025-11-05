/**
 * Nextra Theme Configuration Factory
 *
 * @deprecated This factory is no longer needed with standard Nextra setup.
 * Use a standard theme.config.tsx file at the app root instead.
 *
 * See: apps/docs/theme.config.tsx for the standard approach.
 *
 * Creates a branded Nextra theme config with AlignTrue design system.
 * Maintains upgrade safety by using only documented Nextra APIs.
 *
 * Usage in docs app/layout.tsx:
 *   import { createAlignTrueNextraTheme } from "@aligntrue/ui/nextra";
 *   const themeConfig = createAlignTrueNextraTheme({ ... });
 */

import { AlignTrueLogo } from "../components/AlignTrueLogo";

interface NextraThemeConfig {
  logo?: React.ReactNode;
  project?: {
    link: string;
  };
  docsRepositoryBase?: string;
  editLink?:
    | {
        component: React.ComponentType<unknown> | null;
      }
    | React.ReactNode;
  footer?:
    | {
        component: React.ComponentType<unknown> | null;
      }
    | React.ReactNode;
  sidebar?: {
    defaultMenuCollapseLevel?: number;
    autoCollapse?: boolean;
    defaultOpen?: boolean;
    toggleButton?: boolean;
  };
  toc?: {
    backToTop?: boolean;
  };
  [key: string]: unknown;
}

interface AlignTrueNextraThemeOptions {
  /**
   * GitHub repository URL for project link
   * Default: "https://github.com/AlignTrue/aligntrue"
   */
  projectLink?: string;

  /**
   * Base path for documentation repository
   * Used for "Edit this page" links
   */
  docsRepositoryBase?: string;

  /**
   * Custom footer component or config
   * Default: Simple copyright footer
   */
  footer?: NextraThemeConfig["footer"];

  /**
   * Logo size variant
   * Default: "md"
   */
  logoSize?: "sm" | "md" | "lg";

  /**
   * Additional config to merge with defaults
   */
  additionalConfig?: Partial<NextraThemeConfig>;
}

/**
 * Creates AlignTrue-branded Nextra theme configuration
 * @deprecated Use standard theme.config.tsx instead (see apps/docs/theme.config.tsx)
 */
export function createAlignTrueNextraTheme(
  options: AlignTrueNextraThemeOptions = {},
): NextraThemeConfig {
  const {
    projectLink = "https://github.com/AlignTrue/aligntrue",
    docsRepositoryBase = "https://github.com/AlignTrue/aligntrue/tree/main/apps/docs",
    logoSize = "md",
    additionalConfig = {},
  } = options;

  const config: NextraThemeConfig = {
    logo: <AlignTrueLogo size={logoSize} />,
    project: {
      link: projectLink,
    },
    docsRepositoryBase,
    sidebar: {
      defaultMenuCollapseLevel: 2,
      autoCollapse: false,
      toggleButton: true,
    },
    toc: {
      backToTop: true,
    },
    search: {
      placeholder: "Search documentation...",
      emptyResult: "No results found.",
      loading: "Searching...",
    },
    ...additionalConfig,
  };

  return config;
}
