import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCopyToClipboard } from "@/lib/useCopyToClipboard";
import { type ReactNode } from "react";

type CodePreviewProps = {
  filename?: string;
  fileSelector?: ReactNode;
  content: string;
  loading?: boolean;
  secondaryAction?: ReactNode;
};

export function CodePreview({
  filename = "rules.md",
  fileSelector,
  content,
  loading,
  secondaryAction,
}: CodePreviewProps) {
  const { copied, copy } = useCopyToClipboard();

  const lines = content ? content.split("\n") : [];

  const handleCopy = async () => {
    await copy(content);
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-border bg-muted">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span className="flex-1 min-w-0">
            {fileSelector ?? <span className="block">{filename}</span>}
          </span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:justify-start">
          <Button
            size="sm"
            variant="default"
            onClick={handleCopy}
            className="font-semibold w-full sm:w-auto sm:min-w-[120px] h-10 text-sm"
          >
            {copied ? "✓ Copied" : "Copy"}
          </Button>
          {secondaryAction}
        </div>
      </div>
      <div className="relative">
        {loading && (
          <div
            className="absolute inset-0 bg-background/60"
            aria-hidden="true"
          />
        )}
        <pre
          className={cn(
            "max-h-[640px] overflow-x-auto bg-transparent px-0 py-4 text-sm leading-6 text-foreground",
            loading && "opacity-80 blur-[1px]",
          )}
        >
          <code className="flex text-left min-w-0">
            <span className="select-none pr-4 pl-4 text-right text-muted-foreground shrink-0">
              {lines.map((_, idx) => (
                <span key={idx} className="block">
                  {idx + 1}
                </span>
              ))}
            </span>
            <span className="border-l border-border pr-4 shrink-0" />
            <span className="pl-4 text-foreground min-w-0">
              {lines.length ? (
                lines.map((line, idx) => (
                  <span
                    key={idx}
                    className="block whitespace-pre-wrap break-words"
                  >
                    {line || " "}
                  </span>
                ))
              ) : (
                <span className="block text-muted-foreground">
                  No content available.
                </span>
              )}
            </span>
          </code>
        </pre>
      </div>
    </div>
  );
}
