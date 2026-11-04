-- Mika D1 schema.
-- Identity and sessions are relational; everything an organisation owns lives in one
-- versioned document table so the app's existing TypeScript shapes round-trip untouched.

CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  google_sub  TEXT UNIQUE,
  json        TEXT NOT NULL,           -- public profile (User shape)
  created_at  TEXT NOT NULL
);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,        -- random 256-bit token, sent as Bearer
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE orgs (
  id          TEXT PRIMARY KEY,
  json        TEXT NOT NULL,           -- Organization shape
  created_at  TEXT NOT NULL
);

-- Organisation-scoped documents. kind is one of:
--   department, role, assignment, user, task, comment, meeting, file,
--   notification, message, connection, compliance, event
CREATE TABLE docs (
  org_id      TEXT NOT NULL,
  kind        TEXT NOT NULL,
  id          TEXT NOT NULL,
  json        TEXT NOT NULL,
  updated_at  INTEGER NOT NULL,        -- ms epoch, monotonic per write; drives /changes polling
  deleted     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, kind, id)
);
CREATE INDEX docs_changes ON docs(org_id, updated_at);

-- Invite links are looked up by token before the caller belongs to any org.
CREATE TABLE invite_links (
  token       TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL,
  role_id     TEXT NOT NULL,
  json        TEXT NOT NULL,           -- JoinLink shape
  expires_at  INTEGER NOT NULL,
  max_uses    INTEGER,
  use_count   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX invite_links_org ON invite_links(org_id);
