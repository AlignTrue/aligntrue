import Link from "next/link";
import {
  OPS_TASKS_ENABLED,
  OPS_PLANS_DAILY_ENABLED,
  OPS_PLANS_WEEKLY_ENABLED,
} from "@aligntrue/core";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@aligntrue/ui-base";
import { TaskActions } from "@/components/TaskActions";
import {
  completeTaskAction,
  createDailyPlanAction,
  createTaskAction,
  generateWeeklyPlanAction,
  loadPlans,
  triageTaskAction,
} from "./actions";
import { getTasksView } from "@/lib/views";
import * as Suggestions from "@aligntrue/pack-suggestions";

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
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/tasks">+ New Task</Link>
        </Button>
      </div>

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
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-2 text-sm text-muted-foreground">
                  {task.impact ? <span>Impact:{task.impact}</span> : null}
                  {task.effort ? <span>Effort:{task.effort}</span> : null}
                  {task.due_at ? <span>Due:{task.due_at}</span> : null}
                </div>
                <TaskActions
                  taskId={task.id}
                  bucket={task.bucket}
                  status={task.status}
                  triageAction={triageTaskAction}
                  completeAction={completeTaskAction}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
