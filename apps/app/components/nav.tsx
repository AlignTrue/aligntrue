"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { useState, useRef, useEffect } from "react";

const primaryLinks = [
  { href: "/review", label: "Review" },
  { href: "/tasks", label: "Tasks" },
] satisfies { href: Route; label: string }[];

const secondaryLinks = [
  { href: "/timeline", label: "History" },
  { href: "/contacts", label: "Record" },
  { href: "/notes", label: "Notes" },
] satisfies { href: Route; label: string }[];

export function Nav() {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setSettingsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isActive = (href: string) => {
    if (href === "/review") {
      return (
        pathname === "/" || pathname === "/review" || pathname === "/dashboard"
      );
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 text-sm">
        <div className="flex items-center gap-1">
          {/* Logo/Brand */}
          <Link href="/review" className="mr-4 font-semibold text-foreground">
            AlignTrue
          </Link>

          {/* Primary Links */}
          {primaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                isActive(link.href)
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Settings Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="sr-only">Settings</span>
          </button>

          {settingsOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-md border bg-card py-1 shadow-lg">
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                Inspection
              </div>
              {secondaryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setSettingsOpen(false)}
                  className={`block px-3 py-1.5 transition-colors ${
                    isActive(link.href)
                      ? "bg-accent text-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="my-1 border-t" />
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                Keyboard
              </div>
              <div className="px-3 py-1.5 text-xs text-muted-foreground">
                <kbd className="rounded bg-muted px-1">⌘K</kbd> or{" "}
                <kbd className="rounded bg-muted px-1">c</kbd> to capture
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
