"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// Extend window type for Pagefind
declare global {
  interface Window {
    PagefindUI?: new (options: {
      element: HTMLElement | null;
      showSubResults?: boolean;
      showImages?: boolean;
      excerptLength?: number;
      resetStyles?: boolean;
      bundlePath?: string;
      translations?: Record<string, string>;
    }) => void;
  }
}

/**
 * PagefindSearch Component
 *
 * Client-side search component using Pagefind for fast, pre-indexed search.
 * Replaces Nextra's built-in FlexSearch for better performance.
 *
 * The Pagefind index is generated during build via the postbuild script
 * and served from /_pagefind/.
 */
export function PagefindSearch({
  placeholder = "Search documentation...",
}: {
  placeholder?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load Pagefind UI script
  useEffect(() => {
    if (!mounted) return;

    // Check if already loaded
    if (window.PagefindUI) {
      setScriptLoaded(true);
      return;
    }

    // Check if script is already in DOM
    const existingScript = document.querySelector(
      'script[src="/_pagefind/pagefind-ui.js"]',
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => setScriptLoaded(true));
      return;
    }

    // Load CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/_pagefind/pagefind-ui.css";
    document.head.appendChild(link);

    // Load script
    const script = document.createElement("script");
    script.src = "/_pagefind/pagefind-ui.js";
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => console.error("Failed to load Pagefind UI script");
    document.head.appendChild(script);

    return () => {
      // Cleanup is optional since we want the script to persist
    };
  }, [mounted]);

  // Initialize Pagefind UI once script is loaded
  const initPagefind = useCallback(() => {
    if (!containerRef.current || !window.PagefindUI) return;

    // Clear any existing content
    containerRef.current.innerHTML = "";

    // Initialize Pagefind UI with native styles
    new window.PagefindUI({
      element: containerRef.current,
      showSubResults: true,
      showImages: false,
      excerptLength: 15,
      resetStyles: true, // Use Pagefind's native reset styles
      bundlePath: "/_pagefind/",
      translations: {
        placeholder,
        zero_results: "No results for [SEARCH_TERM]",
        many_results: "[COUNT] results for [SEARCH_TERM]",
        one_result: "[COUNT] result for [SEARCH_TERM]",
        searching: "Searching...",
      },
    });
  }, [placeholder]);

  useEffect(() => {
    if (scriptLoaded) {
      initPagefind();
    }
  }, [scriptLoaded, initPagefind]);

  // Don't render anything on server
  if (!mounted) {
    return (
      <div className="pagefind-search-placeholder">
        <input
          type="text"
          placeholder={placeholder}
          disabled
          style={{
            height: "2.5rem",
            width: "100%",
            maxWidth: "200px",
            padding: "0 1rem",
            borderRadius: "8px",
            border: "1px solid var(--nextra-border, #e5e7eb)",
            background: "transparent",
            color: "var(--nextra-fg, #111)",
            fontSize: "1rem",
          }}
        />
      </div>
    );
  }

  return (
    <>
      <style>{`
        /* Minimal Pagefind theme customization - colors only */
        .pagefind-ui {
          --pagefind-ui-scale: 1;
          --pagefind-ui-primary: #3b82f6;
          --pagefind-ui-text: #111;
          --pagefind-ui-background: #fff;
          --pagefind-ui-border: #e5e7eb;
          --pagefind-ui-tag: #f3f4f6;
          --pagefind-ui-border-width: 1px;
          --pagefind-ui-border-radius: 8px;
          --pagefind-ui-font: inherit;
        }

        .dark .pagefind-ui {
          --pagefind-ui-primary: #60a5fa;
          --pagefind-ui-text: #f9fafb;
          --pagefind-ui-background: #111;
          --pagefind-ui-border: #374151;
          --pagefind-ui-tag: #1f2937;
        }

        /* Ensure dropdown appears above page content */
        .pagefind-ui .pagefind-ui__drawer {
          z-index: 9999;
        }

        /* Ensure form is positioned correctly for dropdown */
        .pagefind-ui .pagefind-ui__form {
          position: relative;
        }
      `}</style>
      <div ref={containerRef} className="pagefind-ui" />
    </>
  );
}
