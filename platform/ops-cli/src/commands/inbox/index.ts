import {
  OPS_CORE_ENABLED,
  OPS_SUGGESTIONS_ENABLED,
  Suggestions,
  Storage,
  Projections,
} from "@aligntrue/ops-core";
import * as PackNotes from "@aligntrue/pack-notes";
import { createJsonlTaskLedger } from "@aligntrue/pack-tasks";
import { exitWithError } from "../../utils/command-utilities.js";
import { readTasksProjection } from "../tasks/shared.js";

const CLI_ACTOR = {
  actor_id: process.env["USER"] || "cli-user",
  actor_type: "human",
  display_name: process.env["USER"] || "CLI User",
} as const;

export async function inbox(args: string[]): Promise<void> {
  ensureEnabled();
  const sub = args[0];
  switch (sub) {
    case "generate":
      return handleGenerate();
    case "list":
      return handleList(args.slice(1));
    case "approve":
      return handleApprove(args[1]);
    case "reject":
      return handleReject(args[1]);
    case "snooze":
      return handleSnooze(args[1]);
    default:
      return exitWithError(
        1,
        "Usage: aligntrue inbox <generate|list|approve|reject|snooze> [args]",
      );
  }
}

async function handleGenerate(): Promise<void> {
  const artifactStore = Suggestions.createArtifactStore();
  const suggestionEvents = Suggestions.createSuggestionEventStore();

  const { projection: tasks, hash: tasksHash } = await readTasksProjection();
  const {
    projection: notes,
    hash: notesHash,
    version: notesVersion,
  } = await readNotesProjection();

  const result = Suggestions.combineResults(
    await Suggestions.generateTaskTriageSuggestions({
      artifactStore,
      tasks,
      tasks_hash: tasksHash,
      actor: CLI_ACTOR,
    }),
    await Suggestions.generateNoteHygieneSuggestions({
      artifactStore,
      notes,
      notes_hash: notesHash,
      notes_projection_version: notesVersion,
      actor: CLI_ACTOR,
    }),
  );

  for (const event of result.events) {
    await suggestionEvents.append(event);
  }

  console.log(
    `Generated ${result.artifacts.length} suggestion(s); wrote ${result.events.length} event(s).`,
  );
}

async function handleList(args: string[]): Promise<void> {
  const statusArg = args.find((a) => a.startsWith("--status"));
  const status = statusArg ? (statusArg.split("=")[1] as string) : undefined;
  const inbox = await Suggestions.rebuildInboxProjection({});
  const items = status
    ? inbox.projection.suggestions.filter(
        (s: Projections.InboxItem) => s.status === status,
      )
    : inbox.projection.suggestions;

  if (!items.length) {
    console.log("No suggestions found");
    return;
  }

  for (const item of items) {
    console.log(
      `- ${item.suggestion_id} [${item.status}] ${item.suggestion_type} targets=${item.target_refs.join(",")}`,
    );
  }
}

async function handleApprove(id?: string): Promise<void> {
  await handleDecision("suggestion.approve", id);
}

async function handleReject(id?: string): Promise<void> {
  await handleDecision("suggestion.reject", id);
}

async function handleSnooze(id?: string): Promise<void> {
  await handleDecision("suggestion.snooze", id);
}

async function handleDecision(
  command_type:
    | "suggestion.approve"
    | "suggestion.reject"
    | "suggestion.snooze",
  id?: string,
): Promise<void> {
  if (!id) {
    return exitWithError(1, "Suggestion id required", {
      hint: "Usage: aligntrue inbox approve <suggestion_id>",
    });
  }

  const artifactStore = Suggestions.createArtifactStore();
  const feedbackEvents = Suggestions.createFeedbackEventStore();
  const executor = new Suggestions.SuggestionExecutor({
    artifactStore,
    feedbackEventStore: feedbackEvents,
    runtimeDispatch: async (cmd) => {
      const ledger = createJsonlTaskLedger();
      return ledger.execute(cmd as never);
    },
  });

  const artifact = await artifactStore.getDerivedById(id);
  if (!artifact || !Suggestions.isSuggestionArtifact(artifact)) {
    return exitWithError(1, "Suggestion not found");
  }

  if (command_type === "suggestion.approve") {
    const command = Suggestions.buildSuggestionCommand(
      command_type,
      { suggestion_id: id, expected_hash: artifact.content_hash },
      CLI_ACTOR,
    );
    const outcome = await executor.approve(command);
    console.log(`Approve status: ${outcome.status}`);
    return;
  }

  if (command_type === "suggestion.reject") {
    const command = Suggestions.buildSuggestionCommand(
      command_type,
      { suggestion_id: id },
      CLI_ACTOR,
    );
    const outcome = await executor.reject(command);
    console.log(`Reject status: ${outcome.status}`);
    return;
  }

  const command = Suggestions.buildSuggestionCommand(
    command_type,
    { suggestion_id: id },
    CLI_ACTOR,
  );
  const outcome = await executor.snooze(command);
  console.log(`Snooze status: ${outcome.status}`);
}

function ensureEnabled() {
  if (!OPS_CORE_ENABLED) {
    exitWithError(1, "ops-core is disabled", {
      hint: "Set OPS_CORE_ENABLED=1 to enable ops-core commands",
    });
  }
  if (!OPS_SUGGESTIONS_ENABLED) {
    exitWithError(1, "Suggestions are disabled", {
      hint: "Set OPS_SUGGESTIONS_ENABLED=1",
    });
  }
}

async function readNotesProjection() {
  const store = new Storage.JsonlEventStore(
    PackNotes.DEFAULT_NOTES_EVENTS_PATH,
  );
  const rebuilt = await Projections.rebuildOne(
    PackNotes.NotesProjectionDef,
    store,
  );
  const projection = PackNotes.buildNotesProjectionFromState(
    rebuilt.data as PackNotes.NotesProjectionState,
  );
  return {
    projection,
    hash: PackNotes.hashNotesProjection(projection),
    version: PackNotes.NotesProjectionDef.version,
  };
}
