"use client";

import { useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@aligntrue/ui-base";

import { SimulationResults } from "./SimulationResults";

type Result = Awaited<ReturnType<typeof fetchResult>>;

async function fetchResult(type: string, payload: unknown) {
  const path =
    type === "blast-radius"
      ? "/api/simulate/blast-radius"
      : type === "similar"
        ? "/api/simulate/similar"
        : "/api/simulate/change";
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Simulation failed: ${res.status}`);
  }
  return (await res.json()) as Result;
}

export function SimulationForm() {
  const [active, setActive] = useState<"blast-radius" | "similar" | "change">(
    "blast-radius",
  );
  const [entity, setEntity] = useState("");
  const [entities, setEntities] = useState("");
  const [stepPattern, setStepPattern] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      if (active === "blast-radius") {
        const payload = {
          entity_ref: entity.trim(),
        };
        setResult(await fetchResult(active, payload));
      } else if (active === "similar") {
        const payload = {
          entity_refs: entities
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          step_pattern: stepPattern
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        };
        setResult(await fetchResult(active, payload));
      } else {
        const payload = {
          affected_entities: entities
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          step_pattern: stepPattern
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        };
        setResult(await fetchResult(active, payload));
      }
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
          <CardTitle>Simulation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs
            value={active}
            onValueChange={(v) =>
              setActive(v as "blast-radius" | "similar" | "change")
            }
          >
            <TabsList>
              <TabsTrigger value="blast-radius">Blast radius</TabsTrigger>
              <TabsTrigger value="similar">Similar trajectories</TabsTrigger>
              <TabsTrigger value="change">Change simulation</TabsTrigger>
            </TabsList>
            <TabsContent value="blast-radius" className="space-y-3">
              <Input
                placeholder="entity_ref (e.g., gh_repo:owner/repo)"
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
              />
            </TabsContent>
            <TabsContent value="similar" className="space-y-3">
              <Textarea
                placeholder="entity_refs (comma-separated)"
                value={entities}
                onChange={(e) => setEntities(e.target.value)}
              />
              <Input
                placeholder="step pattern (comma-separated step types)"
                value={stepPattern}
                onChange={(e) => setStepPattern(e.target.value)}
              />
            </TabsContent>
            <TabsContent value="change" className="space-y-3">
              <Textarea
                placeholder="affected_entities (comma-separated)"
                value={entities}
                onChange={(e) => setEntities(e.target.value)}
              />
              <Input
                placeholder="step pattern (comma-separated step types)"
                value={stepPattern}
                onChange={(e) => setStepPattern(e.target.value)}
              />
            </TabsContent>
          </Tabs>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Running..." : "Run"}
          </Button>
          {error ? (
            <div className="text-sm text-destructive">{error}</div>
          ) : null}
        </CardContent>
      </Card>

      <SimulationResults result={result} />
    </div>
  );
}
