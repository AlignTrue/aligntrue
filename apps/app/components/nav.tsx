"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { Button } from "@aligntrue/ui-base";
import { cn } from "@/lib/utils";

export interface NavProps {
  tasksEnabled?: boolean;
  notesEnabled?: boolean;
  trajectoriesEnabled?: boolean;
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleClick = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
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

export function Nav({
  tasksEnabled = false,
  notesEnabled = false,
  trajectoriesEnabled = false,
}: NavProps) {
  const pathname = usePathname();

  const links: { href: Route; label: string }[] = [
    { href: "/", label: "Dashboard" },
    ...(tasksEnabled ? [{ href: "/tasks" as Route, label: "Tasks" }] : []),
    ...(notesEnabled ? [{ href: "/notes" as Route, label: "Notes" }] : []),
    ...(trajectoriesEnabled
      ? [
          { href: "/trajectories" as Route, label: "Trajectories" },
          { href: "/simulate" as Route, label: "Simulate" },
        ]
      : []),
  ];

  return (
    <nav className="border-b bg-background px-4 py-2">
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <Link href="/" className="font-bold">
          AlignTrue App
        </Link>
        <div className="flex items-center gap-3 text-sm">
          {links.map((link) => {
            const isActive =
              pathname === link.href || pathname?.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-2 py-1 transition",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
