import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PersonAvatar({ name, className }: { name: string | null | undefined; className?: string }) {
  return (
    <Avatar className={cn("size-6", className)}>
      <AvatarFallback className="text-[10px] font-medium">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

export function Person({ name }: { name: string | null | undefined }) {
  if (!name) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex items-center gap-2">
      <PersonAvatar name={name} className="size-5" />
      <span className="truncate">{name}</span>
    </span>
  );
}
