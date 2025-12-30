import { NextResponse } from "next/server";
import { OPS_NOTES_ENABLED, Identity, Notes } from "@aligntrue/ops-core";

export async function POST(request: Request) {
  if (!OPS_NOTES_ENABLED) {
    return NextResponse.json({ error: "Notes disabled" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.note_id !== "string" ||
    typeof body.line_index !== "number"
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const payload = { note_id: body.note_id, line_index: body.line_index };
  const command: Notes.NoteCommandEnvelope<"note.patch_checkbox"> = {
    command_id: Identity.randomId(),
    idempotency_key: Identity.deterministicId({
      note_id: body.note_id,
      line_index: body.line_index,
    }),
    command_type: "note.patch_checkbox",
    payload,
    target_ref: `note:${payload.note_id}`,
    dedupe_scope: "target",
    correlation_id: Identity.randomId(),
    actor: { actor_id: "web-user", actor_type: "human" },
    requested_at: new Date().toISOString(),
  };

  const ledger = Notes.createJsonlNoteLedger();

  try {
    const outcome = await ledger.execute(command);
    return NextResponse.json({ status: outcome.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to toggle" },
      { status: 400 },
    );
  }
}
