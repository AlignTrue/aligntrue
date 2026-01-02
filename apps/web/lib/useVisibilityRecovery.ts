import { useEffect, useRef } from "react";

export function useVisibilityRecovery(onResume?: () => void) {
  const resumeRef = useRef(onResume);

  useEffect(() => {
    resumeRef.current = onResume;
  }, [onResume]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        resumeRef.current?.();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);
}
