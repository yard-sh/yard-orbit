// Read these back with `yard service logs` (add --since 2h). Every line
// starts with [orbit] and is one event, so it greps cleanly:
//   yard service logs | grep deal.move
//
// Not logged: names, emails, notes, deal titles or any other CRM content.
// Ids are cut to 8 characters: enough to correlate lines within a session,
// not a lasting identifier in a log store.

export function log(event: string, fields: Record<string, unknown> = {}) {
  const parts = ["[orbit] " + event];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    parts.push(`${key}=${value}`);
  }
  console.log(parts.join(" "));
}

export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : "-";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function redactPath(path: string): string {
  return path
    .split("/")
    .map((s) => (UUID.test(s) ? shortId(s) : s.length > 24 ? "…" : s))
    .join("/");
}
