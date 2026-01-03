import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@aligntrue/ui-base";
import { OPS_TRAJECTORIES_ENABLED } from "@aligntrue/core";

import { getTrajectoryList } from "@/lib/trajectory-views";

export const runtime = "nodejs";

export default async function TrajectoriesPage({
  searchParams,
}: {
  searchParams?: {
    entity_ref?: string;
    time_after?: string;
    time_before?: string;
    cursor?: string;
  };
}) {
  if (!OPS_TRAJECTORIES_ENABLED) {
    notFound();
  }

  const res = await getTrajectoryList({
    entity_ref: searchParams?.entity_ref,
    time_after: searchParams?.time_after,
    time_before: searchParams?.time_before,
    cursor: searchParams?.cursor,
  });

  if (!res) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Trajectories</h1>
        <div className="text-sm text-muted-foreground">
          {res.trajectories.length} shown
        </div>
      </div>

      {res.trajectories.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No trajectories yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {res.trajectories.map((traj) => (
            <Card key={traj.trajectory_id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">
                    <Link
                      href={`/trajectories/${encodeURIComponent(traj.trajectory_id)}`}
                      className="hover:underline"
                    >
                      {traj.trajectory_id}
                    </Link>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Steps: {traj.step_count} ·{" "}
                    {traj.last_timestamp ?? "unknown time"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {traj.outcome_kinds.length ? (
                    traj.outcome_kinds.map((kind) => (
                      <Badge key={kind} variant="outline">
                        {kind}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="secondary">pending</Badge>
                  )}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
