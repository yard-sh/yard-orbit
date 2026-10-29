import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { taskSchema, type TaskInput } from "@shared/schemas";
import type { Task } from "@shared/types";
import { Combobox, DatePicker } from "@/components/pickers";
import { Input } from "@/components/ui/input";
import { useCompanyOptions, useContactOptions, useDealOptions, useMemberOptions } from "@/lib/options";
import { useSave } from "@/lib/queries";
import { useWorkspace } from "@/lib/workspace";
import { changed, EntityForm, EntitySheet, type SheetProps } from "./entity-sheet";
import { FormField } from "./form-field";

type Props = { task?: Task; defaults?: Partial<TaskInput> };

export function TaskSheet({ task, defaults, ...sheet }: SheetProps & Props) {
  return (
    <EntitySheet
      {...sheet}
      title={task ? "Edit task" : "New task"}
      description="A follow-up with a due date and an owner."
    >
      <TaskForm task={task} defaults={defaults} close={() => sheet.onOpenChange(false)} />
    </EntitySheet>
  );
}

function TaskForm({ task, defaults, close }: Props & { close: () => void }) {
  const { me } = useWorkspace();
  const members = useMemberOptions();
  const contacts = useContactOptions();
  const companies = useCompanyOptions();
  const deals = useDealOptions();
  const save = useSave<Partial<TaskInput>, Task>("tasks");
  const initial: TaskInput = {
    title: task?.title ?? "",
    due_at: task?.due_at ?? null,
    assignee_id: task ? task.assignee_id : me.user.id,
    contact_id: task?.contact_id ?? null,
    company_id: task?.company_id ?? null,
    deal_id: task?.deal_id ?? null,
    ...defaults,
  };
  const form = useForm<TaskInput>({ resolver: zodResolver(taskSchema), defaultValues: initial });

  const onSubmit = form.handleSubmit((input) => {
    // An edit sends only what changed, so a field nobody touched (an
    // assignee who has since left, say) is never re-validated.
    const body = task ? changed(input, initial) : input;
    if (!Object.keys(body).length) return close();
    save.mutate(
      { id: task?.id, input: body },
      {
        onSuccess: () => {
          toast.success(task ? "Task updated" : "Task added");
          close();
        },
      },
    );
  });

  return (
    <EntityForm
      onSubmit={onSubmit}
      onCancel={close}
      pending={save.isPending}
      submitLabel={task ? "Save changes" : "Add task"}
    >
      <FormField control={form.control} name="title" label="Task">
        {(field) => <Input {...field} autoFocus placeholder="Send the proposal" />}
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField control={form.control} name="due_at" label="Due">
          {({ value, onChange, id }) => (
            <DatePicker id={id} value={value} onChange={onChange} placeholder="No due date" />
          )}
        </FormField>
        <FormField control={form.control} name="assignee_id" label="Assignee">
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
      <FormField control={form.control} name="deal_id" label="Deal">
        {({ value, onChange, id }) => (
          <Combobox id={id} value={value} onChange={onChange} options={deals} placeholder="None" />
        )}
      </FormField>
      <FormField control={form.control} name="contact_id" label="Contact">
        {({ value, onChange, id }) => (
          <Combobox id={id} value={value} onChange={onChange} options={contacts} placeholder="None" />
        )}
      </FormField>
      <FormField control={form.control} name="company_id" label="Company">
        {({ value, onChange, id }) => (
          <Combobox id={id} value={value} onChange={onChange} options={companies} placeholder="None" />
        )}
      </FormField>
    </EntityForm>
  );
}
