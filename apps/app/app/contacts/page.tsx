import { OPS_CONTACTS_ENABLED, Projections } from "@aligntrue/ops-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEventStore } from "@/lib/ops-services";

async function getContacts(): Promise<Projections.ContactProjection> {
  const rebuilt = await Projections.rebuildOne(
    Projections.ContactsProjectionDef,
    getEventStore(),
  );
  return Projections.buildContactsProjectionFromState(
    rebuilt.data as Projections.ContactsProjectionState,
  );
}

export default async function ContactsPage() {
  if (!OPS_CONTACTS_ENABLED) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Contacts are disabled</CardTitle>
          </CardHeader>
          <CardContent>
            Set OPS_CONTACTS_ENABLED=1 to enable contacts projection.
          </CardContent>
        </Card>
      </div>
    );
  }

  const contacts = await getContacts();

  return (
    <div className="mx-auto max-w-4xl space-y-4 py-8">
      <h1 className="text-xl font-semibold">Contacts</h1>
      {contacts.contacts.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No contacts yet. Ingest calendar data to populate contacts.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {contacts.contacts.map((contact) => (
          <Card key={contact.contact_id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">
                  {contact.display_name ??
                    contact.primary_email ??
                    contact.contact_id}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {contact.contact_id}
                </p>
              </div>
              {contact.primary_email ? (
                <span className="text-xs text-muted-foreground">
                  {contact.primary_email}
                </span>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {contact.source_refs?.length ? (
                <div>Source refs: {contact.source_refs.join(", ")}</div>
              ) : null}
              <div>
                Created: {contact.created_at} · Updated: {contact.updated_at}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
