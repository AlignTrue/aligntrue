import { NextResponse } from "next/server";
import { OPS_NOTES_ENABLED, Identity, Notes } from "@aligntrue/ops-core";

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
    const command_type = "note.create";
    const payload = {
      note_id,
      title: title.trim(),
      body_md,
      content_hash: "",
    } as Notes.NoteCommandPayload;

    const command: Notes.NoteCommandEnvelope = {
      command_id: Identity.generateCommandId({ command_type, payload }),
      command_type,
      payload,
      target_ref: `note:${note_id}`,
      dedupe_scope: `note:${note_id}`,
      correlation_id: Identity.randomId(),
      actor: {
        actor_id: "web-user",
        actor_type: "human",
      },
      requested_at: new Date().toISOString(),
    };

    const ledger = Notes.createJsonlNoteLedger();
    await ledger.execute(command);

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
