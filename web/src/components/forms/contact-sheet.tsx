import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { CONTACT_STATUSES } from "@shared/constants";
import { contactSchema, type ContactInput } from "@shared/schemas";
import type { Contact, ContactDetail } from "@shared/types";
import { Combobox } from "@/components/pickers";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompanyOptions, useMemberOptions } from "@/lib/options";
import { useSave } from "@/lib/queries";
import { useWorkspace } from "@/lib/workspace";
import { changed, EntityForm, EntitySheet, type SheetProps } from "./entity-sheet";
import { FormField } from "./form-field";

type Props = { contact?: Contact; defaults?: Partial<ContactInput>; onSaved?: (id: string) => void };

export function ContactSheet({ contact, defaults, onSaved, ...sheet }: SheetProps & Props) {
  return (
    <EntitySheet
      {...sheet}
      title={contact ? "Edit contact" : "New contact"}
      description="A person you sell to or work with."
    >
      <ContactForm contact={contact} defaults={defaults} onSaved={onSaved} close={() => sheet.onOpenChange(false)} />
    </EntitySheet>
  );
}

function ContactForm({ contact, defaults, onSaved, close }: Props & { close: () => void }) {
  const { me } = useWorkspace();
  const companies = useCompanyOptions();
  const members = useMemberOptions();
  const save = useSave<Partial<ContactInput>, ContactDetail>("contacts");
  const initial: ContactInput = {
    first_name: contact?.first_name ?? "",
    last_name: contact?.last_name ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    title: contact?.title ?? "",
    status: contact?.status ?? "lead",
    company_id: contact?.company_id ?? null,
    owner_id: contact ? contact.owner_id : me.user.id,
    ...defaults,
  };
  const form = useForm<ContactInput>({ resolver: zodResolver(contactSchema), defaultValues: initial });

  const onSubmit = form.handleSubmit((input) => {
    // An edit sends only what changed, so a field nobody touched (an
    // owner who has since left, say) is never re-validated.
    const body = contact ? changed(input, initial) : input;
    if (!Object.keys(body).length) return close();
    save.mutate(
      { id: contact?.id, input: body },
      {
        onSuccess: (saved) => {
          toast.success(contact ? "Contact updated" : "Contact added");
          close();
          onSaved?.(saved.contact.id);
        },
      },
    );
  });

  return (
    <EntityForm
      onSubmit={onSubmit}
      onCancel={close}
      pending={save.isPending}
      submitLabel={contact ? "Save changes" : "Add contact"}
    >
      <div className="grid grid-cols-2 gap-4">
        <FormField control={form.control} name="first_name" label="First name">
          {(field) => <Input {...field} autoFocus />}
        </FormField>
        <FormField control={form.control} name="last_name" label="Last name">
          {(field) => <Input {...field} />}
        </FormField>
      </div>
      <FormField control={form.control} name="email" label="Email">
        {(field) => <Input {...field} type="email" />}
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField control={form.control} name="phone" label="Phone">
          {(field) => <Input {...field} type="tel" />}
        </FormField>
        <FormField control={form.control} name="title" label="Job title">
          {(field) => <Input {...field} />}
        </FormField>
      </div>
      <FormField control={form.control} name="company_id" label="Company">
        {({ value, onChange, id }) => (
          <Combobox id={id} value={value} onChange={onChange} options={companies} placeholder="No company" />
        )}
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField control={form.control} name="status" label="Status">
          {({ value, onChange, id }) => (
            <Select value={value} onValueChange={onChange}>
              <SelectTrigger id={id} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_STATUSES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
        <FormField control={form.control} name="owner_id" label="Owner">
          {({ value, onChange, id }) => (
            <Combobox
              id={id}
              value={value}
              onChange={onChange}
              options={members}
              placeholder="Unassigned"
              missingLabel="Former member"
            />
          )}
        </FormField>
      </div>
    </EntityForm>
  );
}
