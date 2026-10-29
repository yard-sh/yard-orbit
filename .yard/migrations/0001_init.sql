-- Orbit schema. Every statement is idempotent: migration files are not
-- transactional, so a mid-file failure leaves earlier statements applied and
-- the file unrecorded in _yard_migrations, which re-runs it from the top on
-- the next deploy. IF NOT EXISTS makes that re-run harmless.
--
-- Every CRM row carries workspace_id, and every query the service runs
-- filters on it, so a record from another workspace answers 404 exactly
-- like one that doesn't exist.
--
-- Deletes cascade explicitly in the service: foreign-key enforcement is off
-- by default in SQLite, so ON DELETE CASCADE here would silently do nothing.
--
-- Times are milliseconds since the epoch, written by the service. Money is
-- whole dollars.

-- One row per person who has opened the app. plan is a snapshot of their
-- Yard entitlement ('free' or 'pro'), refreshed on their requests; it is
-- what a workspace's limits read while its owner is away. pro_until is set
-- only for a trial, so a trial that ends while the owner never comes back
-- still runs out.
CREATE TABLE IF NOT EXISTS users (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  email     TEXT NOT NULL DEFAULT '',
  plan      TEXT NOT NULL DEFAULT 'free',
  pro_until INTEGER,
  seen_at   INTEGER NOT NULL
);

-- Everyone owns exactly one workspace, made on their first visit. The
-- unique index on owner_id makes that race-proof: two first requests at
-- once both INSERT OR IGNORE, and only one row survives. invite_token is the
-- workspace's one invite link; resetting it revokes every link shared so far.
CREATE TABLE IF NOT EXISTS workspaces (
  id           TEXT PRIMARY KEY,
  owner_id     TEXT NOT NULL,
  name         TEXT NOT NULL,
  invite_token TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces (owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_invite ON workspaces (invite_token);

-- role is 'owner', 'admin' or 'member'. The owner is listed here too, so
-- "which workspaces can I open" is one lookup.
CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'member',
  joined_at    INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_members_user ON workspace_members (user_id);

-- owner_id on companies, contacts and deals is the account owner: the
-- teammate responsible for it, not whoever typed it in.
CREATE TABLE IF NOT EXISTS companies (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name         TEXT NOT NULL,
  domain       TEXT,
  industry     TEXT,
  size         TEXT,
  owner_id     TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_companies_ws ON companies (workspace_id, updated_at);

-- status is 'lead', 'active', 'customer' or 'churned'.
CREATE TABLE IF NOT EXISTS contacts (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  company_id   TEXT,
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL DEFAULT '',
  email        TEXT,
  phone        TEXT,
  title        TEXT,
  status       TEXT NOT NULL DEFAULT 'lead',
  owner_id     TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contacts_ws ON contacts (workspace_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts (company_id);

-- stage is one of shared/stages.ts. position orders cards within a stage
-- column; the board writes the midpoint of a card's new neighbours, so a
-- move rewrites one row. closed_at is set on entering 'won' or 'lost' and
-- cleared on leaving them.
CREATE TABLE IF NOT EXISTS deals (
  id                TEXT PRIMARY KEY,
  workspace_id      TEXT NOT NULL,
  title             TEXT NOT NULL,
  value             INTEGER NOT NULL DEFAULT 0,
  stage             TEXT NOT NULL DEFAULT 'lead',
  position          REAL NOT NULL DEFAULT 0,
  company_id        TEXT,
  contact_id        TEXT,
  owner_id          TEXT,
  expected_close_at INTEGER,
  closed_at         INTEGER,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_deals_ws ON deals (workspace_id, stage, position);
CREATE INDEX IF NOT EXISTS idx_deals_company ON deals (company_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals (contact_id);

-- A task can hang off a contact, company or deal, or stand alone.
CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  title        TEXT NOT NULL,
  due_at       INTEGER,
  done_at      INTEGER,
  assignee_id  TEXT,
  contact_id   TEXT,
  company_id   TEXT,
  deal_id      TEXT,
  created_by   TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_ws ON tasks (workspace_id, done_at, due_at);

-- The timeline. kind is 'note', 'call', 'email' or 'meeting' (written by
-- people) or 'created' and 'stage_change' (written by the service). An
-- activity logged on a deal also carries the deal's contact and company, so
-- it shows on all three timelines. It is deleted only once none of the
-- three is left.
CREATE TABLE IF NOT EXISTS activities (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  kind         TEXT NOT NULL,
  body         TEXT NOT NULL DEFAULT '',
  contact_id   TEXT,
  company_id   TEXT,
  deal_id      TEXT,
  author_id    TEXT,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activities_ws ON activities (workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activities_contact ON activities (contact_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activities_company ON activities (company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activities_deal ON activities (deal_id, created_at);
