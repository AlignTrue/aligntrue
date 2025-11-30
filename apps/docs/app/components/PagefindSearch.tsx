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

    // Initialize Pagefind UI
    new window.PagefindUI({
      element: containerRef.current,
      showSubResults: true,
      showImages: false,
      excerptLength: 20,
      resetStyles: false,
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
            height: "32px",
            width: "100%",
            maxWidth: "200px",
            padding: "0 12px",
            borderRadius: "8px",
            border: "1px solid var(--nextra-border, #e5e7eb)",
            background: "var(--nextra-bg, #fff)",
            color: "var(--nextra-fg, #111)",
            fontSize: "14px",
          }}
        />
      </div>
    );
  }

  return (
    <>
      <style>{`
        /* Pagefind UI Customization - Match Nextra theme */
        .pagefind-ui {
          --pagefind-ui-scale: 0.8;
          --pagefind-ui-primary: hsl(var(--nextra-primary-hue, 212deg) var(--nextra-primary-saturation, 100%) var(--nextra-primary-lightness, 45%));
          --pagefind-ui-text: var(--nextra-fg, #111);
          --pagefind-ui-background: var(--nextra-bg, #fff);
          --pagefind-ui-border: var(--nextra-border, #e5e7eb);
          --pagefind-ui-border-width: 1px;
          --pagefind-ui-border-radius: 8px;
          --pagefind-ui-font: inherit;
        }

        .dark .pagefind-ui {
          --pagefind-ui-primary: hsl(var(--nextra-primary-hue, 204deg) var(--nextra-primary-saturation, 100%) var(--nextra-primary-lightness, 55%));
          --pagefind-ui-text: var(--nextra-fg, #fff);
          --pagefind-ui-background: var(--nextra-bg, #111);
          --pagefind-ui-border: var(--nextra-border, #333);
        }

        /* Hide the default Pagefind form styling */
        .pagefind-ui .pagefind-ui__form {
          position: relative;
        }

        .pagefind-ui .pagefind-ui__search-input {
          height: 32px;
          padding: 0 12px;
          font-size: 14px;
          width: 200px;
          transition: width 0.2s ease;
        }

        .pagefind-ui .pagefind-ui__search-input:focus {
          width: 300px;
          outline: 2px solid var(--pagefind-ui-primary);
          outline-offset: -1px;
        }

        .pagefind-ui .pagefind-ui__search-clear {
          height: 32px;
          width: 32px;
          padding: 0;
          right: 0;
        }

        /* Results dropdown styling */
        .pagefind-ui .pagefind-ui__drawer {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          min-width: 400px;
          max-width: 600px;
          max-height: 70vh;
          overflow-y: auto;
          margin-top: 8px;
          background: var(--pagefind-ui-background);
          border: var(--pagefind-ui-border-width) solid var(--pagefind-ui-border);
          border-radius: var(--pagefind-ui-border-radius);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
          z-index: 100;
        }

        .dark .pagefind-ui .pagefind-ui__drawer {
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
        }

        .pagefind-ui .pagefind-ui__results-area {
          padding: 12px;
        }

        .pagefind-ui .pagefind-ui__message {
          font-size: 13px;
          padding: 8px 0;
          color: var(--nextra-fg-muted, #6b7280);
        }

        .pagefind-ui .pagefind-ui__result {
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 4px;
        }

        .pagefind-ui .pagefind-ui__result:hover {
          background: var(--nextra-hover, rgba(0, 0, 0, 0.05));
        }

        .dark .pagefind-ui .pagefind-ui__result:hover {
          background: var(--nextra-hover, rgba(255, 255, 255, 0.05));
        }

        .pagefind-ui .pagefind-ui__result-link {
          color: var(--pagefind-ui-primary);
          font-weight: 600;
          font-size: 14px;
          text-decoration: none;
        }

        .pagefind-ui .pagefind-ui__result-link:hover {
          text-decoration: underline;
        }

        .pagefind-ui .pagefind-ui__result-excerpt {
          font-size: 13px;
          line-height: 1.5;
          color: var(--nextra-fg-muted, #6b7280);
          margin-top: 4px;
        }

        .pagefind-ui .pagefind-ui__result-excerpt mark {
          background: hsla(var(--nextra-primary-hue, 212deg), 80%, 70%, 0.3);
          color: inherit;
          padding: 0 2px;
          border-radius: 2px;
        }

        .pagefind-ui .pagefind-ui__button {
          background: var(--pagefind-ui-primary);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          margin-top: 8px;
        }

        .pagefind-ui .pagefind-ui__button:hover {
          opacity: 0.9;
        }

        /* Hide filters panel in compact mode */
        .pagefind-ui .pagefind-ui__filter-panel {
          display: none;
        }

        /* Sub-results styling */
        .pagefind-ui .pagefind-ui__result-nested {
          margin-left: 16px;
          padding-left: 12px;
          border-left: 2px solid var(--pagefind-ui-border);
        }

        .pagefind-ui .pagefind-ui__result-title {
          font-size: 12px;
          color: var(--nextra-fg-muted, #6b7280);
        }
      `}</style>
      <div ref={containerRef} className="pagefind-ui" />
    </>
  );
}
