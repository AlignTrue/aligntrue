import { defineCommand } from "../../utils/command-router.js";
import { createNote } from "./create.js";
import { editNote } from "./edit.js";
import { listNotes } from "./list.js";
import { showNote } from "./show.js";
import { ensureNotesEnabled } from "./shared.js";

export const note = defineCommand({
  name: "note",
  guard: ensureNotesEnabled,
  subcommands: {
    create: {
      handler: createNote,
      description: "Create a note",
    },
    edit: {
      handler: editNote,
      description: "Edit a note in $EDITOR",
    },
    show: {
      handler: showNote,
      description: "Show a note",
    },
    list: {
      handler: listNotes,
      description: "List notes",
    },
  },
});
