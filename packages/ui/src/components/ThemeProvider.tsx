/**
 * ThemeProvider Component
 *
 * Provides theme context and manages light/dark mode switching.
 * Detects system preference, persists user choice, and prevents flash of unstyled content.
 *
 * Usage:
 *   <ThemeProvider defaultTheme="dark">
 *     <App />
 *   </ThemeProvider>
 */

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  /** Current theme setting (may be "system") */
  theme: Theme;
  /** Resolved theme (always "light" or "dark") */
  resolvedTheme: ResolvedTheme;
  /** Set theme and persist to localStorage */
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "aligntrue-theme";
const THEME_ATTR = "data-theme";

interface ThemeProviderProps {
  children: ReactNode;
  /**
   * Default theme to use on first load.
   * Default: "system" (respects user's OS preference)
   */
  defaultTheme?: Theme;
  /**
   * Storage key for localStorage persistence.
   * Default: "aligntrue-theme"
   */
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = STORAGE_KEY,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");
  const [mounted, setMounted] = useState(false);

  // Resolve "system" to actual theme based on prefers-color-scheme
  const resolveTheme = (themeValue: Theme): ResolvedTheme => {
    if (themeValue === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return themeValue;
  };

  // Initialize theme on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey) as Theme | null;
      const initialTheme = stored ?? defaultTheme;
      const resolved = resolveTheme(initialTheme);

      setThemeState(initialTheme);
      setResolvedTheme(resolved);

      // Apply theme to document
      const root = document.documentElement;
      root.setAttribute(THEME_ATTR, resolved);
      root.classList.add("theme-loaded");

      setMounted(true);
    } catch {
      // localStorage might not be available (SSR, private mode, etc.)
      const resolved = resolveTheme(defaultTheme);
      setThemeState(defaultTheme);
      setResolvedTheme(resolved);
      setMounted(true);
    }
  }, [defaultTheme, storageKey]);

  // Listen for system theme changes when theme is "system"
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      const newResolved = e.matches ? "dark" : "light";
      setResolvedTheme(newResolved);
      document.documentElement.setAttribute(THEME_ATTR, newResolved);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    try {
      localStorage.setItem(storageKey, newTheme);
    } catch {
      // Ignore localStorage errors
    }

    const resolved = resolveTheme(newTheme);
    setThemeState(newTheme);
    setResolvedTheme(resolved);
    document.documentElement.setAttribute(THEME_ATTR, resolved);
  };

  const value: ThemeContextValue = {
    theme,
    resolvedTheme,
    setTheme,
  };

  // Render children immediately to avoid hydration mismatch
  // The inline script will handle preventing FOUC
  return (
    <ThemeContext.Provider value={value}>
      {mounted ? (
        children
      ) : (
        <div style={{ visibility: "hidden" }}>{children}</div>
      )}
    </ThemeContext.Provider>
  );
}

/**
 * useTheme Hook
 *
 * Access current theme and theme setter from anywhere in the app.
 *
 * @example
 * const { theme, resolvedTheme, setTheme } = useTheme();
 * setTheme("dark");
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

/**
 * ThemeScript Component
 *
 * Inline script to prevent flash of unstyled content (FOUC).
 * Should be placed in <head> before any content renders.
 *
 * Usage in Next.js app/layout.tsx:
 *   <Head>
 *     <ThemeScript />
 *   </Head>
 */
export function ThemeScript({
  storageKey = STORAGE_KEY,
}: {
  storageKey?: string;
}) {
  // Script runs before React hydrates to set initial theme
  const scriptContent = `
(function() {
  try {
    var theme = localStorage.getItem('${storageKey}') || 'system';
    var resolved = theme;
    
    if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.classList.add('theme-loaded');
  } catch (e) {
    // Fallback to system preference
    var resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.classList.add('theme-loaded');
  }
})();
`;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: scriptContent }}
      suppressHydrationWarning
    />
  );
}
