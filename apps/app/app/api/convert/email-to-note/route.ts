import { NextResponse } from "next/server";
import { getHost, dispatchConvertCommand } from "@/lib/ops-services";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.message_id !== "string") {
    return NextResponse.json(
      { error: "message_id is required" },
      { status: 400 },
    );
  }

  try {
    await getHost();
    const actor = { actor_id: "web-user", actor_type: "human" as const };
    const { outcome } = await dispatchConvertCommand(
      "note",
      body.message_id,
      actor,
      {
        title: typeof body.title === "string" ? body.title : undefined,
        body_md: typeof body.body_md === "string" ? body.body_md : undefined,
      },
    );

    return NextResponse.json({
      status: outcome.status,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to convert email" },
      { status: 400 },
    );
  }
}
