import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { COMPANY_SIZES } from "@shared/constants";
import { companySchema, type CompanyInput } from "@shared/schemas";
import type { Company, CompanyDetail } from "@shared/types";
import { Combobox } from "@/components/pickers";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemberOptions } from "@/lib/options";
import { useSave } from "@/lib/queries";
import { useWorkspace } from "@/lib/workspace";
import { changed, EntityForm, EntitySheet, type SheetProps } from "./entity-sheet";
import { FormField } from "./form-field";

const NO_SIZE = "unknown";

type Props = { company?: Company; onSaved?: (id: string) => void };

export function CompanySheet({ company, onSaved, ...sheet }: SheetProps & Props) {
  return (
    <EntitySheet {...sheet} title={company ? "Edit company" : "New company"} description="An organization you sell to.">
      <CompanyForm company={company} onSaved={onSaved} close={() => sheet.onOpenChange(false)} />
    </EntitySheet>
  );
}

function CompanyForm({ company, onSaved, close }: Props & { close: () => void }) {
  const { me } = useWorkspace();
  const members = useMemberOptions();
  const save = useSave<Partial<CompanyInput>, CompanyDetail>("companies");
  const initial: CompanyInput = {
    name: company?.name ?? "",
    domain: company?.domain ?? "",
    industry: company?.industry ?? "",
    size: company?.size ?? null,
    owner_id: company ? company.owner_id : me.user.id,
  };
  const form = useForm<CompanyInput>({ resolver: zodResolver(companySchema), defaultValues: initial });

  const onSubmit = form.handleSubmit((input) => {
    // An edit sends only what changed, so a field nobody touched (an
    // owner who has since left, say) is never re-validated.
    const body = company ? changed(input, initial) : input;
    if (!Object.keys(body).length) return close();
    save.mutate(
      { id: company?.id, input: body },
      {
        onSuccess: (saved) => {
          toast.success(company ? "Company updated" : "Company added");
          close();
          onSaved?.(saved.company.id);
        },
      },
    );
  });

  return (
    <EntityForm
      onSubmit={onSubmit}
      onCancel={close}
      pending={save.isPending}
      submitLabel={company ? "Save changes" : "Add company"}
    >
      <FormField control={form.control} name="name" label="Name">
        {(field) => <Input {...field} autoFocus />}
      </FormField>
      <FormField control={form.control} name="domain" label="Website">
        {(field) => <Input {...field} placeholder="example.com" />}
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField control={form.control} name="industry" label="Industry">
          {(field) => <Input {...field} />}
        </FormField>
        <FormField control={form.control} name="size" label="Employees">
          {({ value, onChange, id }) => (
            <Select value={value ?? NO_SIZE} onValueChange={(v) => onChange(v === NO_SIZE ? null : v)}>
              <SelectTrigger id={id} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SIZE}>Unknown</SelectItem>
                {COMPANY_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
      </div>
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
    </EntityForm>
  );
}
