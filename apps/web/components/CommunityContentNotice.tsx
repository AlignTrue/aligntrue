import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
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
  const learnMoreHref = "/docs/01-guides/11-catalog-safety";
  const reportHref = buildReportUrl(alignId, alignUrl);
  const textClass = compact ? "text-[11px]" : "text-xs";

  if (variant === "inline") {
    return (
      <TooltipProvider delayDuration={100}>
        <div className={cn("flex items-center gap-2", textClass, className)}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info
                size={12}
                className="text-muted-foreground shrink-0 cursor-help"
                aria-label="Community content"
              />
            </TooltipTrigger>
            <TooltipContent side="top" align="start">
              Community-submitted content — review before using.
            </TooltipContent>
          </Tooltip>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-muted-foreground">Community content</span>
            <span aria-hidden className="text-muted-foreground/80 px-0.5">
              •
            </span>
            <a
              href={learnMoreHref}
              className="text-muted-foreground hover:text-foreground hover:underline underline-offset-4"
            >
              Learn more
            </a>
            <span aria-hidden className="text-muted-foreground/80 px-0.5">
              •
            </span>
            <a
              href={reportHref}
              className="text-muted-foreground hover:text-foreground hover:underline underline-offset-4"
              target="_blank"
              rel="noreferrer"
            >
              Report
            </a>
          </div>
        </div>
      </TooltipProvider>
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
