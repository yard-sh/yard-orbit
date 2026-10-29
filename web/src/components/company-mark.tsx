import { cn } from "@/lib/utils";

// A company's initial on a tile, standing in for a logo.
export function CompanyMark({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md border text-xs font-semibold uppercase",
        className,
      )}
    >
      {name.trim()[0] ?? "?"}
    </span>
  );
}
