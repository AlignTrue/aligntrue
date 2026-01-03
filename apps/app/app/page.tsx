import Link from "next/link";
import { OPS_NOTES_ENABLED, OPS_TASKS_ENABLED } from "@aligntrue/core";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@aligntrue/ui-base";

import { getNotesView, getTasksView } from "@/lib/views";

export const runtime = "nodejs";

export default async function HomePage() {
  const [tasksView, notesView] = await Promise.all([
    getTasksView(),
    getNotesView(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 py-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Tasks</CardTitle>
          {OPS_TASKS_ENABLED && (
            <Button asChild variant="outline" size="sm">
              <Link href="/tasks">+ New Task</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {!tasksView ? (
            <p className="text-sm text-muted-foreground">
              Tasks are disabled. Set OPS_TASKS_ENABLED=1 to enable tasks.
            </p>
          ) : tasksView.projection.tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks yet.</p>
          ) : (
            <div className="space-y-2">
              {tasksView.projection.tasks.slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className="rounded-md border border-border p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{task.title}</span>
                    <span className="text-xs uppercase text-muted-foreground">
                      {task.status === "completed" ? "Done" : task.bucket}
                    </span>
                  </div>
                  {task.due_at ? (
                    <p className="text-xs text-muted-foreground">
                      Due {task.due_at}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Notes</CardTitle>
          {OPS_NOTES_ENABLED && (
            <Button asChild variant="outline" size="sm">
              <Link href="/notes">+ New Note</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {!notesView ? (
            <p className="text-sm text-muted-foreground">
              Notes are disabled. Set OPS_NOTES_ENABLED=1 to enable notes.
            </p>
          ) : notesView.notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <div className="space-y-2">
              {notesView.notes.slice(0, 5).map((note) => (
                <div
                  key={note.id}
                  className="rounded-md border border-border p-3"
                >
                  <div className="font-medium">{note.title}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
