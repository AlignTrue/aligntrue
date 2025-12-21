import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const baseEvent = {
  provider: "google_calendar" as const,
  calendar_id: "primary",
  event_id: "evt-1",
  updated: "2024-01-01T00:00:00Z",
  title: "Kickoff",
  start_time: "2024-01-02T10:00:00Z",
};

describe("contacts projection (calendar ingest v0)", () => {
  let dir: string;
  let eventsPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "ops-core-contacts-"));
    eventsPath = join(dir, "events.jsonl");
  });

  afterEach(async () => {
    delete process.env["OPS_CONTACTS_ENABLED"];
    await rm(dir, { recursive: true, force: true });
  });

  it("derives deterministic contact_id from email and merges across events", async () => {
    const { Connectors, Projections, Storage } =
      await loadCoreWithContactsEnabled(true);
    const store = new Storage.JsonlEventStore(eventsPath);

    await Connectors.GoogleCalendar.ingestCalendarEvents({
      eventStore: store,
      events: [
        {
          ...baseEvent,
          attendees: [{ email: "alice@example.com" }],
        },
        {
          ...baseEvent,
          event_id: "evt-2",
          updated: "2024-01-02T00:00:00Z",
          attendees: [{ email: "alice@example.com" }],
          start_time: "2024-01-03T12:00:00Z",
        },
      ],
      flagEnabled: true,
      now: () => "2024-01-05T00:00:00Z",
      correlation_id: "corr-contacts-1",
    });

    const projection = await Projections.rebuildOne(
      Projections.ContactsProjectionDef,
      store,
    );
    const view = Projections.buildContactsProjectionFromState(
      projection.data as Projections.ContactsProjectionState,
    );
    expect(view.contacts.length).toBe(1);
    const contact = view.contacts[0];
    expect(contact.primary_email).toBe("alice@example.com");
    expect(contact.contact_id).toBe(
      Projections.hashContactIdFromEmail("alice@example.com"),
    );
    expect(contact.source_refs.length).toBe(2);
  });

  it("creates source-scoped contact when email is missing", async () => {
    const { Connectors, Projections, Storage } =
      await loadCoreWithContactsEnabled(true);
    const store = new Storage.JsonlEventStore(eventsPath);

    await Connectors.GoogleCalendar.ingestCalendarEvents({
      eventStore: store,
      events: [
        {
          ...baseEvent,
          attendees: [{}],
        },
      ],
      flagEnabled: true,
      now: () => "2024-01-06T00:00:00Z",
      correlation_id: "corr-contacts-2",
    });

    const projection = await Projections.rebuildOne(
      Projections.ContactsProjectionDef,
      store,
    );
    const view = Projections.buildContactsProjectionFromState(
      projection.data as Projections.ContactsProjectionState,
    );
    expect(view.contacts.length).toBe(1);
    const contact = view.contacts[0];
    expect(contact.primary_email).toBeUndefined();
    expect(contact.contact_id).toBe(
      Projections.hashContactIdSourceScoped({
        provider: baseEvent.provider,
        calendar_id: baseEvent.calendar_id,
        event_id: baseEvent.event_id,
        role: "attendee",
        index: 0,
      }),
    );
  });

  it("produces deterministic projection hash on rebuild", async () => {
    const { Connectors, Projections, Storage, Identity } =
      await loadCoreWithContactsEnabled(true);
    const store = new Storage.JsonlEventStore(eventsPath);

    await Connectors.GoogleCalendar.ingestCalendarEvents({
      eventStore: store,
      events: [
        {
          ...baseEvent,
          attendees: [{ email: "bob@example.com" }],
        },
      ],
      flagEnabled: true,
      now: () => "2024-01-07T00:00:00Z",
      correlation_id: "corr-contacts-3",
    });

    const first = await Projections.rebuildOne(
      Projections.ContactsProjectionDef,
      store,
    );
    const firstView = Projections.buildContactsProjectionFromState(
      first.data as Projections.ContactsProjectionState,
    );
    const firstHash = Identity.hashCanonical(firstView);

    const second = await Projections.rebuildOne(
      Projections.ContactsProjectionDef,
      store,
    );
    const secondView = Projections.buildContactsProjectionFromState(
      second.data as Projections.ContactsProjectionState,
    );
    const secondHash = Identity.hashCanonical(secondView);

    expect(firstHash).toBe(secondHash);
    expect(firstView.contacts.length).toBe(1);
  });

  it("respects contacts kill switch", async () => {
    const { Connectors, Projections, Storage } =
      await loadCoreWithContactsEnabled(false);
    const store = new Storage.JsonlEventStore(eventsPath);

    await Connectors.GoogleCalendar.ingestCalendarEvents({
      eventStore: store,
      events: [
        {
          ...baseEvent,
          attendees: [{ email: "carol@example.com" }],
        },
      ],
      flagEnabled: true,
      now: () => "2024-01-08T00:00:00Z",
      correlation_id: "corr-contacts-4",
    });

    const projection = await Projections.rebuildOne(
      Projections.ContactsProjectionDef,
      store,
    );
    const view = Projections.buildContactsProjectionFromState(
      projection.data as Projections.ContactsProjectionState,
    );
    expect(view.contacts.length).toBe(0);
  });
});

async function loadCoreWithContactsEnabled(enabled: boolean): Promise<{
  Connectors: (typeof import("../src/index.js"))["Connectors"];
  Projections: (typeof import("../src/index.js"))["Projections"];
  Storage: (typeof import("../src/index.js"))["Storage"];
  Identity: (typeof import("../src/index.js"))["Identity"];
}> {
  process.env["OPS_CONTACTS_ENABLED"] = enabled ? "1" : "0";
  vi.resetModules();
  const Core = await import("../src/index.js");
  return {
    Connectors: Core.Connectors,
    Projections: Core.Projections,
    Storage: Core.Storage,
    Identity: Core.Identity,
  };
}
