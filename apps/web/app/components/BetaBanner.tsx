"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GitHubIcon } from "./GitHubIcon";

export function BetaBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isDismissed = localStorage.getItem("aligntrue-beta-banner-dismissed");
    if (isDismissed === "true") {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("aligntrue-beta-banner-dismissed", "true");
  };

  useEffect(() => {
    if (mounted) {
      document.documentElement.style.setProperty(
        "--banner-height",
        dismissed ? "0px" : "48px",
      );
    }
  }, [mounted, dismissed]);

  if (!mounted || dismissed) return null;

  return (
    <div className="w-full bg-primary text-primary-foreground border-b border-primary px-6 py-3 flex flex-wrap items-center justify-center gap-3 text-base font-medium">
      <div className="flex items-center gap-2 min-w-[200px] justify-center flex-1 flex-wrap">
        <span>🚀 AlignTrue is in beta.</span>
        <a
          href="https://github.com/AlignTrue/aligntrue"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 underline text-primary-foreground/80 hover:text-primary-foreground font-semibold"
          aria-label="Follow updates on GitHub"
        >
          Star on GitHub
          <GitHubIcon size={16} className="inline" />
        </a>
      </div>
      <Button
        onClick={handleDismiss}
        variant="ghost"
        size="icon"
        aria-label="Dismiss beta banner"
        className="text-primary-foreground hover:text-primary-foreground"
      >
        <X size={18} />
      </Button>
    </div>
  );
}
