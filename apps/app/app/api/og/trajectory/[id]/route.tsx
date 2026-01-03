import { ImageResponse } from "next/og";

import { OPS_TRAJECTORIES_ENABLED } from "@aligntrue/core";

import { getTrajectoryDetail } from "@/lib/trajectory-views";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!OPS_TRAJECTORIES_ENABLED) {
    return new Response("Trajectories disabled", { status: 404 });
  }
  const trajectory_id = decodeURIComponent(params.id);
  const detail = await getTrajectoryDetail(trajectory_id);

  const primaryOutcome = detail.outcomes[0]?.kind ?? "pending";
  const stepCount = detail.steps.length;
  const entities = detail.entity_refs.slice(0, 6).join(" · ");

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "48px",
        background: "#0B1220",
        color: "white",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ fontSize: 24, opacity: 0.8 }}>AlignTrue · Trajectory</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 36, fontWeight: 700, wordBreak: "break-all" }}>
          {trajectory_id}
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 22 }}>
          <span>Steps: {stepCount}</span>
          <span>Outcome: {primaryOutcome}</span>
        </div>
        {entities ? (
          <div style={{ fontSize: 18, opacity: 0.9 }}>Entities: {entities}</div>
        ) : null}
      </div>
      <div style={{ fontSize: 18, opacity: 0.7 }}>
        shareable · deterministic · auditable
      </div>
    </div>,
    { ...size },
  );
}
