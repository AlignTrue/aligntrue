import { NextResponse } from "next/server";
import { OPS_NOTES_ENABLED, Identity } from "@aligntrue/ops-core";
import * as PackNotes from "@aligntrue/pack-notes";
import { getHost } from "@/lib/ops-services";

export async function POST(request: Request) {
  if (!OPS_NOTES_ENABLED) {
    return NextResponse.json({ error: "Notes disabled" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { title, body_md = "" } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const note_id = Identity.deterministicId(title);
    const command_type = PackNotes.NOTE_COMMAND_TYPES.Create;
    const payload: PackNotes.NoteCreatedPayload = {
      note_id,
      title: title.trim(),
      body_md,
      content_hash: Identity.hashCanonical(body_md),
    };

    const command: PackNotes.NoteCommandEnvelope<
      typeof PackNotes.NOTE_COMMAND_TYPES.Create
    > = {
      command_id: Identity.randomId(),
      idempotency_key: Identity.deterministicId({ title, body_md }),
      command_type,
      payload,
      target_ref: `note:${note_id}`,
      dedupe_scope: "target",
      correlation_id: Identity.randomId(),
      actor: {
        actor_id: "web-user",
        actor_type: "human",
      },
      requested_at: new Date().toISOString(),
    };

    const host = await getHost();
    await host.runtime.dispatchCommand(command);

    return NextResponse.json({
      success: true,
      note_id,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create note" },
      { status: 500 },
    );
  }
}
