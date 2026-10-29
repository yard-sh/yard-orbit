import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { useActions } from "@/components/app-actions";
import { StatusBadge } from "@/components/badges";
import { CompanyMark } from "@/components/company-mark";
import {
  AddButton,
  DealsCard,
  DetailLayout,
  DetailSkeleton,
  Fields,
  RecordActions,
  SectionCard,
  TasksCard,
} from "@/components/detail";
import { CompanySheet } from "@/components/forms/company-sheet";
import { Page, PageHeader } from "@/components/page";
import { Person, PersonAvatar } from "@/components/person";
import { Timeline } from "@/components/timeline";
import { formatDate, formatMoney, fullName } from "@/lib/format";
import { useCompany, useRemove } from "@/lib/queries";
import { NotFound } from "@/pages/not-found";

export function CompanyPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { create } = useActions();
  const { data, error } = useCompany(id);
  const remove = useRemove("companies");
  const [editing, setEditing] = useState(false);

  if (error) return <NotFound what="company" back="/companies" />;
  if (!data) return <DetailSkeleton />;
  const { company, contacts, deals, tasks } = data;

  return (
    <Page>
      <PageHeader
        title={company.name}
        description={
          [company.industry, company.size && `${company.size} employees`].filter(Boolean).join(" · ") || undefined
        }
        actions={
          <RecordActions
            noun="company"
            name={company.name}
            consequence="Its people, deals and tasks stay, no longer filed under it."
            onEdit={() => setEditing(true)}
            onDelete={() => {
              // Leave first, so this page doesn't refetch the deleted company.
              // A failure is toasted by the mutation cache (main.tsx).
              navigate("/companies");
              remove.mutateAsync(company.id).then(
                () => toast.success("Company deleted"),
                () => {},
              );
            }}
          />
        }
      >
        <CompanyMark name={company.name} className="size-12 text-lg" />
      </PageHeader>
      <DetailLayout
        aside={
          <>
            <SectionCard title="About">
              <Fields
                rows={[
                  [
                    "Website",
                    company.domain && (
                      <a
                        href={`https://${company.domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        {company.domain}
                      </a>
                    ),
                  ],
                  ["Industry", company.industry],
                  ["Employees", company.size],
                  ["Open pipeline", formatMoney(company.open_deal_value)],
                  [
                    "Owner",
                    <span className="inline-flex justify-end">
                      <Person name={company.owner_name} />
                    </span>,
                  ],
                  ["Added", formatDate(company.created_at)],
                ]}
              />
            </SectionCard>
            <SectionCard
              title={`People · ${contacts.length}`}
              action={
                <AddButton
                  label="Add person"
                  onClick={() => create({ kind: "contact", defaults: { company_id: company.id } })}
                />
              }
            >
              {contacts.length ? (
                <ul className="flex flex-col gap-3">
                  {contacts.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 text-sm">
                      <PersonAvatar name={fullName(c)} className="size-8" />
                      <div className="min-w-0 flex-1">
                        <Link to={`/contacts/${c.id}`} className="block truncate font-medium hover:underline">
                          {fullName(c)}
                        </Link>
                        <span className="text-muted-foreground block truncate text-xs">{c.title}</span>
                      </div>
                      <StatusBadge status={c.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">No people yet.</p>
              )}
            </SectionCard>
            <DealsCard deals={deals} onAdd={() => create({ kind: "deal", defaults: { company_id: company.id } })} />
            <TasksCard tasks={tasks} defaults={{ company_id: company.id }} />
          </>
        }
      >
        <Timeline subject={{ company_id: company.id }} />
      </DetailLayout>
      <CompanySheet open={editing} onOpenChange={setEditing} company={company} />
    </Page>
  );
}
