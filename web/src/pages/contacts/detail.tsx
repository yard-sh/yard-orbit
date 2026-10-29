import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { useActions } from "@/components/app-actions";
import { StatusBadge } from "@/components/badges";
import {
  DealsCard,
  DetailLayout,
  DetailSkeleton,
  Fields,
  RecordActions,
  SectionCard,
  TasksCard,
} from "@/components/detail";
import { ContactSheet } from "@/components/forms/contact-sheet";
import { Page, PageHeader } from "@/components/page";
import { Person, PersonAvatar } from "@/components/person";
import { Timeline } from "@/components/timeline";
import { formatDate, fullName } from "@/lib/format";
import { useContact, useRemove } from "@/lib/queries";
import { NotFound } from "@/pages/not-found";

export function ContactPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { create } = useActions();
  const { data, error } = useContact(id);
  const remove = useRemove("contacts");
  const [editing, setEditing] = useState(false);

  if (error) return <NotFound what="contact" back="/contacts" />;
  if (!data) return <DetailSkeleton />;
  const { contact, deals, tasks } = data;
  const name = fullName(contact);

  return (
    <Page>
      <PageHeader
        title={name}
        description={[contact.title, contact.company_name].filter(Boolean).join(" at ") || "No title"}
        actions={
          <RecordActions
            noun="contact"
            name={name}
            consequence="Their deals and tasks stay, without a contact."
            onEdit={() => setEditing(true)}
            onDelete={() => {
              // Leave first, so this page doesn't refetch the deleted contact.
              // A failure is toasted by the mutation cache (main.tsx).
              navigate("/contacts");
              remove.mutateAsync(contact.id).then(
                () => toast.success("Contact deleted"),
                () => {},
              );
            }}
          />
        }
      >
        <PersonAvatar name={name} className="size-12 text-base" />
      </PageHeader>
      <DetailLayout
        aside={
          <>
            <SectionCard title="About">
              <Fields
                rows={[
                  [
                    "Email",
                    contact.email && (
                      <a href={`mailto:${contact.email}`} className="hover:underline">
                        {contact.email}
                      </a>
                    ),
                  ],
                  [
                    "Phone",
                    contact.phone && (
                      <a href={`tel:${contact.phone}`} className="hover:underline">
                        {contact.phone}
                      </a>
                    ),
                  ],
                  [
                    "Company",
                    contact.company_id && (
                      <Link to={`/companies/${contact.company_id}`} className="hover:underline">
                        {contact.company_name}
                      </Link>
                    ),
                  ],
                  ["Status", <StatusBadge status={contact.status} />],
                  [
                    "Owner",
                    <span className="inline-flex justify-end">
                      <Person name={contact.owner_name} />
                    </span>,
                  ],
                  ["Added", formatDate(contact.created_at)],
                ]}
              />
            </SectionCard>
            <DealsCard
              deals={deals}
              onAdd={() =>
                create({ kind: "deal", defaults: { contact_id: contact.id, company_id: contact.company_id } })
              }
            />
            <TasksCard tasks={tasks} defaults={{ contact_id: contact.id, company_id: contact.company_id }} />
          </>
        }
      >
        <Timeline subject={{ contact_id: contact.id }} />
      </DetailLayout>
      <ContactSheet open={editing} onOpenChange={setEditing} contact={contact} />
    </Page>
  );
}
