import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  OPS_TASKS_ENABLED,
  OPS_PLANS_DAILY_ENABLED,
  OPS_PLANS_WEEKLY_ENABLED,
  OPS_DATA_DIR,
  Identity,
  Projections,
  Storage,
} from "@aligntrue/ops-core";
import {
  TasksProjectionDef,
  buildTasksProjectionFromState,
  hashTasksProjection,
  DEFAULT_TASKS_EVENTS_PATH,
  createJsonlTaskLedger,
  TASK_COMMAND_TYPES,
  type TasksProjectionState,
  type TaskCommandType,
  type TaskCommandPayload,
  type TaskCommandEnvelope,
} from "@aligntrue/pack-tasks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getEventStore, getHost } from "@/lib/ops-services";

async function getTasksView() {
  if (!OPS_TASKS_ENABLED) return null;
  await getHost();
  const rebuilt = await Projections.rebuildOne(
    TasksProjectionDef,
    getEventStore(DEFAULT_TASKS_EVENTS_PATH),
  );
  const projection = buildTasksProjectionFromState(
    rebuilt.data as TasksProjectionState,
  );
  return {
    projection,
    hash: hashTasksProjection(projection),
  };
}

async function loadPlans() {
  const store = new Storage.JsonlArtifactStore(
    `${OPS_DATA_DIR}/pack-suggestions-query.jsonl`,
    `${OPS_DATA_DIR}/pack-suggestions-derived.jsonl`,
  );
  const derived = await store.listDerivedArtifacts();
  const daily = derived
    .filter((d) => d.output_type === "daily_plan")
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
  const weekly = derived
    .filter((d) => d.output_type === "weekly_plan")
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
  return { daily, weekly };
}

const ACTOR = {
  actor_id: "web-user",
  actor_type: "human",
  display_name: "Web User",
} as const;

type Bucket = "today" | "week" | "later" | "waiting";

function buildCommand<T extends TaskCommandType>(
  command_type: T,
  payload: TaskCommandPayload,
): TaskCommandEnvelope<T> {
  const target =
    "task_id" in payload
      ? `task:${(payload as { task_id: string }).task_id}`
      : "task:unknown";
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
  } as TaskCommandEnvelope<T>;
}

async function execute(command: TaskCommandEnvelope) {
  if (!OPS_TASKS_ENABLED) {
    throw new Error("Tasks are disabled");
  }
  const ledger = createJsonlTaskLedger();
  await ledger.execute(command);
  revalidatePath("/tasks");
}

async function createTaskAction(formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const task_id = Identity.deterministicId(title);
  await execute(
    buildCommand(TASK_COMMAND_TYPES.Create, {
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
    buildCommand(TASK_COMMAND_TYPES.Triage, {
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
    buildCommand(TASK_COMMAND_TYPES.Complete, {
      task_id,
    }),
  );
}

async function createDailyPlanAction(formData: FormData) {
  "use server";
  if (!OPS_PLANS_DAILY_ENABLED) {
    throw new Error("Daily plans are disabled");
  }
  const raw = String(formData.get("task_ids") ?? "");
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (!ids.length) return;

  await getHost();
  const rebuilt = await Projections.rebuildOne(
    TasksProjectionDef,
    getEventStore(DEFAULT_TASKS_EVENTS_PATH),
  );
  const projection = buildTasksProjectionFromState(
    rebuilt.data as TasksProjectionState,
  );
  const hash = hashTasksProjection(projection);
  const artifactStore = Suggestions.createArtifactStore();
  await Suggestions.buildAndStoreDailyPlan({
    task_ids: ids,
    date: new Date().toISOString().slice(0, 10),
    tasks_projection_hash: hash,
    actor: ACTOR,
    artifactStore,
    correlation_id: Identity.randomId(),
  });
  revalidatePath("/tasks");
}

async function generateWeeklyPlanAction(formData: FormData) {
  "use server";
  if (!OPS_PLANS_WEEKLY_ENABLED || !OPS_TASKS_ENABLED) return;

  const force = formData.get("force") === "on";
  await getHost();
  const store = Suggestions.createArtifactStore();
  const rebuilt = await Projections.rebuildOne(
    TasksProjectionDef,
    getEventStore(DEFAULT_TASKS_EVENTS_PATH),
  );
  const projection = buildTasksProjectionFromState(
    rebuilt.data as TasksProjectionState,
  );
  const hash = hashTasksProjection(projection);
  const memoryProvider = {
    async index(
      items: { entity_type: string; entity_id: string; content: string }[],
    ) {
      return { indexed: 0, skipped: items.length };
    },
    async query(_context: unknown) {
      return [];
    },
    enabled() {
      return false;
    },
  };

  await Suggestions.buildWeeklyPlan({
    actor: ACTOR,
    artifactStore: store,
    tasksProjection: projection,
    tasksProjectionHash: hash,
    correlation_id: crypto.randomUUID(),
    force,
    memoryProvider,
  });

  revalidatePath("/tasks");
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

  const [view, { daily, weekly }] = await Promise.all([
    getTasksView(),
    loadPlans(),
  ]);
  if (!view) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      {/* Quick Capture */}
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

      {/* Plans Section */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Plans</CardTitle>
          {OPS_PLANS_WEEKLY_ENABLED && OPS_TASKS_ENABLED && (
            <form
              action={generateWeeklyPlanAction}
              className="flex items-center gap-2"
            >
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" name="force" />
                Force
              </label>
              <Button type="submit" size="sm">
                Generate Weekly
              </Button>
            </form>
          )}
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="daily" className="space-y-4">
            <TabsList>
              <TabsTrigger value="daily">Daily MITs</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
            </TabsList>

            <TabsContent value="daily" className="space-y-3">
              {!OPS_PLANS_DAILY_ENABLED ? (
                <p className="text-sm text-muted-foreground">
                  Daily plans disabled. Set OPS_PLANS_DAILY_ENABLED=1.
                </p>
              ) : (
                <>
                  <form className="space-y-2" action={createDailyPlanAction}>
                    <Input
                      id="task_ids"
                      name="task_ids"
                      placeholder="task-1, task-2, task-3"
                    />
                    <p className="text-xs text-muted-foreground">
                      Provide up to 3 task ids, comma separated.
                    </p>
                    <Button type="submit" size="sm">
                      Create Daily MITs
                    </Button>
                  </form>
                  {daily.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {daily.slice(0, 3).map((plan) => {
                        const data =
                          plan.output_data as Suggestions.DailyPlanData;
                        return (
                          <div
                            key={plan.artifact_id}
                            className="rounded-md border p-2 text-sm"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{data.date}</span>
                              <Badge variant="outline">
                                {data.auto_generated ? "Auto" : "Manual"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Tasks: {data.task_ids.join(", ")}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="weekly" className="space-y-3">
              {!OPS_PLANS_WEEKLY_ENABLED ? (
                <p className="text-sm text-muted-foreground">
                  Weekly plans disabled. Set OPS_PLANS_WEEKLY_ENABLED=1.
                </p>
              ) : weekly.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No weekly plans yet. Click Generate Weekly to create one.
                </p>
              ) : (
                <div className="space-y-2">
                  {weekly.slice(0, 3).map((plan) => {
                    const data = plan.output_data as Suggestions.WeeklyPlanData;
                    return (
                      <div
                        key={plan.artifact_id}
                        className="rounded-md border p-2 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            Week starting {data.week_start}
                          </span>
                          <Badge variant="secondary">Weekly</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {data.task_refs.length} tasks •{" "}
                          {data.memory_refs.length} memories
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Task List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">All Tasks</h2>
        <div className="grid gap-4">
          {view.projection.tasks.map((task) => (
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
    </div>
  );
}
