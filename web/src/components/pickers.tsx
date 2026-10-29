import { CalendarIcon, CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { endOfDay, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface Option {
  value: string;
  label: string;
}

// A searchable single choice that can be cleared: a contact's company, a
// deal's owner. null is "none".
export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder,
  missingLabel,
}: {
  id?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: Option[];
  placeholder: string;
  // Shown for a saved value that isn't among the options any more.
  missingLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected =
    options.find((o) => o.value === value) ??
    (value !== null && missingLabel && options.length ? { value, label: missingLabel } : undefined);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild>
          <Button id={id} variant="outline" role="combobox" className="w-full justify-between font-normal">
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected?.label ?? placeholder}
            </span>
            <ChevronsUpDownIcon className="opacity-50" />
          </Button>
        </PopoverTrigger>
        {selected && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="absolute top-1/2 right-8 -translate-y-1/2"
            aria-label="Clear"
            onClick={() => onChange(null)}
          >
            <XIcon />
          </Button>
        )}
      </div>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>Nothing found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.value}`}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <CheckIcon className={cn(option.value === value ? "opacity-100" : "opacity-0")} />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Pick a date",
}: {
  id?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          className={cn("w-full justify-start font-normal", value == null && "text-muted-foreground")}
        >
          <CalendarIcon />
          {value == null ? placeholder : formatDate(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value == null ? undefined : new Date(value)}
          onSelect={(date) => {
            onChange(date ? endOfDay(date) : null);
            setOpen(false);
          }}
        />
        {value != null && (
          <div className="border-t p-2">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange(null)}>
              Clear date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
