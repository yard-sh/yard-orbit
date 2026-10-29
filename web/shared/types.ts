// What the API answers with. Rows come back as the service selects them,
// joined names included, so the app never needs a second request to label
// a foreign key.

import type { ActivityKind, CompanySize, ContactStatus, Limits, Plan, Role, Stage } from "./constants";

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: Role;
  is_owner: boolean;
  plan: Plan;
}

export interface Me {
  user: User;
  // This person's own plan: what they bought, not any workspace's.
  plan: Plan;
  entitlement: "none" | "trial" | "active" | "owner";
  workspaces: WorkspaceSummary[];
}

export interface Workspace extends WorkspaceSummary {
  owner_id: string;
  owner_name: string;
  limits: Limits;
  usage: { members: number; contacts: number; open_deals: number };
  // Only admins and the owner see the invite link.
  invite_token: string | null;
}

export interface Member {
  user_id: string;
  name: string;
  email: string;
  role: Role;
  joined_at: number;
}

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: CompanySize | null;
  owner_id: string | null;
  owner_name: string | null;
  contact_count: number;
  open_deal_value: number;
  created_at: number;
  updated_at: number;
}

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  status: ContactStatus;
  company_id: string | null;
  company_name: string | null;
  owner_id: string | null;
  owner_name: string | null;
  created_at: number;
  updated_at: number;
}

export interface Deal {
  id: string;
  title: string;
  value: number;
  stage: Stage;
  position: number;
  company_id: string | null;
  company_name: string | null;
  contact_id: string | null;
  contact_name: string | null;
  owner_id: string | null;
  owner_name: string | null;
  expected_close_at: number | null;
  closed_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface Task {
  id: string;
  title: string;
  due_at: number | null;
  done_at: number | null;
  assignee_id: string | null;
  assignee_name: string | null;
  contact_id: string | null;
  contact_name: string | null;
  company_id: string | null;
  company_name: string | null;
  deal_id: string | null;
  deal_title: string | null;
  created_at: number;
}

export interface Activity {
  id: string;
  kind: ActivityKind;
  body: string;
  contact_id: string | null;
  contact_name: string | null;
  company_id: string | null;
  company_name: string | null;
  deal_id: string | null;
  deal_title: string | null;
  author_id: string | null;
  author_name: string | null;
  created_at: number;
}

export interface CompanyDetail {
  company: Company;
  contacts: Contact[];
  deals: Deal[];
  tasks: Task[];
}

export interface ContactDetail {
  contact: Contact;
  deals: Deal[];
  tasks: Task[];
}

export interface DealDetail {
  deal: Deal;
  tasks: Task[];
}

export interface Dashboard {
  counts: { contacts: number; companies: number; open_deals: number };
  stages: { stage: Stage; count: number; value: number }[];
  // Raw closes for the last six months; the app buckets them by month in
  // the viewer's time zone.
  closed: { stage: "won" | "lost"; value: number; closed_at: number }[];
  my_tasks: Task[];
  recent: Activity[];
}

export interface InvitePreview {
  workspace: { id: string; name: string };
  owner_name: string;
  member_count: number;
  already_member: boolean;
  // The workspace is at its owner's member limit: nobody new can join.
  full: boolean;
}

export interface ApiErrorBody {
  error: string;
  code: string;
  limit?: keyof Limits;
}
