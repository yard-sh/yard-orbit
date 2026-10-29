// The SELECTs behind every row type in shared/types.ts, with the joined
// names the app shows. Callers append their own WHERE and ORDER BY.

export const COMPANY_SELECT =
  "SELECT co.id, co.name, co.domain, co.industry, co.size, co.owner_id, u.name AS owner_name," +
  " (SELECT COUNT(*) FROM contacts x WHERE x.company_id = co.id) AS contact_count," +
  " (SELECT COALESCE(SUM(d.value), 0) FROM deals d WHERE d.company_id = co.id AND d.stage NOT IN ('won', 'lost')) AS open_deal_value," +
  " co.created_at, co.updated_at" +
  " FROM companies co LEFT JOIN users u ON u.id = co.owner_id";

export const CONTACT_SELECT =
  "SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.title, c.status," +
  " c.company_id, co.name AS company_name, c.owner_id, u.name AS owner_name, c.created_at, c.updated_at" +
  " FROM contacts c LEFT JOIN companies co ON co.id = c.company_id LEFT JOIN users u ON u.id = c.owner_id";

export const DEAL_SELECT =
  "SELECT d.id, d.title, d.value, d.stage, d.position, d.company_id, co.name AS company_name," +
  " d.contact_id, TRIM(c.first_name || ' ' || c.last_name) AS contact_name, d.owner_id, u.name AS owner_name," +
  " d.expected_close_at, d.closed_at, d.created_at, d.updated_at" +
  " FROM deals d LEFT JOIN companies co ON co.id = d.company_id LEFT JOIN contacts c ON c.id = d.contact_id" +
  " LEFT JOIN users u ON u.id = d.owner_id";

export const TASK_SELECT =
  "SELECT t.id, t.title, t.due_at, t.done_at, t.assignee_id, u.name AS assignee_name," +
  " t.contact_id, TRIM(c.first_name || ' ' || c.last_name) AS contact_name, t.company_id, co.name AS company_name," +
  " t.deal_id, d.title AS deal_title, t.created_at" +
  " FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id LEFT JOIN contacts c ON c.id = t.contact_id" +
  " LEFT JOIN companies co ON co.id = t.company_id LEFT JOIN deals d ON d.id = t.deal_id";

// Open tasks first, soonest due first, undated last; done tasks after.
export const TASK_ORDER =
  " ORDER BY (t.done_at IS NOT NULL), (t.due_at IS NULL), t.due_at, t.done_at DESC, t.created_at DESC";

export const ACTIVITY_SELECT =
  "SELECT a.id, a.kind, a.body, a.contact_id, TRIM(c.first_name || ' ' || c.last_name) AS contact_name," +
  " a.company_id, co.name AS company_name, a.deal_id, d.title AS deal_title, a.author_id, u.name AS author_name, a.created_at" +
  " FROM activities a LEFT JOIN contacts c ON c.id = a.contact_id LEFT JOIN companies co ON co.id = a.company_id" +
  " LEFT JOIN deals d ON d.id = a.deal_id LEFT JOIN users u ON u.id = a.author_id";
