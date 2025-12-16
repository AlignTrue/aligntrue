import { Info } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type CommunityContentNoticeProps = {
  alignId: string;
  alignUrl: string;
  compact?: boolean;
  variant?: "callout" | "inline";
  className?: string;
};

function buildReportUrl(alignId: string, alignUrl: string): string {
  const title = encodeURIComponent(`Report align: ${alignId}`);
  const body = encodeURIComponent(
    `Align ID: ${alignId}\nAlign URL: ${alignUrl}\nReason: \nDetails: \n`,
  );
  return `https://github.com/AlignTrue/aligntrue/issues/new?labels=report-align&title=${title}&body=${body}`;
}

export function CommunityContentNotice({
  alignId,
  alignUrl,
  compact = false,
  variant = "callout",
  className,
}: CommunityContentNoticeProps) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const learnMoreHref = "/docs/01-guides/11-catalog-safety";
  const reportHref = buildReportUrl(alignId, alignUrl);
  const textClass = compact ? "text-[11px]" : "text-xs";

  if (variant === "inline") {
    if (!hydrated) return null;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Community content info"
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-muted/60 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
              className,
            )}
          >
            <Info size={14} className="shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-72 text-xs">
          <p className="mb-2 text-muted-foreground">
            Community-submitted content — review before using.
          </p>
          <div className="flex flex-wrap items-center gap-3 font-medium">
            <a
              href={learnMoreHref}
              className="text-foreground hover:underline underline-offset-4"
            >
              Learn more
            </a>
            <a
              href={reportHref}
              className="text-foreground hover:underline underline-offset-4"
              target="_blank"
              rel="noreferrer"
            >
              Report
            </a>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-border/70 bg-muted/60 px-3 py-2",
        className,
      )}
    >
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info
              size={14}
              className="text-muted-foreground shrink-0 cursor-help"
              aria-label="Community content"
            />
          </TooltipTrigger>
          <TooltipContent side="top" align="start">
            Community-submitted content — review before using.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <div className={cn("flex flex-wrap items-center gap-2", textClass)}>
        <span className="text-muted-foreground">
          Community content — review before using.
        </span>
        <a
          href={learnMoreHref}
          className="font-semibold text-foreground hover:underline"
        >
          Learn more
        </a>
        <span aria-hidden className="text-border">
          •
        </span>
        <a
          href={reportHref}
          className="font-semibold text-foreground hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Report
        </a>
      </div>
    </div>
  );
}
