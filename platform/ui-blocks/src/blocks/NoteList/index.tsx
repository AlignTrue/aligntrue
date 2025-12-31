import React from "react";
import { BlockEmpty } from "../../ui/BlockEmpty.js";
import { BlockList } from "../../ui/BlockList.js";
import { BlockStack } from "../../ui/BlockStack.js";
import { noteListManifest } from "./manifest.js";

export interface NoteListItem {
  id: string;
  title: string;
  updated_at?: string;
}

export interface NoteListProps {
  title: string;
  notes: NoteListItem[];
}

export function NoteList({ title, notes }: NoteListProps) {
  return (
    <BlockStack>
      {title ? <h4 className="text-sm font-semibold">{title}</h4> : null}
      {notes.length === 0 ? (
        <BlockEmpty>No notes</BlockEmpty>
      ) : (
        <BlockList>
          {notes.map((note) => (
            <li key={note.id} className="px-3 py-2">
              <div className="text-sm text-foreground">{note.title}</div>
              {note.updated_at ? (
                <div className="text-xs text-muted-foreground">
                  Updated {note.updated_at}
                </div>
              ) : null}
            </li>
          ))}
        </BlockList>
      )}
    </BlockStack>
  );
}

export { noteListManifest };
