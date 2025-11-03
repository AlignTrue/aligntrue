/**
 * ThemeToggle Component
 *
 * Button to toggle between light and dark themes.
 * Includes keyboard accessibility and ARIA labels.
 *
 * Usage:
 *   <ThemeToggle />
 *   <ThemeToggle variant="icon" />
 */

"use client";

import { useTheme } from "./ThemeProvider";

interface ThemeToggleProps {
  /**
   * Visual variant of the toggle
   * - "icon": Shows sun/moon icons
   * - "text": Shows "Light" / "Dark" text
   */
  variant?: "icon" | "text";

  /**
   * Additional CSS class names
   */
  className?: string;
}

export function ThemeToggle({
  variant = "icon",
  className = "",
}: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();

  const toggle = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  const isDark = resolvedTheme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  if (variant === "text") {
    return (
      <button
        onClick={toggle}
        className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${className}`}
        style={{
          color: "var(--fgColor-default)",
          backgroundColor: "transparent",
          border: "1px solid var(--borderColor-default)",
        }}
        aria-label={label}
        title={label}
      >
        {isDark ? "Light" : "Dark"}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-md transition-colors ${className}`}
      style={{
        color: "var(--fgColor-default)",
        backgroundColor: "transparent",
        border: "1px solid var(--borderColor-default)",
      }}
      aria-label={label}
      title={label}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="3.5" fill="currentColor" />
      <path
        d="M8 0v2M8 14v2M16 8h-2M2 8H0M13.657 2.343l-1.414 1.414M3.757 12.243l-1.414 1.414M13.657 13.657l-1.414-1.414M3.757 3.757L2.343 2.343"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M14.53 10.53a7 7 0 01-9.058-9.058A7.003 7.003 0 108 15a6.97 6.97 0 006.53-4.47z"
        fill="currentColor"
      />
    </svg>
  );
}
