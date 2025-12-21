import {
  OPS_CONTACTS_ENABLED,
  Projections,
  Storage,
} from "@aligntrue/ops-core";
import { exitWithError } from "../../utils/command-utilities.js";

const HELP_TEXT = `
Usage: aligntrue contacts <list|show> [options]

Subcommands:
  list [--limit N]              List contacts derived from calendar ingest
  show <contact_id>             Show a single contact by id
`;

export async function contacts(args: string[]): Promise<void> {
  const sub = args[0] ?? "list";
  const rest = args.slice(1);

  if (sub === "--help" || sub === "-h" || sub === "help") {
    console.log(HELP_TEXT.trim());
    return;
  }

  switch (sub) {
    case "list":
      await listContacts(rest);
      return;
    case "show":
      await showContact(rest);
      return;
    default:
      exitWithError(2, `Unknown subcommand: ${sub}`, {
        hint: "Run aligntrue contacts --help",
      });
  }
}

async function listContacts(args: string[]): Promise<void> {
  const { limit } = parseListArgs(args);

  if (!OPS_CONTACTS_ENABLED) {
    console.warn(
      "contacts: OPS_CONTACTS_ENABLED=0 (contacts disabled; showing empty set)",
    );
  }

  const store = new Storage.JsonlEventStore();
  const projection = await Projections.rebuildOne(
    Projections.ContactsProjectionDef,
    store,
  );
  const view = Projections.buildContactsProjectionFromState(
    projection.data as Projections.ContactsProjectionState,
  );

  let contacts = view.contacts;
  if (limit !== undefined) {
    contacts = contacts.slice(0, limit);
  }

  if (contacts.length === 0) {
    console.log("No contacts.");
    return;
  }

  for (const contact of contacts) {
    const label = contact.display_name ?? contact.primary_email ?? "(unknown)";
    console.log(`- ${label} (${contact.contact_id})`);
    if (contact.primary_email) {
      console.log(`  email: ${contact.primary_email}`);
    }
    if (contact.source_refs?.length) {
      console.log(`  source_refs: ${contact.source_refs.join(", ")}`);
    }
    console.log(
      `  created_at=${contact.created_at}, updated_at=${contact.updated_at}`,
    );
  }
}

async function showContact(args: string[]): Promise<void> {
  const id = args[0];
  if (!id) {
    exitWithError(2, "contact_id is required for show", {
      hint: "Usage: aligntrue contacts show <contact_id>",
    });
    return;
  }

  if (!OPS_CONTACTS_ENABLED) {
    console.warn(
      "contacts: OPS_CONTACTS_ENABLED=0 (contacts disabled; showing empty set)",
    );
  }

  const store = new Storage.JsonlEventStore();
  const projection = await Projections.rebuildOne(
    Projections.ContactsProjectionDef,
    store,
  );
  const view = Projections.buildContactsProjectionFromState(
    projection.data as Projections.ContactsProjectionState,
  );
  const contact = view.contacts.find((c) => c.contact_id === id);

  if (!contact) {
    exitWithError(1, `Contact not found: ${id}`);
    return;
  }

  console.log(`contact_id: ${contact.contact_id}`);
  if (contact.display_name) {
    console.log(`display_name: ${contact.display_name}`);
  }
  if (contact.primary_email) {
    console.log(`primary_email: ${contact.primary_email}`);
  }
  console.log(`source_refs: ${contact.source_refs.join(", ")}`);
  console.log(`created_at: ${contact.created_at}`);
  console.log(`updated_at: ${contact.updated_at}`);
}

function parseListArgs(args: string[]): { limit?: number } {
  let limit: number | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case "--limit":
        limit = Number(args[i + 1]);
        if (Number.isNaN(limit) || limit < 1) {
          exitWithError(2, "limit must be a positive integer");
        }
        i += 1;
        break;
      case "--help":
      case "-h":
        console.log(HELP_TEXT.trim());
        process.exit(0);
        break;
      default:
        exitWithError(2, `Unknown option: ${arg}`, {
          hint: "Run aligntrue contacts --help",
        });
    }
  }

  const result: { limit?: number } = {};
  if (limit !== undefined) result.limit = limit;
  return result;
}
