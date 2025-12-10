import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      console.error("copy failed", err);
    }
  };

  const lines = code.split("\n");

  return (
    <div
      className={cn(
        "flex flex-col gap-0 sm:flex-row sm:items-center border border-border rounded-xl shadow-sm",
        variant === "terminal" ? "bg-[hsl(222_24%_8%)]" : "bg-background",
        className,
      )}
    >
      <div className="flex-1 min-w-0 w-full">
        {description && (
          <div
            className={cn(
              "px-4 pt-3 text-sm",
              variant === "terminal"
                ? "text-white/80"
                : "text-muted-foreground",
            )}
          >
            {description}
          </div>
        )}
        <div className={cn("mt-2 rounded-b-xl overflow-hidden")}>
          <div
            className={cn(
              variant === "terminal"
                ? "bg-[hsl(222_24%_8%)] text-white"
                : "bg-muted text-foreground",
            )}
          >
            <pre className="flex max-h-[320px] overflow-auto px-4 py-3 text-sm leading-6">
              <code className={cn("flex-1 text-left", codeClassName)}>
                {lines.map((line, idx) => (
                  <div key={idx} className="flex gap-3">
                    {variant === "terminal" && showPrompt && (
                      <span className="text-emerald-400 select-none">
                        {line.trim() ? promptSymbol : ""}
                      </span>
                    )}
                    <span className="whitespace-pre-wrap">{line || " "}</span>
                  </div>
                ))}
              </code>
            </pre>
          </div>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-2 p-4 w-full sm:w-auto">
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
