"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { AlignTrueLogo } from "@aligntrue/ui";
import { Menu, Moon, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GitHubIcon } from "./GitHubIcon";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleClick = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  return (
    <Button
      onClick={handleClick}
      variant="outline"
      size="icon"
      aria-label="Toggle theme"
      className="border-border"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </Button>
  );
}

export function SiteHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <header className="border-b border-border px-6 py-4 relative z-50 bg-background">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 no-underline"
            aria-label="AlignTrue home"
          >
            <AlignTrueLogo size="md" />
          </Link>

          <>
            {/* Desktop Navigation */}
            <nav
              className="hidden md:flex items-center gap-6"
              aria-label="Main navigation"
            >
              <a href="/docs" className="text-sm text-foreground no-underline">
                Docs
              </a>
              <a
                href="/docs/04-reference/features"
                className="text-sm text-foreground no-underline"
              >
                Features
              </a>
              <a
                href="/docs/about"
                className="text-sm text-foreground no-underline"
              >
                About
              </a>
              <a
                href="https://github.com/AlignTrue/aligntrue"
                target="_blank"
                rel="noreferrer"
                className="text-foreground inline-flex items-center justify-center"
                aria-label="AlignTrue GitHub repository"
              >
                <GitHubIcon size={24} />
              </a>
              <ThemeToggle />
            </nav>

            {/* Mobile Menu Button */}
            <div className="flex items-center gap-3 md:hidden">
              <ThemeToggle />
              <Button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                variant="outline"
                size="icon"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-menu"
                className="mobile-menu-button border-border"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </Button>
            </div>
          </>
        </div>
      </header>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <nav
          id="mobile-menu"
          className="fixed left-0 right-0 bottom-0 bg-background z-40 p-6 flex flex-col gap-4 md:hidden top-[calc(100px+var(--banner-height,0px))]"
          aria-label="Mobile navigation"
        >
          <a
            href="/docs"
            onClick={() => setMobileMenuOpen(false)}
            className="px-4 py-3 text-base no-underline text-foreground rounded-md transition-colors hover:bg-muted"
          >
            Docs
          </a>
          <a
            href="/docs/04-reference/features"
            onClick={() => setMobileMenuOpen(false)}
            className="px-4 py-3 text-base no-underline text-foreground rounded-md transition-colors hover:bg-muted"
          >
            Features
          </a>
          <a
            href="/docs/about"
            onClick={() => setMobileMenuOpen(false)}
            className="px-4 py-3 text-base no-underline text-foreground rounded-md transition-colors hover:bg-muted"
          >
            About
          </a>
          <a
            href="https://github.com/AlignTrue/aligntrue"
            target="_blank"
            rel="noreferrer"
            onClick={() => setMobileMenuOpen(false)}
            className="px-4 py-3 text-base no-underline text-foreground rounded-md transition-colors hover:bg-muted inline-flex items-center justify-center"
          >
            <GitHubIcon size={24} />
          </a>
        </nav>
      )}

      {/* Responsive styles */}
    </>
  );
}
