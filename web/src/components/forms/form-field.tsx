import type { ReactNode } from "react";
import {
  Controller,
  type Control,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

// One labelled form field: a react-hook-form Controller rendered with
// shadcn's Field, showing the shared schema's message when it fails.
export function FormField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  className,
  children,
}: {
  control: Control<T>;
  name: N;
  label: string;
  className?: string;
  children: (field: ControllerRenderProps<T, N> & { id: string; "aria-invalid": boolean }) => ReactNode;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={cn(className)}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          {children({ ...field, id: name, "aria-invalid": fieldState.invalid })}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}
