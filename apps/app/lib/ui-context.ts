import { deterministicId } from "@aligntrue/ops-core";
import type { InputRef } from "@aligntrue/ui-contracts";
import type { TasksProjection } from "@aligntrue/pack-tasks";
import type { NotesProjection } from "@aligntrue/pack-notes";
import { readTasksProjection } from "./projections/tasks";
import { readNotesProjection } from "./projections/notes";

export interface TaskViewItem {
  id: string;
  title: string;
  bucket: string;
  status: string;
  due_at?: string;
}

export interface NoteViewItem {
  id: string;
  title: string;
  updated_at?: string;
}

export interface UIContext {
  tasks: { items: TaskViewItem[]; counts: Record<string, number> };
  notes: { items: NoteViewItem[] };
  intent: "list" | "detail" | "create" | "dashboard";
  scope: "today" | "week" | "all" | "search";
  context_hash: string;
  input_refs?: InputRef[];
}

export interface ContextOpts {
  intent: UIContext["intent"];
  scope: UIContext["scope"];
}

export async function buildUIContext(opts: ContextOpts): Promise<UIContext> {
  const [tasks, notes] = await Promise.all([
    readTasksProjection(),
    readNotesProjection(),
  ]);

  const tasksVM = buildTasksViewModel(tasks);
  const notesVM = buildNotesViewModel(notes);

  const context_hash = deterministicId({
    tasks: tasksVM,
    notes: notesVM,
    intent: opts.intent,
    scope: opts.scope,
  });

  return {
    tasks: tasksVM,
    notes: notesVM,
    intent: opts.intent,
    scope: opts.scope,
    context_hash,
  };
}

export function buildTasksViewModel(projection: TasksProjection | null): {
  items: TaskViewItem[];
  counts: Record<string, number>;
} {
  if (!projection) return { items: [], counts: {} };
  const counts: Record<string, number> = {};
  const items: TaskViewItem[] = projection.tasks.slice(0, 25).map((task) => {
    counts[task.bucket] = (counts[task.bucket] ?? 0) + 1;
    return {
      id: task.id,
      title: task.title,
      bucket: task.bucket,
      status: task.status,
      due_at: task.due_at ?? undefined,
    };
  });
  return { items, counts };
}

export function buildNotesViewModel(projection: NotesProjection | null): {
  items: NoteViewItem[];
} {
  if (!projection) return { items: [] };
  const items: NoteViewItem[] = projection.notes.slice(0, 25).map((note) => ({
    id: note.id,
    title: note.title ?? note.id,
    updated_at: note.updated_at,
  }));
  return { items };
}
