import { useCallback, useEffect, useRef, useState } from "react";

type CopyOptions = {
  resetAfterMs?: number;
};

export function useCopyToClipboard(options: CopyOptions = {}) {
  const { resetAfterMs = 1200 } = options;
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const copy = useCallback(
    async (text: string, onCopy?: () => void) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        onCopy?.();
        if (resetAfterMs) {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          timeoutRef.current = setTimeout(() => setCopied(false), resetAfterMs);
        }
      } catch (error) {
        console.error("copy failed", error);
      }
    },
    [resetAfterMs],
  );

  return { copied, copy };
}
