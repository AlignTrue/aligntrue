import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  Connectors,
  Convert,
  GmailMutations,
  Storage,
  Tasks,
  Notes,
} from "../src/index.js";

const ACTOR = { actor_id: "user-1", actor_type: "human" } as const;
const NOW = "2024-01-01T00:00:00Z";

describe("email conversion and gmail mutations", () => {
  let dir: string;
  let eventsPath: string;
  let commandsPath: string;
  let outcomesPath: string;
  let eventStore: Storage.JsonlEventStore;
  let commandLog: Storage.JsonlCommandLog;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "ops-core-email-convert-"));
    eventsPath = join(dir, "events.jsonl");
    commandsPath = join(dir, "commands.jsonl");
    outcomesPath = join(dir, "outcomes.jsonl");
    eventStore = new Storage.JsonlEventStore(eventsPath);
    commandLog = new Storage.JsonlCommandLog(commandsPath, outcomesPath, {
      allowExternalPaths: true,
    });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("converts email to task idempotently with conversion metadata", async () => {
    await seedEmail(eventStore);
    const service = new Convert.ConversionService(eventStore, commandLog, {
      now: () => NOW,
      tasksEnabled: true,
      notesEnabled: true,
    });

    await service.convertEmailToTask({
      message_id: "msg-1",
      actor: ACTOR,
      conversion_method: "user_action",
    });
    await service.convertEmailToTask({
      message_id: "msg-1",
      actor: ACTOR,
      conversion_method: "user_action",
    });

    let taskCreated = 0;
    for await (const event of eventStore.stream()) {
      if (event.event_type === Tasks.TASK_EVENT_TYPES.TaskCreated) {
        taskCreated += 1;
        expect((event as Tasks.TaskEvent).payload.conversion).toBeDefined();
      }
    }
    expect(taskCreated).toBe(1);
  });

  it("converts email to note idempotently with conversion metadata", async () => {
    await seedEmail(eventStore);
    const service = new Convert.ConversionService(eventStore, commandLog, {
      now: () => NOW,
      tasksEnabled: true,
      notesEnabled: true,
    });

    await service.convertEmailToNote({
      message_id: "msg-1",
      actor: ACTOR,
      conversion_method: "user_action",
    });
    await service.convertEmailToNote({
      message_id: "msg-1",
      actor: ACTOR,
      conversion_method: "user_action",
    });

    let noteCreated = 0;
    for await (const event of eventStore.stream()) {
      if (event.event_type === Notes.NOTE_EVENT_TYPES.NoteCreated) {
        noteCreated += 1;
        expect((event as Notes.NoteEvent).payload.conversion).toBeDefined();
      }
    }
    expect(noteCreated).toBe(1);
  });

  it("dedupes gmail mutations after success", async () => {
    const performer = {
      perform: vi.fn(async () => ({ destination_ref: "label-applied" })),
    };
    const executor = new GmailMutations.GmailMutationExecutor(eventStore, {
      now: () => NOW,
      performer,
      flagEnabled: true,
    });

    const request: GmailMutations.GmailMutationRequest = {
      mutation_id: "mut-1",
      provider: "google_gmail",
      message_id: "msg-1",
      thread_id: "thread-1",
      operations: ["APPLY_LABEL"],
      label_id: "LBL",
    };

    await executor.execute(request);
    await executor.execute(request);

    expect(performer.perform).toHaveBeenCalledTimes(1);

    let successEvents = 0;
    for await (const event of eventStore.stream()) {
      if (
        event.event_type ===
        GmailMutations.GMAIL_MUTATION_EVENT_TYPES.GmailMutationSucceeded
      ) {
        successEvents += 1;
      }
    }
    expect(successEvents).toBe(1);
  });

  it("records failure when performer is missing while enabled", async () => {
    const executor = new GmailMutations.GmailMutationExecutor(eventStore, {
      now: () => NOW,
      flagEnabled: true,
    });

    const request: GmailMutations.GmailMutationRequest = {
      mutation_id: "mut-missing-performer",
      provider: "google_gmail",
      message_id: "msg-3",
      thread_id: "thread-3",
      operations: ["ARCHIVE"],
    };

    const result = await executor.execute(request);
    expect(result.disabled).toBe(false);
    expect(result.receipts[0]?.approved).toBe(false);
    expect(result.receipts[0]?.reason).toContain("performer");

    let successEvents = 0;
    let failedEvents = 0;
    for await (const event of eventStore.stream()) {
      if (
        event.event_type ===
        GmailMutations.GMAIL_MUTATION_EVENT_TYPES.GmailMutationSucceeded
      ) {
        successEvents += 1;
      }
      if (
        event.event_type ===
        GmailMutations.GMAIL_MUTATION_EVENT_TYPES.GmailMutationFailed
      ) {
        failedEvents += 1;
      }
    }

    expect(successEvents).toBe(0);
    expect(failedEvents).toBe(1);
  });

  it("records failure when mutations are disabled", async () => {
    const executor = new GmailMutations.GmailMutationExecutor(eventStore, {
      now: () => NOW,
      performer: {
        perform: async () => ({ destination_ref: "noop" }),
      },
      flagEnabled: false,
    });

    const request: GmailMutations.GmailMutationRequest = {
      mutation_id: "mut-2",
      provider: "google_gmail",
      message_id: "msg-2",
      thread_id: "thread-2",
      operations: ["ARCHIVE"],
    };

    const result = await executor.execute(request);
    expect(result.disabled).toBe(true);
    expect(result.receipts[0]?.approved).toBe(false);
    expect(result.receipts[0]?.reason).toBe("mutations_disabled");

    let failedEvents = 0;
    for await (const event of eventStore.stream()) {
      if (
        event.event_type ===
        GmailMutations.GMAIL_MUTATION_EVENT_TYPES.GmailMutationFailed
      ) {
        failedEvents += 1;
      }
    }
    expect(failedEvents).toBe(1);
  });
});

async function seedEmail(eventStore: Storage.JsonlEventStore) {
  const event = Connectors.GoogleGmail.buildEmailIngestEvent({
    record: {
      provider: "google_gmail",
      message_id: "msg-1",
      thread_id: "thread-1",
      internal_date: NOW,
      subject: "Hello world",
      snippet: "Body preview",
    },
    correlation_id: "corr-1",
    ingested_at: NOW,
    actor: { actor_id: "gmail-connector", actor_type: "service" },
  });
  await eventStore.append(event);
  return event;
}
