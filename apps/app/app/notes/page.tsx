import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { OPS_NOTES_ENABLED, Identity } from "@aligntrue/core";
import * as PackNotes from "@aligntrue/pack-notes";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
} from "@aligntrue/ui-base";
import { getNotesView } from "@/lib/views";
import { NotePreview } from "./NotePreview";
import { getHost } from "@/lib/ops-services";

function buildCommand<T extends PackNotes.NoteCommandType>(
  command_type: T,
  payload: PackNotes.NoteCommandPayload,
): PackNotes.NoteCommandEnvelope<T> {
  const target =
    "note_id" in payload
      ? `note:${(payload as { note_id: string }).note_id}`
      : "note:unknown";
  const idempotency_key = Identity.generateCommandId({ command_type, payload });
  return {
    command_id: Identity.randomId(),
    idempotency_key,
    command_type,
    payload,
    target_ref: target,
    dedupe_scope: "target",
    correlation_id: Identity.randomId(),
    actor: {
      actor_id: "web-user",
      actor_type: "human",
    },
    requested_at: new Date().toISOString(),
  } as PackNotes.NoteCommandEnvelope<T>;
}

async function execute(command: PackNotes.NoteCommandEnvelope) {
  if (!OPS_NOTES_ENABLED) {
    throw new Error("Notes are disabled");
  }
  const host = await getHost();
  await host.runtime.dispatchCommand(command);
  revalidatePath("/notes");
}

async function createNoteAction(formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "").trim();
  const body_md = String(formData.get("body_md") ?? "");
  if (!title) return;
  const note_id = Identity.deterministicId(title);
  await execute(
    buildCommand(PackNotes.NOTE_COMMAND_TYPES.Create, {
      note_id,
      title,
      body_md,
      content_hash: Identity.hashCanonical(body_md),
    }),
  );
  redirect("/notes");
}

async function updateNoteAction(formData: FormData) {
  "use server";
  const note_id = String(formData.get("note_id") ?? "");
  const body_md = String(formData.get("body_md") ?? "");
  if (!note_id) return;
  await execute(
    buildCommand(PackNotes.NOTE_COMMAND_TYPES.Update, {
      note_id,
      body_md,
      content_hash: Identity.hashCanonical(body_md),
    }),
  );
}

export default async function NotesPage() {
  if (!OPS_NOTES_ENABLED) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Notes are disabled</CardTitle>
          </CardHeader>
          <CardContent>Set OPS_NOTES_ENABLED=1 to enable notes.</CardContent>
        </Card>
      </div>
    );
  }

  const projection = await getNotesView();
  if (!projection) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Notes</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/notes">+ New Note</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Note</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" action={createNoteAction}>
            <Input name="title" placeholder="Title" required />
            <Textarea name="body_md" placeholder="Write markdown..." rows={4} />
            <Button type="submit">Create</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {projection.notes.map((note) => (
          <Card key={note.id}>
            <CardHeader>
              <CardTitle className="text-base">{note.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{note.id}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <NotePreview noteId={note.id} body={note.body_md} />
              <form className="space-y-2" action={updateNoteAction}>
                <input type="hidden" name="note_id" value={note.id} />
                <Textarea
                  name="body_md"
                  defaultValue={note.body_md}
                  rows={4}
                  className="font-mono text-sm"
                />
                <div className="flex items-center justify-end gap-2">
                  <Button type="submit" variant="secondary">
                    Save
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
