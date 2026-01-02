import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { Projections } from "@aligntrue/core";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@aligntrue/ui-base";
import { getEventStore, getHost } from "@/lib/ops-services";
import { getBaseUrl } from "@/lib/utils";

const GMAIL_ENABLED = process.env.NEXT_PUBLIC_CONNECTOR_GMAIL_ENABLED === "1";

async function getEmailTimeline() {
  await getHost();
  const rebuilt = await Projections.rebuildOne(
    Projections.TimelineProjectionDef,
    getEventStore(),
  );
  const view = Projections.buildTimelineProjectionFromState(
    rebuilt.data as Projections.TimelineProjectionState,
  );
  return view.items.filter((item) => item.type === "email_message");
}

const APP_BASE = getBaseUrl();

const LABEL_ID = process.env["GMAIL_MUTATION_LABEL_ID"];

async function convertToTaskAction(formData: FormData) {
  "use server";
  const message_id = String(formData.get("message_id") ?? "");
  const thread_id = String(formData.get("thread_id") ?? "");
  if (!message_id) return;
  await fetch(`${APP_BASE}/api/convert/email-to-task`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message_id }),
  });

  const doMutation = formData.get("mutation") === "on";
  if (doMutation) {
    if (!thread_id) {
      console.warn("Skipping Gmail mutation: thread_id is missing");
    } else {
      const payload: Record<string, unknown> = {
        message_id,
        thread_id,
        operations: LABEL_ID ? ["APPLY_LABEL", "ARCHIVE"] : ["ARCHIVE"],
      };
      if (LABEL_ID) payload.label_id = LABEL_ID;
      await fetch(`${APP_BASE}/api/gmail/mutation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
  }
  revalidatePath("/emails");
}

async function convertToNoteAction(formData: FormData) {
  "use server";
  const message_id = String(formData.get("message_id") ?? "");
  if (!message_id) return;
  await fetch(`${APP_BASE}/api/convert/email-to-note`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message_id }),
  });
  revalidatePath("/emails");
}

export default async function EmailsPage() {
  if (!GMAIL_ENABLED) {
    notFound();
  }

  const emails = await getEmailTimeline();

  return (
    <div className="mx-auto max-w-4xl space-y-4 py-8">
      {emails.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No emails ingested yet</CardTitle>
          </CardHeader>
          <CardContent>Ingest Gmail to see messages here.</CardContent>
        </Card>
      ) : null}

      {emails.map((email) => (
        <Card key={email.id}>
          <CardHeader>
            <CardTitle className="text-base">{email.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {email.from} @ {email.occurred_at}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {email.summary ? (
              <p className="text-sm text-muted-foreground">{email.summary}</p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <form
                action={convertToTaskAction}
                className="flex items-center gap-2"
              >
                <input
                  type="hidden"
                  name="message_id"
                  value={email.message_id}
                />
                <input
                  type="hidden"
                  name="thread_id"
                  value={email.thread_id ?? ""}
                />
                {GMAIL_ENABLED ? (
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" name="mutation" />
                    Also label + archive
                  </label>
                ) : null}
                <Button type="submit">Convert to Task</Button>
              </form>

              <form action={convertToNoteAction}>
                <input
                  type="hidden"
                  name="message_id"
                  value={email.message_id}
                />
                <Button type="submit" variant="secondary">
                  Save as Note
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
