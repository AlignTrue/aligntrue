import { OPS_CONTACTS_ENABLED, Projections, Storage } from "@aligntrue/core";
import { exitWithError } from "../../utils/command-utilities.js";
import { defineCommand } from "../../utils/command-router.js";
import { parseArgs, type ArgDefinition } from "../../utils/args.js";

export const contacts = defineCommand({
  name: "contacts",
  subcommands: {
    list: {
      handler: listContacts,
      description: "List contacts derived from calendar ingest",
    },
    show: {
      handler: showContact,
      description: "Show a single contact by id",
    },
  },
});

async function listContacts(args: string[]): Promise<void> {
  const spec: ArgDefinition[] = [{ flag: "limit", type: "string" }];
  const parsed = parseArgs(args, spec);
  if (parsed.errors.length > 0) {
    exitWithError(2, parsed.errors.join("; "));
  }

  const limitStr = parsed.flags.limit as string | undefined;
  const limit = limitStr ? Number.parseInt(limitStr, 10) : undefined;
  if (limit !== undefined && (Number.isNaN(limit) || limit < 1)) {
    exitWithError(2, "limit must be a positive integer");
  }

  if (!OPS_CONTACTS_ENABLED) {
    console.warn(
      "contacts: OPS_CONTACTS_ENABLED=0 (contacts disabled; showing empty set)",
    );
  }

  const store = new Storage.JsonlEventStore();
  const rebuilt = await Projections.rebuildOne(
    Projections.ContactsProjectionDef,
    store,
  );
  const view = Projections.buildContactsProjectionFromState(
    rebuilt.data as Projections.ContactsProjectionState,
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
  const parsed = parseArgs(args, []);
  const id = parsed.positional[0];
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
  const rebuilt = await Projections.rebuildOne(
    Projections.ContactsProjectionDef,
    store,
  );
  const view = Projections.buildContactsProjectionFromState(
    rebuilt.data as Projections.ContactsProjectionState,
  );
  const contact = view.contacts.find(
    (c: Projections.Contact) => c.contact_id === id,
  );

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
