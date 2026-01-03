"use client";

import type { Simulation } from "@aligntrue/core";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from "@aligntrue/ui-base";

type Result =
  | Simulation.BlastRadiusResult
  | Simulation.SimilarTrajectoriesResult
  | Simulation.ChangeSimulationResult
  | null;

export function SimulationResults({ result }: { result: Result }) {
  if (!result) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Results</CardTitle>
        <div className="text-sm text-muted-foreground">
          confidence {result.confidence.toFixed(2)} · sample{" "}
          {result.sample_size}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {"predicted_outcomes" in result ? (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Predicted outcomes</h3>
            {result.predicted_outcomes.map((p) => (
              <div
                key={p.outcome}
                className="flex items-center justify-between"
              >
                <span>{p.outcome}</span>
                <span className="text-sm text-muted-foreground">
                  {(p.probability * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {"affected_entities" in result ? (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Affected entities</h3>
            <div className="flex flex-wrap gap-2">
              {result.affected_entities.map((a) => (
                <Badge key={a.entity_ref} variant="outline">
                  {a.entity_ref} ({a.impact_score.toFixed(2)})
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {"trajectories" in result ? (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Similar trajectories</h3>
            <div className="space-y-1">
              {result.trajectories.map((t) => (
                <div
                  key={t.trajectory_id}
                  className="flex items-center justify-between"
                >
                  <span className="truncate">{t.trajectory_id}</span>
                  <span className="text-sm text-muted-foreground">
                    {(t.similarity_score * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {"risk_factors" in result ? (
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Risk factors</h3>
            <div className="space-y-1">
              {result.risk_factors.map((f, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span>{f.factor}</span>
                  <span className="text-sm text-muted-foreground">
                    {(f.contribution * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Evidence</h3>
          <div className="space-y-1 text-sm text-muted-foreground">
            {result.evidence.length === 0 ? (
              <div>No evidence</div>
            ) : (
              result.evidence.map((e) => (
                <div
                  key={e.trajectory_id}
                  className="flex items-center justify-between"
                >
                  <span className="truncate">{e.trajectory_id}</span>
                  <span>{e.weight.toFixed(2)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          algorithm {result.algorithm_version} · features{" "}
          {result.feature_schema_version}
        </div>
      </CardContent>
    </Card>
  );
}
