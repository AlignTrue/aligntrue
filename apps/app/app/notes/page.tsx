import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  OPS_NOTES_ENABLED,
  Identity,
  Storage,
  Notes,
  Projections,
} from "@aligntrue/ops-core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NotePreview } from "./NotePreview";

async function getNotesView() {
  if (!OPS_NOTES_ENABLED) return null;
  const rebuilt = await Projections.rebuildOne(
    Projections.NotesProjectionDef,
    new Storage.JsonlEventStore(Notes.DEFAULT_NOTES_EVENTS_PATH),
  );
  return Projections.buildNotesProjectionFromState(
    rebuilt.data as Projections.NotesProjectionState,
  );
}

function buildCommand<T extends Notes.NoteCommandType>(
  command_type: T,
  payload: Notes.NoteCommandPayload,
): Notes.NoteCommandEnvelope<T> {
  const target =
    "note_id" in payload
      ? `note:${(payload as { note_id: string }).note_id}`
      : "note:unknown";
  return {
    command_id: Identity.generateCommandId({ command_type, payload }),
    command_type,
    payload,
    target_ref: target,
    dedupe_scope: target,
    correlation_id: Identity.randomId(),
    actor: {
      actor_id: "web-user",
      actor_type: "human",
    },
    requested_at: new Date().toISOString(),
  } as Notes.NoteCommandEnvelope<T>;
}

async function execute(command: Notes.NoteCommandEnvelope) {
  if (!OPS_NOTES_ENABLED) {
    throw new Error("Notes are disabled");
  }
  const ledger = Notes.createJsonlNoteLedger();
  await ledger.execute(command);
  revalidatePath("/notes");
}

async function createNoteAction(formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "").trim();
  const body_md = String(formData.get("body_md") ?? "");
  if (!title) return;
  const note_id = Identity.deterministicId(title);
  await execute(
    buildCommand("note.create", {
      note_id,
      title,
      body_md,
      content_hash: "",
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
    buildCommand("note.update", {
      note_id,
      body_md,
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
