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

import { TrajectoryTimeline } from "../TrajectoryTimeline";
import { getTrajectoryDetail } from "@/lib/trajectory-views";

export const runtime = "nodejs";

export default async function TrajectoryDetailPage({
  params,
}: {
  params: { id: string };
}) {
  if (!OPS_TRAJECTORIES_ENABLED) {
    notFound();
  }

  const trajectory_id = decodeURIComponent(params.id);
  const detail = await getTrajectoryDetail(trajectory_id);
  if (!detail) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold break-all">
            Trajectory {trajectory_id}
          </h1>
          <p className="text-sm text-muted-foreground">
            {detail.steps.length} steps
          </p>
        </div>
        <Link
          href={`/api/og/trajectory/${encodeURIComponent(trajectory_id)}`}
          className="text-sm text-primary hover:underline"
        >
          Share OG image
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entities</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {detail.entity_refs.length === 0 ? (
            <span className="text-sm text-muted-foreground">None</span>
          ) : (
            detail.entity_refs.map((ref) => (
              <Badge key={ref} variant="outline">
                {ref}
              </Badge>
            ))
          )}
        </CardContent>
      </Card>

      <TrajectoryTimeline steps={detail.steps} outcomes={detail.outcomes} />
    </div>
  );
}
