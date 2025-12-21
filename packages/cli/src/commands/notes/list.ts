import { ensureNotesEnabled, readNotesProjection } from "./shared.js";

export async function listNotes(): Promise<void> {
  ensureNotesEnabled();
  const projection = await readNotesProjection();

  if (!projection.notes.length) {
    console.log("No notes found");
    return;
  }

  for (const note of projection.notes) {
    const preview = note.body_md.split("\n")[0] ?? "";
    console.log(`- ${note.id} ${note.title}${preview ? ` — ${preview}` : ""}`);
  }
}
