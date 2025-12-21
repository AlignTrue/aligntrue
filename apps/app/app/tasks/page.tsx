import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  OPS_TASKS_ENABLED,
  Identity,
  Storage,
  Tasks,
  Projections,
} from "@aligntrue/ops-core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

async function getTasksView() {
  if (!OPS_TASKS_ENABLED) return null;
  const rebuilt = await Projections.rebuildOne(
    Projections.TasksProjectionDef,
    new Storage.JsonlEventStore(Tasks.DEFAULT_TASKS_EVENTS_PATH),
  );
  return Projections.buildTasksProjectionFromState(
    rebuilt.data as Projections.TasksProjectionState,
  );
}

type Bucket = "today" | "week" | "later" | "waiting";

function buildCommand<T extends Tasks.TaskCommandType>(
  command_type: T,
  payload: Tasks.TaskCommandPayload,
): Tasks.TaskCommandEnvelope<T> {
  const target =
    "task_id" in payload
      ? `task:${(payload as { task_id: string }).task_id}`
      : "task:unknown";
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
  } as Tasks.TaskCommandEnvelope<T>;
}

async function execute(command: Tasks.TaskCommandEnvelope) {
  if (!OPS_TASKS_ENABLED) {
    throw new Error("Tasks are disabled");
  }
  const ledger = Tasks.createJsonlTaskLedger();
  await ledger.execute(command);
  revalidatePath("/tasks");
}

async function createTaskAction(formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const task_id = Identity.deterministicId(title);
  await execute(
    buildCommand("task.create", {
      task_id,
      title,
      bucket: "today",
      status: "open",
    }),
  );
  redirect("/tasks");
}

async function triageTaskAction(formData: FormData) {
  "use server";
  const task_id = String(formData.get("task_id") ?? "");
  const bucket = String(formData.get("bucket") ?? "") as Bucket;
  if (!task_id || !bucket) return;
  await execute(
    buildCommand("task.triage", {
      task_id,
      bucket,
    }),
  );
}

async function completeTaskAction(formData: FormData) {
  "use server";
  const task_id = String(formData.get("task_id") ?? "");
  if (!task_id) return;
  await execute(
    buildCommand("task.complete", {
      task_id,
    }),
  );
}

export default async function TasksPage() {
  if (!OPS_TASKS_ENABLED) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Tasks are disabled</CardTitle>
          </CardHeader>
          <CardContent>Set OPS_TASKS_ENABLED=1 to enable tasks.</CardContent>
        </Card>
      </div>
    );
  }

  const projection = await getTasksView();
  if (!projection) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Quick Capture</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3 sm:flex-row"
            action={createTaskAction}
          >
            <Input
              className="flex-1"
              id="title"
              name="title"
              placeholder="Write task title..."
              required
            />
            <Button type="submit" className="self-end sm:self-auto">
              Add Task
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {projection.tasks.map((task) => (
          <Card key={task.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{task.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{task.id}</p>
              </div>
              <span className="text-sm uppercase text-muted-foreground">
                {task.status === "completed" ? "Done" : task.bucket}
              </span>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2 text-sm text-muted-foreground">
                {task.impact ? <span>Impact:{task.impact}</span> : null}
                {task.effort ? <span>Effort:{task.effort}</span> : null}
                {task.due_at ? <span>Due:{task.due_at}</span> : null}
              </div>
              <div className="flex items-center gap-2">
                <form
                  action={triageTaskAction}
                  className="flex items-center gap-2"
                >
                  <input type="hidden" name="task_id" value={task.id} />
                  <select
                    name="bucket"
                    defaultValue={task.bucket}
                    className="h-9 rounded-md border px-2 text-sm"
                  >
                    <option value="today">Today</option>
                    <option value="week">Week</option>
                    <option value="later">Later</option>
                    <option value="waiting">Waiting</option>
                  </select>
                  <Button type="submit" variant="secondary">
                    Save
                  </Button>
                </form>
                {task.status === "completed" ? null : (
                  <form action={completeTaskAction}>
                    <input type="hidden" name="task_id" value={task.id} />
                    <Button type="submit" variant="outline">
                      Complete
                    </Button>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
