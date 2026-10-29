import type { FormEventHandler, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// The create/edit drawer every record type shares. Its content unmounts
// while closed, so the form inside starts fresh each time it opens.
export function EntitySheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: SheetProps & { title: string; description: string; children: ReactNode }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}

export function EntityForm({
  onSubmit,
  onCancel,
  pending,
  submitLabel,
  children,
}: {
  onSubmit: FormEventHandler<HTMLFormElement>;
  onCancel: () => void;
  pending: boolean;
  submitLabel: string;
  children: ReactNode;
}) {
  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>{children}</FieldGroup>
      </div>
      <SheetFooter className="flex-row justify-end border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </SheetFooter>
    </form>
  );
}

// The fields of a submitted form that differ from what it opened with.
export function changed<T extends object>(input: T, initial: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([key, value]) => value !== initial[key as keyof T]),
  ) as Partial<T>;
}
