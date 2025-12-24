import { NextRequest, NextResponse } from "next/server";
import { Emails, OPS_EMAIL_STATUS_ENABLED } from "@aligntrue/ops-core";
import { getEventStore } from "@/lib/ops-services";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!OPS_EMAIL_STATUS_ENABLED) {
    return NextResponse.json(
      { error: "Email status transitions are disabled" },
      { status: 403 },
    );
  }

  const payload = (await request.json().catch(() => ({}))) as {
    from_status?: Emails.EmailStatus;
    to_status?: Emails.EmailStatus;
    trigger?: Emails.TransitionTrigger;
    resolution?: Emails.EmailResolution;
    assessment_id?: string;
    slice_kind?: Emails.SliceKind;
    reason?: string;
  };

  if (!payload.from_status || !payload.to_status || !payload.trigger) {
    return NextResponse.json(
      { error: "from_status, to_status, and trigger are required" },
      { status: 400 },
    );
  }

  let event;
  try {
    event = Emails.buildEmailStatusChangedEvent(
      {
        source_ref: id,
        from_status: payload.from_status,
        to_status: payload.to_status,
        trigger: payload.trigger,
        ...(payload.resolution ? { resolution: payload.resolution } : {}),
        ...(payload.assessment_id
          ? { assessment_id: payload.assessment_id }
          : {}),
        ...(payload.slice_kind ? { slice_kind: payload.slice_kind } : {}),
        ...(payload.reason ? { reason: payload.reason } : {}),
      },
      new Date().toISOString(),
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Validation failed" },
      { status: 400 },
    );
  }

  const store = getEventStore();
  await store.append(event);

  return NextResponse.json({ event_id: event.event_id });
}
