import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { HashBar } from "@/components/HashBar";
import type { AlignSummary } from "@/lib/aligns/transforms";

type AlignCardProps = {
  align: AlignSummary;
  onSelect?: (align: AlignSummary) => void;
  isSelected?: boolean;
};

export function AlignCard({ align, onSelect, isSelected }: AlignCardProps) {
  const isPack = align.kind === "pack";

  return (
    <Card
      className={cn(
        "h-full flex flex-col transition hover:shadow-md overflow-hidden",
        isSelected && "ring-2 ring-primary shadow-lg shadow-primary/10",
      )}
    >
      <CardContent className="p-4 space-y-3 text-left flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs sm:text-[11px] text-muted-foreground truncate">
            {align.externalUrl ? (
              <a
                href={align.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground/80 hover:text-foreground hover:underline"
              >
                {align.displayFilename}
              </a>
            ) : (
              <span className="font-medium text-foreground/80">
                {align.displayFilename}
              </span>
            )}
            <span className="mx-1 text-border">•</span>
            {align.displayAuthorUrl ? (
              <a
                href={align.displayAuthorUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-foreground hover:text-primary hover:underline"
              >
                {align.displayAuthor}
              </a>
            ) : (
              <span className="font-semibold text-foreground">
                {align.displayAuthor}
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-[11px] px-2 py-0.5 rounded-md font-medium border",
                isPack
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-muted text-foreground/80 border-border/80",
              )}
            >
              {isPack ? "Pack" : "Rule"}
            </span>
          </div>
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-foreground line-clamp-2 text-left">
            {align.title || "Untitled align"}
          </h3>
          {align.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-6 text-left">
              {align.description}
            </p>
          )}
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0 items-center justify-between gap-3">
        <span className="inline-flex items-center text-[11px] font-mono text-muted-foreground bg-muted rounded px-2 py-0.5 border border-border/80">
          ID: {align.id}
        </span>
        <div className="flex items-center gap-2">
          {onSelect && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSelect(align)}
              className="text-foreground"
            >
              Preview
            </Button>
          )}
          <Button size="sm" asChild>
            <Link href={`/a/${align.id}`}>Open</Link>
          </Button>
        </div>
      </CardFooter>
      <HashBar id={align.id} height={2} className="rounded-b-xl" />
    </Card>
  );
}
