import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { STAGES } from "@shared/constants";
import { dealSchema, type DealInput } from "@shared/schemas";
import type { Deal, DealDetail } from "@shared/types";
import { Dot, STAGE_COLOR } from "@/components/badges";
import { Combobox, DatePicker } from "@/components/pickers";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompanyOptions, useContactOptions, useMemberOptions } from "@/lib/options";
import { useSave } from "@/lib/queries";
import { useWorkspace } from "@/lib/workspace";
import { changed, EntityForm, EntitySheet, type SheetProps } from "./entity-sheet";
import { FormField } from "./form-field";

type Props = { deal?: Deal; defaults?: Partial<DealInput>; onSaved?: (id: string) => void };

export function DealSheet({ deal, defaults, onSaved, ...sheet }: SheetProps & Props) {
  return (
    <EntitySheet
      {...sheet}
      title={deal ? "Edit deal" : "New deal"}
      description="An opportunity moving through your pipeline."
    >
      <DealForm deal={deal} defaults={defaults} onSaved={onSaved} close={() => sheet.onOpenChange(false)} />
    </EntitySheet>
  );
}

function DealForm({ deal, defaults, onSaved, close }: Props & { close: () => void }) {
  const { me } = useWorkspace();
  const companies = useCompanyOptions();
  const contacts = useContactOptions();
  const members = useMemberOptions();
  const save = useSave<Partial<DealInput>, DealDetail>("deals");
  const initial: DealInput = {
    title: deal?.title ?? "",
    value: deal?.value ?? 0,
    stage: deal?.stage ?? "lead",
    company_id: deal?.company_id ?? null,
    contact_id: deal?.contact_id ?? null,
    owner_id: deal ? deal.owner_id : me.user.id,
    expected_close_at: deal?.expected_close_at ?? null,
    ...defaults,
  };
  const form = useForm<DealInput>({ resolver: zodResolver(dealSchema), defaultValues: initial });

  const onSubmit = form.handleSubmit((input) => {
    // An edit sends only what changed, so a field nobody touched (an
    // owner who has since left, say) is never re-validated.
    const body = deal ? changed(input, initial) : input;
    if (!Object.keys(body).length) return close();
    save.mutate(
      { id: deal?.id, input: body },
      {
        onSuccess: (saved) => {
          toast.success(deal ? "Deal updated" : "Deal created");
          close();
          onSaved?.(saved.deal.id);
        },
      },
    );
  });

  return (
    <EntityForm
      onSubmit={onSubmit}
      onCancel={close}
      pending={save.isPending}
      submitLabel={deal ? "Save changes" : "Create deal"}
    >
      <FormField control={form.control} name="title" label="Title">
        {(field) => <Input {...field} autoFocus placeholder="Annual plan for Acme" />}
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField control={form.control} name="value" label="Value (USD)">
          {({ value, onChange, ...field }) => (
            <Input
              {...field}
              type="number"
              min={0}
              step={100}
              value={Number.isNaN(value) ? "" : value}
              onChange={(e) => onChange(e.target.value === "" ? Number.NaN : e.target.valueAsNumber)}
            />
          )}
        </FormField>
        <FormField control={form.control} name="stage" label="Stage">
          {({ value, onChange, id }) => (
            <Select value={value} onValueChange={onChange}>
              <SelectTrigger id={id} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    <Dot className={STAGE_COLOR[s.key]} />
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
      </div>
      <FormField control={form.control} name="company_id" label="Company">
        {({ value, onChange, id }) => (
          <Combobox id={id} value={value} onChange={onChange} options={companies} placeholder="No company" />
        )}
      </FormField>
      <FormField control={form.control} name="contact_id" label="Primary contact">
        {({ value, onChange, id }) => (
          <Combobox id={id} value={value} onChange={onChange} options={contacts} placeholder="No contact" />
        )}
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField control={form.control} name="expected_close_at" label="Expected close">
          {({ value, onChange, id }) => <DatePicker id={id} value={value} onChange={onChange} />}
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
