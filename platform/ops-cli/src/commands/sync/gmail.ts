import {
  Connectors,
  Identity,
  OPS_MEMORY_PROVIDER_ENABLED,
  Storage,
} from "@aligntrue/ops-core";
import { Mem0Adapter } from "../../memory/index.js";
import { loadTokenSet, logKV, logSection, parseDaysArg } from "./shared.js";

export async function syncGmail(args: string[]): Promise<void> {
  const days = parseDaysArg(args, 7);
  const started = Date.now();

  logSection(`Syncing Gmail (last ${days} days)...`);

  const tokens = await loadTokenSet({ allowRefresh: true });
  const query = `newer_than:${days}d`;

  const rawMessages = await Connectors.GoogleGmail.fetchAllGmailMessages({
    accessToken: tokens.accessToken,
    query,
    maxResults: 100,
  });

  const records = Connectors.GoogleGmail.transformGmailMessages(rawMessages);

  const eventStore = new Storage.JsonlEventStore();
  const result = await Connectors.GoogleGmail.ingestEmailMessages({
    eventStore,
    emails: records,
    correlation_id: Identity.randomId(),
  });

  logKV("Fetched", records.length);
  logKV("Written", result.written);
  logKV("Skipped", result.skipped);

  if (OPS_MEMORY_PROVIDER_ENABLED && result.written > 0) {
    const provider = new Mem0Adapter();
    const toIndex = records.map((r) => ({
      entity_type: "timeline_item" as const,
      entity_id: r.message_id,
      content: buildEmailContent(r),
    }));
    const indexResult = await provider.index(toIndex);
    logKV("Indexed", indexResult.indexed);
  }

  logKV("Done (ms)", Date.now() - started);
}

function buildEmailContent(record: Connectors.GoogleGmail.EmailMessageRecord) {
  const parts = [
    record.subject,
    record.from,
    record.to?.join(" "),
    record.cc?.join(" "),
    record.snippet,
  ];
  return parts.filter(Boolean).join(" ");
}
