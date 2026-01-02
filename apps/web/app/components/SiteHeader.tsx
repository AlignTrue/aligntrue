"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { AlignTrueLogo } from "@aligntrue/ui-base";
import { Moon, Sun } from "lucide-react";
import { Button } from "@aligntrue/ui-base";
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
  return (
    <header className="border-b border-border px-6 py-4 relative z-50 bg-background">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 no-underline"
          aria-label="AlignTrue home"
        >
          <AlignTrueLogo size="md" />
        </Link>
        <div className="flex items-center gap-4">
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
        </div>
      </div>
    </header>
  );
}
