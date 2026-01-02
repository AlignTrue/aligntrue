import type { BlockHeaderProps } from "@aligntrue/ui-renderer";
import { cn } from "./cn.js";

export function BlockHeader({ title, subtitle, actions }: BlockHeaderProps) {
  if (!title && !subtitle && !actions) return null;
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        {title ? (
          <h3 className="text-sm font-semibold leading-5 text-foreground">
            {title}
          </h3>
        ) : null}
        {subtitle ? (
          <p
            className={cn("text-xs text-muted-foreground", title ? "mt-1" : "")}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
