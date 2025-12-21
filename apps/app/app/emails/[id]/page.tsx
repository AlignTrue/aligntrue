import { notFound, redirect } from "next/navigation";
import {
  OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED,
  Projections,
  Storage,
} from "@aligntrue/ops-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const APP_BASE =
  (process.env["APP_BASE_URL"] ?? process.env["VERCEL_URL"])
    ? `https://${process.env["VERCEL_URL"]}`
    : "http://localhost:3000";
const LABEL_ID = process.env["GMAIL_MUTATION_LABEL_ID"];

async function getEmail(sourceRef: string) {
  const rebuilt = await Projections.rebuildOne(
    Projections.TimelineProjectionDef,
    new Storage.JsonlEventStore(),
  );
  const view = Projections.buildTimelineProjectionFromState(
    rebuilt.data as Projections.TimelineProjectionState,
  );
  return view.items.find((item) => item.id === sourceRef);
}

async function convert(
  message_id: string,
  thread_id: string | undefined,
  mutate: boolean,
): Promise<void> {
  await fetch(`${APP_BASE}/api/convert/email-to-task`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message_id }),
  });
  if (mutate) {
    const payload: Record<string, unknown> = {
      message_id,
      thread_id: thread_id ?? "",
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

async function convertAction(formData: FormData) {
  "use server";
  const message_id = String(formData.get("message_id") ?? "");
  const thread_id = String(formData.get("thread_id") ?? "");
  const mutate = formData.get("mutation") === "on";
  if (!message_id) return;
  await convert(message_id, thread_id, mutate);
  redirect(`/emails/${formData.get("source_ref") ?? ""}`);
}

async function noteAction(formData: FormData) {
  "use server";
  const message_id = String(formData.get("message_id") ?? "");
  if (!message_id) return;
  await fetch(`${APP_BASE}/api/convert/email-to-note`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message_id }),
  });
  redirect(`/emails/${formData.get("source_ref") ?? ""}`);
}

export default async function EmailDetailPage({
  params,
}: {
  params: { id: string };
}) {
  if (!OPS_CONNECTOR_GOOGLE_GMAIL_ENABLED) {
    notFound();
  }

  const email = await getEmail(params.id);
  if (!email) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{email.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {email.from} — {email.occurred_at}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {email.summary ? (
            <p className="text-sm text-muted-foreground">{email.summary}</p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <form action={convertAction} className="flex items-center gap-2">
              <input type="hidden" name="message_id" value={email.message_id} />
              <input
                type="hidden"
                name="thread_id"
                value={email.thread_id ?? ""}
              />
              <input type="hidden" name="source_ref" value={email.id} />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" name="mutation" />
                Also label + archive
              </label>
              <Button type="submit">Convert to Task</Button>
            </form>
            <form action={noteAction}>
              <input type="hidden" name="message_id" value={email.message_id} />
              <input type="hidden" name="source_ref" value={email.id} />
              <Button type="submit" variant="secondary">
                Save as Note
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
