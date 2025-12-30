import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Identity, Projections, Storage } from "../src/index.js";
// eslint-disable-next-line no-restricted-imports
import * as PackNotes from "../packs/notes/src/index.js";
// eslint-disable-next-line no-restricted-imports
import {
  createJsonlTaskLedger,
  TasksProjectionDef,
  buildTasksProjectionFromState,
  hashTasksProjection,
  TASK_COMMAND_TYPES,
} from "../packs/tasks/src/index.js";

const ACTOR = { actor_id: "user-1", actor_type: "human" } as const;
const NOW = "2024-01-01T00:00:00Z";

function buildCommand<T extends string, P>(
  command_type: T,
  payload: P,
  opts?: { id?: string; target_ref?: string; dedupe_scope?: string },
) {
  const command_id =
    opts?.id ?? Identity.deterministicId(JSON.stringify(payload));
  return {
    command_id,
    idempotency_key: command_id,
    command_type,
    payload,
    target_ref: opts?.target_ref ?? "local",
    dedupe_scope: opts?.dedupe_scope ?? "tenant:local",
    correlation_id: "corr-1",
    actor: ACTOR,
    requested_at: NOW,
  };
}

describe("tasks + notes", () => {
  let dir: string;
  let eventsPath: string;
  let commandsPath: string;
  let outcomesPath: string;
  let eventStore: Storage.JsonlEventStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "ops-core-tasks-notes-"));
    eventsPath = join(dir, "events.jsonl");
    commandsPath = join(dir, "commands.jsonl");
    outcomesPath = join(dir, "outcomes.jsonl");
    eventStore = new Storage.JsonlEventStore(eventsPath);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("Task create is idempotent by command_id", async () => {
    const ledger = createJsonlTaskLedger({
      eventsPath,
      commandsPath,
      outcomesPath,
      allowExternalPaths: true,
      now: () => NOW,
    });

    const payload = {
      task_id: "task-1",
      title: "Test task",
      bucket: "today" as const,
      status: "open" as const,
    };

    const cmd = buildCommand(TASK_COMMAND_TYPES.Create, payload, {
      id: "cmd-1",
      target_ref: payload.task_id,
      dedupe_scope: `task:${payload.task_id}`,
    });

    const first = await ledger.execute(cmd);
    const second = await ledger.execute(cmd);

    expect(first.status).toBe("accepted");
    expect(second.status).toBe("accepted");

    let createEvents = 0;
    for await (const event of eventStore.stream()) {
      if (event.event_type === "pack.tasks.task_created") {
        createEvents += 1;
      }
    }
    expect(createEvents).toBe(1);
  });

  it("Task projection rebuild is deterministic", async () => {
    const ledger = createJsonlTaskLedger({
      eventsPath,
      commandsPath,
      outcomesPath,
      allowExternalPaths: true,
      now: () => NOW,
    });

    const createCmd = buildCommand(TASK_COMMAND_TYPES.Create, {
      task_id: "task-2",
      title: "Plan",
      bucket: "today" as const,
      status: "open" as const,
    });
    await ledger.execute(createCmd);

    const triageCmd = buildCommand(TASK_COMMAND_TYPES.Triage, {
      task_id: "task-2",
      bucket: "week" as const,
      impact: "M" as const,
    });
    await ledger.execute(triageCmd);

    const first = await Projections.rebuildOne(TasksProjectionDef, eventStore);
    const firstView = buildTasksProjectionFromState(first.data);
    const firstHash = hashTasksProjection(firstView);

    const second = await Projections.rebuildOne(TasksProjectionDef, eventStore);
    const secondView = buildTasksProjectionFromState(second.data);
    const secondHash = hashTasksProjection(secondView);

    expect(firstHash).toBe(secondHash);
    expect(firstView.tasks.length).toBe(1);
    expect(firstView.tasks[0]?.bucket).toBe("week");
  });

  it("Note checkbox patch is idempotent on retry", async () => {
    const noteLedger = PackNotes.createJsonlNoteLedger({
      eventsPath,
      commandsPath,
      outcomesPath,
      allowExternalPaths: true,
      now: () => NOW,
    });

    const createCmd = buildCommand(PackNotes.NOTE_COMMAND_TYPES.Create, {
      note_id: "note-1",
      title: "Checklist",
      body_md: "- [ ] item one",
    });
    await noteLedger.execute(createCmd);

    const patchCmd = buildCommand(PackNotes.NOTE_COMMAND_TYPES.PatchCheckbox, {
      note_id: "note-1",
      line_index: 0,
    });

    const first = await noteLedger.execute(patchCmd);
    const second = await noteLedger.execute(patchCmd);

    expect(first.status).toBe("accepted");
    expect(second.status).toBe("accepted");

    const projection = await Projections.rebuildOne(
      PackNotes.NotesProjectionDef,
      eventStore,
    );
    const view = PackNotes.buildNotesProjectionFromState(
      projection.data as PackNotes.NotesProjectionState,
    );
    expect(view.notes[0]?.body_md.trim()).toBe("- [x] item one");
  });

  it("Note projection rebuild is deterministic", async () => {
    const noteLedger = PackNotes.createJsonlNoteLedger({
      eventsPath,
      commandsPath,
      outcomesPath,
      allowExternalPaths: true,
      now: () => NOW,
    });

    const createCmd = buildCommand(PackNotes.NOTE_COMMAND_TYPES.Create, {
      note_id: "note-2",
      title: "Doc",
      body_md: "hello",
    });
    await noteLedger.execute(createCmd);

    const updateCmd = buildCommand(PackNotes.NOTE_COMMAND_TYPES.Update, {
      note_id: "note-2",
      body_md: "hello world",
    });
    await noteLedger.execute(updateCmd);

    const first = await Projections.rebuildOne(
      PackNotes.NotesProjectionDef,
      eventStore,
    );
    const firstView = PackNotes.buildNotesProjectionFromState(
      first.data as PackNotes.NotesProjectionState,
    );
    const firstHash = PackNotes.hashNotesProjection(firstView);

    const second = await Projections.rebuildOne(
      PackNotes.NotesProjectionDef,
      eventStore,
    );
    const secondView = PackNotes.buildNotesProjectionFromState(
      second.data as PackNotes.NotesProjectionState,
    );
    const secondHash = PackNotes.hashNotesProjection(secondView);

    expect(firstHash).toBe(secondHash);
    expect(firstView.notes.length).toBe(1);
    expect(firstView.notes[0]?.body_md).toBe("hello world");
  });
});
