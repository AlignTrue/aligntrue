import { ReactNode } from "react";
import { Button } from "@aligntrue/ui-base";
import { cn } from "@/lib/utils";
import { useCopyToClipboard } from "@/lib/useCopyToClipboard";

type CommandBlockProps = {
  description?: ReactNode;
  code: string;
  copyLabel?: string;
  onCopy?: () => void;
  secondaryAction?: ReactNode;
  hideCopy?: boolean;
  className?: string;
  codeClassName?: string;
  showPrompt?: boolean;
  promptSymbol?: string;
  variant?: "terminal" | "simple";
};

export function CommandBlock({
  description,
  code,
  copyLabel = "Copy",
  onCopy,
  secondaryAction,
  hideCopy = false,
  className,
  codeClassName,
  showPrompt = true,
  promptSymbol = "$",
  variant = "terminal",
}: CommandBlockProps) {
  const { copied, copy } = useCopyToClipboard();

  const handleCopy = async () => {
    await copy(code, onCopy);
  };

  const lines = code.split("\n");

  return (
    <div
      className={cn(
        "flex flex-col gap-0 sm:flex-row sm:items-center rounded-xl",
        variant === "terminal"
          ? "bg-background ring-1 ring-inset ring-border"
          : "bg-muted border border-border shadow-sm",
        className,
      )}
    >
      <div className="flex-1 min-w-0 w-full">
        {description && (
          <div className={cn("px-4 pt-3.5 text-sm font-medium text-primary")}>
            {description}
          </div>
        )}
        <div className={cn("mt-2.5 rounded-b-xl overflow-hidden")}>
          <div
            className={cn(
              variant === "terminal"
                ? "bg-transparent text-card-foreground"
                : "bg-muted text-foreground",
            )}
          >
            <pre className="flex max-h-[320px] overflow-x-auto px-4 py-3 text-sm leading-6">
              <code className={cn("flex-1 min-w-0 text-left", codeClassName)}>
                {lines.map((line, idx) => (
                  <div key={idx} className="flex gap-3">
                    {variant === "terminal" && showPrompt && (
                      <span className="text-primary select-none shrink-0">
                        {line.trim() ? promptSymbol : ""}
                      </span>
                    )}
                    <span className="whitespace-pre-wrap break-all">
                      {line || " "}
                    </span>
                  </div>
                ))}
              </code>
            </pre>
          </div>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3 p-4 w-full sm:w-auto">
        {!hideCopy && (
          <Button
            onClick={handleCopy}
            variant="default"
            size="sm"
            className="font-semibold w-full sm:w-auto sm:min-w-[120px] h-10 text-sm"
          >
            {copied ? "✓ Copied" : copyLabel}
          </Button>
        )}
        {secondaryAction}
      </div>
    </div>
  );
}
