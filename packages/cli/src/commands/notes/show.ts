import { exitWithError } from "../../utils/command-utilities.js";
import { ensureNotesEnabled, readNotesProjection } from "./shared.js";

export async function showNote(args: string[]): Promise<void> {
  ensureNotesEnabled();
  const noteId = args[0];
  if (!noteId) {
    exitWithError(2, "Note ID is required", {
      hint: "Usage: aligntrue note show <id>",
    });
  }

  const projection = await readNotesProjection();
  const note = projection.notes.find((n) => n.id === noteId);
  if (!note) {
    exitWithError(1, `Note ${noteId} not found`);
  }

  console.log(`# ${note.title}\n`);
  console.log(note.body_md);
}
