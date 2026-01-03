"use client";

import { useState } from "react";
import { Badge, Card, CardContent } from "@aligntrue/ui-base";
import type { TrajectoryEvent, OutcomeRecorded } from "@aligntrue/core";

type Props = {
  steps: TrajectoryEvent[];
  outcomes: OutcomeRecorded[];
};

export function TrajectoryTimeline({ steps, outcomes }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-3">
      {steps.map((step) => (
        <Card key={step.step_id}>
          <CardContent className="space-y-2 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{step.step_type}</Badge>
                <span className="text-xs text-muted-foreground">
                  {step.timestamp}
                </span>
              </div>
              <button
                className="text-xs text-primary hover:underline"
                onClick={() =>
                  setExpanded((prev) => ({
                    ...prev,
                    [step.step_id]: !prev[step.step_id],
                  }))
                }
              >
                {expanded[step.step_id] ? "Hide" : "Show"} details
              </button>
            </div>
            <div className="text-xs text-muted-foreground">
              prev_step_hash: {step.prev_step_hash ?? "null"}
            </div>
            {expanded[step.step_id] ? (
              <pre className="whitespace-pre-wrap break-all rounded-md bg-muted p-2 text-xs">
                {JSON.stringify(
                  {
                    payload: step.payload,
                    causation: step.causation,
                    refs: step.refs,
                  },
                  null,
                  2,
                )}
              </pre>
            ) : null}
          </CardContent>
        </Card>
      ))}

      {outcomes.length ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Outcomes</h3>
          {outcomes.map((o) => (
            <Card key={o.outcome_id}>
              <CardContent className="space-y-1 py-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{o.kind}</Badge>
                  <span className="text-xs text-muted-foreground">
                    severity {o.severity}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {o.timestamp}
                </div>
                {o.notes ? <p className="text-sm">{o.notes}</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
