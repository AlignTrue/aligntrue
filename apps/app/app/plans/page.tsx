import { revalidatePath } from "next/cache";
import {
  Memory,
  OPS_MEMORY_PROVIDER_ENABLED,
  OPS_PLANS_WEEKLY_ENABLED,
  OPS_TASKS_ENABLED,
  Projections,
  Suggestions,
  Tasks,
} from "@aligntrue/ops-core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getEventStore } from "@/lib/ops-services";

const ACTOR = {
  actor_id: "web-user",
  actor_type: "human",
  display_name: "Web User",
} as const;

async function loadPlans() {
  const store = Suggestions.createArtifactStore();
  const derived = await store.listDerivedArtifacts();
  const daily = derived
    .filter((d) => d.output_type === "daily_plan")
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
  const weekly = derived
    .filter((d) => d.output_type === "weekly_plan")
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
  return { daily, weekly };
}

async function generateWeeklyPlanAction(formData: FormData) {
  "use server";
  if (!OPS_PLANS_WEEKLY_ENABLED || !OPS_TASKS_ENABLED) return;

  const force = formData.get("force") === "on";
  const store = Suggestions.createArtifactStore();
  const rebuilt = await Projections.rebuildOne(
    Projections.TasksProjectionDef,
    getEventStore(Tasks.DEFAULT_TASKS_EVENTS_PATH),
  );
  const projection = Projections.buildTasksProjectionFromState(
    rebuilt.data as Projections.TasksProjectionState,
  );
  const hash = Projections.hashTasksProjection(projection);
  const memoryProvider = OPS_MEMORY_PROVIDER_ENABLED
    ? new Memory.Mem0Adapter()
    : new Memory.NoOpMemoryProvider();

  await Suggestions.buildWeeklyPlan({
    actor: ACTOR,
    artifactStore: store,
    tasksProjection: projection,
    tasksProjectionHash: hash,
    correlation_id: crypto.randomUUID(),
    force,
    memoryProvider,
  });

  revalidatePath("/plans");
}

export default async function PlansPage() {
  const { daily, weekly } = await loadPlans();

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Plans</h1>
          <p className="text-sm text-muted-foreground">
            Daily MITs and weekly plans. Data is read from local JSONL
            artifacts.
          </p>
        </div>
        {OPS_PLANS_WEEKLY_ENABLED && OPS_TASKS_ENABLED ? (
          <form
            action={generateWeeklyPlanAction}
            className="flex items-center gap-2"
          >
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name="force" />
              Force (bypass stability window)
            </label>
            <Button type="submit">Generate Weekly Plan</Button>
          </form>
        ) : (
          <Badge variant="outline">Weekly plans disabled</Badge>
        )}
      </div>

      <Tabs defaultValue="weekly" className="space-y-4">
        <TabsList>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="daily">Daily</TabsTrigger>
        </TabsList>
        <TabsContent value="weekly" className="space-y-3">
          {weekly.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                No weekly plans yet.
              </CardContent>
            </Card>
          ) : (
            weekly.map((plan) => {
              const data = plan.output_data as Suggestions.WeeklyPlanData;
              return (
                <Card key={plan.artifact_id}>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base">
                        Week starting {data.week_start}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {plan.artifact_id}
                      </p>
                    </div>
                    <Badge variant="secondary">Weekly Plan</Badge>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <div>Tasks: {data.task_refs.length}</div>
                    <div>Memory refs: {data.memory_refs.length}</div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
        <TabsContent value="daily" className="space-y-3">
          {daily.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                No daily plans yet.
              </CardContent>
            </Card>
          ) : (
            daily.map((plan) => {
              const data = plan.output_data as Suggestions.DailyPlanData;
              return (
                <Card key={plan.artifact_id}>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base">Daily MITs</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {data.date} · {plan.artifact_id}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {data.auto_generated ? "Auto" : "Manual"}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <div>Tasks: {data.task_ids.join(", ")}</div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
