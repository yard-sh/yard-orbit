const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const longDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const relative = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

export const formatMoney = (value: number) => currency.format(value);
export const formatMoneyCompact = (value: number) => compactCurrency.format(value);

export function formatDate(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const date = new Date(ms);
  return date.getFullYear() === new Date().getFullYear() ? shortDate.format(date) : longDate.format(date);
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86_400_000],
  ["month", 30 * 86_400_000],
  ["week", 7 * 86_400_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

export function formatRelative(ms: number): string {
  const diff = ms - Date.now();
  for (const [unit, size] of UNITS) {
    if (Math.abs(diff) >= size) return relative.format(Math.round(diff / size), unit);
  }
  return "just now";
}

export function fullName(person: { first_name: string; last_name: string }): string {
  return `${person.first_name} ${person.last_name}`.trim();
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

// Due dates are whole days: a picked date is stored as the end of that day
// in the viewer's time zone, so "due today" stays due until midnight.
export function endOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
