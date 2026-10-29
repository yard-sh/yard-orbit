import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Page({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex flex-1 flex-col gap-6 p-4 md:p-6", className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        {children}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
