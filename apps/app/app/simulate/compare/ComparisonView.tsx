"use client";

import { useState } from "react";
import { Simulation } from "@aligntrue/core";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
} from "@aligntrue/ui-base";

import { SimulationResults } from "../SimulationResults";

async function runChange(
  payload: unknown,
): Promise<Simulation.ChangeSimulationResult> {
  const res = await fetch("/api/simulate/change", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Simulation failed: ${res.status}`);
  }
  return await res.json();
}

export function ComparisonView() {
  const [leftEntities, setLeftEntities] = useState("");
  const [rightEntities, setRightEntities] = useState("");
  const [leftSteps, setLeftSteps] = useState("");
  const [rightSteps, setRightSteps] = useState("");
  const [leftResult, setLeftResult] =
    useState<Simulation.ChangeSimulationResult | null>(null);
  const [rightResult, setRightResult] =
    useState<Simulation.ChangeSimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runBoth = async () => {
    setLoading(true);
    setError(null);
    try {
      const buildPayload = (entities: string, steps: string) => ({
        affected_entities: entities
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        step_pattern: steps
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      const [left, right] = await Promise.all([
        runChange(buildPayload(leftEntities, leftSteps)),
        runChange(buildPayload(rightEntities, rightSteps)),
      ]);
      setLeftResult(left);
      setRightResult(right);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Forked futures comparison</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="text-sm font-semibold">Scenario A</div>
            <Textarea
              placeholder="affected_entities (comma-separated)"
              value={leftEntities}
              onChange={(e) => setLeftEntities(e.target.value)}
            />
            <Input
              placeholder="step pattern (comma-separated)"
              value={leftSteps}
              onChange={(e) => setLeftSteps(e.target.value)}
            />
          </div>
          <div className="space-y-3">
            <div className="text-sm font-semibold">Scenario B</div>
            <Textarea
              placeholder="affected_entities (comma-separated)"
              value={rightEntities}
              onChange={(e) => setRightEntities(e.target.value)}
            />
            <Input
              placeholder="step pattern (comma-separated)"
              value={rightSteps}
              onChange={(e) => setRightSteps(e.target.value)}
            />
          </div>
        </CardContent>
        <div className="px-6 pb-6">
          <Button onClick={runBoth} disabled={loading}>
            {loading ? "Comparing..." : "Compare"}
          </Button>
          {error ? (
            <div className="mt-2 text-sm text-destructive">{error}</div>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm font-semibold">Scenario A</div>
          <SimulationResults result={leftResult} />
        </div>
        <div className="space-y-2">
          <div className="text-sm font-semibold">Scenario B</div>
          <SimulationResults result={rightResult} />
        </div>
      </div>
    </div>
  );
}
