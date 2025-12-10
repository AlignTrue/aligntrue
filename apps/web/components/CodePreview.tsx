import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

type CodePreviewProps = {
  filename?: string;
  content: string;
  loading?: boolean;
};

export function CodePreview({
  filename = "rules.md",
  content,
  loading,
}: CodePreviewProps) {
  const [copied, setCopied] = useState(false);

  const lines = content ? content.split("\n") : [];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      console.error("Failed to copy code", err);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-[hsl(222_24%_8%)] text-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[hsl(222_24%_10%)]">
        <div className="flex items-center gap-2 text-sm font-medium text-white/70">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <span className="ml-2">{filename}</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCopy}
          className="h-8 px-3 text-xs font-semibold border-white/20 text-white hover:bg-white/10"
        >
          {copied ? "✓ Copied" : "Copy"}
        </Button>
      </div>
      <div className="relative">
        {loading && (
          <div
            className="absolute inset-0 bg-white/5 backdrop-blur-[1px]"
            aria-hidden="true"
          />
        )}
        <pre
          className={cn(
            "max-h-[640px] overflow-auto bg-transparent px-0 py-4 text-sm leading-6",
            loading && "opacity-80",
          )}
        >
          <code className="flex text-left">
            <span className="select-none pr-4 pl-4 text-right text-white/40">
              {lines.map((_, idx) => (
                <span key={idx} className="block">
                  {idx + 1}
                </span>
              ))}
            </span>
            <span className="border-l border-white/10 pr-4" />
            <span className="pl-4 text-white/90">
              {lines.length ? (
                lines.map((line, idx) => (
                  <span key={idx} className="block whitespace-pre-wrap">
                    {line || " "}
                  </span>
                ))
              ) : (
                <span className="block text-white/50">
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
