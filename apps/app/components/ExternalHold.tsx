"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { HoldState } from "@/app/api/hold/route";

interface Props {
  initialState?: HoldState;
}

export function ExternalHold({ initialState }: Props) {
  const [holdState, setHoldState] = useState<HoldState>(
    initialState ?? {
      externalHold: true,
      heldActionsCount: 0,
    },
  );
  const [loading, setLoading] = useState(false);

  // Fetch initial state on mount
  useEffect(() => {
    fetch("/api/hold")
      .then((res) => res.json())
      .then((data: HoldState) => setHoldState(data))
      .catch(() => {
        // Keep default state on error
      });
  }, []);

  const handleToggle = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle" }),
      });

      if (res.ok) {
        const data = (await res.json()) as HoldState;
        setHoldState(data);
      }
    } catch {
      // Optimistic update on failure
      setHoldState((s) => ({
        ...s,
        externalHold: !s.externalHold,
        enabledAt: !s.externalHold ? new Date().toISOString() : undefined,
      }));
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant={holdState.externalHold ? "default" : "outline"}
        onClick={handleToggle}
        disabled={loading}
        className={`gap-2 ${holdState.externalHold ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}`}
      >
        {holdState.externalHold ? (
          <svg
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
        ) : (
          <svg
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )}
        HOLD External
      </Button>

      {holdState.externalHold && (
        <Badge variant="secondary" className="bg-amber-100 text-amber-800">
          {holdState.heldActionsCount > 0
            ? `${holdState.heldActionsCount} held`
            : "Active"}
        </Badge>
      )}
    </div>
  );
}
