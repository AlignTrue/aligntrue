import { revalidatePath } from "next/cache";
import {
  OPS_SUGGESTIONS_ENABLED,
  OPS_TASKS_ENABLED,
  OPS_NOTES_ENABLED,
  Suggestions,
  Projections,
  Tasks,
  Notes,
} from "@aligntrue/ops-core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEventStore } from "@/lib/ops-services";

const ACTOR = {
  actor_id: "web-user",
  actor_type: "human",
  display_name: "Web User",
} as const;

async function getInbox() {
  if (!OPS_SUGGESTIONS_ENABLED) return null;
  return Suggestions.rebuildInboxProjection({});
}

async function generateAction() {
  "use server";
  if (!OPS_SUGGESTIONS_ENABLED) return;
  const artifactStore = Suggestions.createArtifactStore();
  const suggestionEvents = Suggestions.createSuggestionEventStore();

  if (OPS_TASKS_ENABLED) {
    const tasksRebuilt = await Projections.rebuildOne(
      Projections.TasksProjectionDef,
      getEventStore(Tasks.DEFAULT_TASKS_EVENTS_PATH),
    );
    const tasksProjection = Projections.buildTasksProjectionFromState(
      tasksRebuilt.data as Projections.TasksProjectionState,
    );
    const tasksHash = Projections.hashTasksProjection(tasksProjection);
    const taskResult = await Suggestions.generateTaskTriageSuggestions({
      artifactStore,
      tasks: tasksProjection,
      tasks_hash: tasksHash,
      actor: ACTOR,
    });
    for (const event of taskResult.events) {
      await suggestionEvents.append(event);
    }
  }

  if (OPS_NOTES_ENABLED) {
    const notesRebuilt = await Projections.rebuildOne(
      Projections.NotesProjectionDef,
      getEventStore(Notes.DEFAULT_NOTES_EVENTS_PATH),
    );
    const notesProjection = Projections.buildNotesProjectionFromState(
      notesRebuilt.data as Projections.NotesProjectionState,
    );
    const notesHash = Projections.hashNotesProjection(notesProjection);
    const noteResult = await Suggestions.generateNoteHygieneSuggestions({
      artifactStore,
      notes: notesProjection,
      notes_hash: notesHash,
      actor: ACTOR,
    });
    for (const event of noteResult.events) {
      await suggestionEvents.append(event);
    }
  }

  revalidatePath("/inbox");
}

async function decisionAction(formData: FormData) {
  "use server";
  if (!OPS_SUGGESTIONS_ENABLED) return;
  const suggestion_id = String(formData.get("suggestion_id") ?? "");
  const action = String(formData.get("action") ?? "");
  if (!suggestion_id || !action) return;

  const artifactStore = Suggestions.createArtifactStore();
  const feedbackEvents = Suggestions.createFeedbackEventStore();
  const executor = new Suggestions.SuggestionExecutor({
    artifactStore,
    feedbackEventStore: feedbackEvents,
  });
  const artifact = await artifactStore.getDerivedById(suggestion_id);
  if (!artifact || !Suggestions.isSuggestionArtifact(artifact)) {
    return;
  }

  if (action === "approve") {
    const command = Suggestions.buildSuggestionCommand(
      "suggestion.approve",
      { suggestion_id, expected_hash: artifact.content_hash },
      ACTOR,
    );
    await executor.approve(command);
  } else if (action === "reject") {
    const command = Suggestions.buildSuggestionCommand(
      "suggestion.reject",
      { suggestion_id },
      ACTOR,
    );
    await executor.reject(command);
  } else if (action === "snooze") {
    const command = Suggestions.buildSuggestionCommand(
      "suggestion.snooze",
      { suggestion_id },
      ACTOR,
    );
    await executor.snooze(command);
  }

  revalidatePath("/inbox");
}

export default async function InboxPage() {
  if (!OPS_SUGGESTIONS_ENABLED) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Suggestions are disabled</CardTitle>
          </CardHeader>
          <CardContent>
            Set OPS_SUGGESTIONS_ENABLED=1 to enable the Suggestion Inbox.
          </CardContent>
        </Card>
      </div>
    );
  }

  const inbox = await getInbox();
  if (!inbox) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Suggestion Inbox</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form action={generateAction}>
            <Button type="submit" variant="secondary">
              Generate Suggestions
            </Button>
          </form>
          <p className="text-sm text-muted-foreground">
            Status is derived from feedback (approve/reject/snooze).
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {inbox.projection.suggestions.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              No suggestions yet. Click &ldquo;Generate Suggestions&rdquo; to
              refresh.
            </CardContent>
          </Card>
        ) : (
          inbox.projection.suggestions.map((item) => (
            <Card key={item.suggestion_id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">
                    {item.suggestion_type}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {item.suggestion_id}
                  </p>
                </div>
                <span className="text-sm uppercase text-muted-foreground">
                  {item.status}
                </span>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Targets: {item.target_refs.join(", ")}
                </span>
                <div className="flex gap-2">
                  <form action={decisionAction}>
                    <input
                      type="hidden"
                      name="suggestion_id"
                      value={item.suggestion_id}
                    />
                    <input type="hidden" name="action" value="approve" />
                    <Button type="submit" variant="secondary" size="sm">
                      Approve
                    </Button>
                  </form>
                  <form action={decisionAction}>
                    <input
                      type="hidden"
                      name="suggestion_id"
                      value={item.suggestion_id}
                    />
                    <input type="hidden" name="action" value="reject" />
                    <Button type="submit" variant="outline" size="sm">
                      Reject
                    </Button>
                  </form>
                  <form action={decisionAction}>
                    <input
                      type="hidden"
                      name="suggestion_id"
                      value={item.suggestion_id}
                    />
                    <input type="hidden" name="action" value="snooze" />
                    <Button type="submit" variant="ghost" size="sm">
                      Snooze
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
