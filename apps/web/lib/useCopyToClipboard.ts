import { useCallback, useState } from "react";

type CopyOptions = {
  resetAfterMs?: number;
};

export function useCopyToClipboard(options: CopyOptions = {}) {
  const { resetAfterMs = 1200 } = options;
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string, onCopy?: () => void) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        onCopy?.();
        if (resetAfterMs) {
          setTimeout(() => setCopied(false), resetAfterMs);
        }
      } catch (error) {
        console.error("copy failed", error);
      }
    },
    [resetAfterMs],
  );

  return { copied, copy };
}
