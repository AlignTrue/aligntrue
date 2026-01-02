import type { ReactNode } from "react";
import { BetaBanner } from "@/app/components/BetaBanner";
import { SiteFooter } from "@/app/components/SiteFooter";
import { SiteHeader } from "@/app/components/SiteHeader";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { cn } from "@/lib/utils";

type PageLayoutProps = {
  children: ReactNode;
  mainId?: string;
  mainClassName?: string;
  className?: string;
};

export function PageLayout({
  children,
  mainId = "main-content",
  mainClassName,
  className,
}: PageLayoutProps) {
  return (
    <div
      className={cn("min-h-screen bg-background overflow-x-hidden", className)}
    >
      <a href={`#${mainId}`} className="sr-only">
        Skip to main content
      </a>
      <BetaBanner />
      <SiteHeader />
      <main
        id={mainId}
        className={cn("text-foreground overflow-hidden", mainClassName)}
      >
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <SiteFooter />
    </div>
  );
}
