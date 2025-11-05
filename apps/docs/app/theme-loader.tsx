"use client";

import { useEffect } from "react";

/**
 * ThemeLoader Component
 *
 * Adds theme-loaded class after hydration to enable CSS transitions.
 * Prevents flash of unstyled content on initial load.
 */
export function ThemeLoader() {
  useEffect(() => {
    // Add theme-loaded class after hydration to enable transitions
    document.documentElement.classList.add("theme-loaded");
  }, []);

  return null;
}
