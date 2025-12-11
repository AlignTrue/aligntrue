import { useEffect } from "react";

export function useVisibilityRecovery(onResume?: () => void) {
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        onResume?.();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [onResume]);
}
