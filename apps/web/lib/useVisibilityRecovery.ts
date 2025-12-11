import { useEffect } from "react";

type Options = {
  onResume?: () => void;
};

export function useVisibilityRecovery(options?: Options) {
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        options?.onResume?.();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [options]);
}
