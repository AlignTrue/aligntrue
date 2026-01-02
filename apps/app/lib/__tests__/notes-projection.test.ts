import { describe, expect, test, vi } from "vitest";
import { NOTE_EVENT_TYPES } from "@aligntrue/core/contracts/notes";
import { readNotesProjection } from "../projections/notes";

const noteId = "note-123";

const mockEvent = {
  event_id: "evt-1",
  event_type: NOTE_EVENT_TYPES.NoteCreated,
  payload: {
    note_id: noteId,
    title: "Test note",
    body_md: "Hello",
    content_hash: "hash",
  },
  occurred_at: "2024-01-01T00:00:00.000Z",
  ingested_at: "2024-01-01T00:00:00.000Z",
  correlation_id: "corr-1",
  causation_id: "cmd-1",
  causation_type: "command",
  actor: { actor_id: "web-user", actor_type: "human" },
  envelope_version: 1,
  payload_schema_version: 1,
};

vi.mock("../ops-services", async () => {
  const eventStore = {
    async *stream() {
      yield mockEvent;
    },
  };
  return {
    getHost: vi.fn(async () => {}),
    getEventStore: vi.fn(() => eventStore),
  };
});

describe("readNotesProjection", () => {
  test("rebuilds notes from host event store", async () => {
    const projection = await readNotesProjection();
    expect(projection?.notes).toHaveLength(1);
    expect(projection?.notes[0].id).toBe(noteId);
    expect(projection?.notes[0].title).toBe("Test note");
  });
});
