-- Third-party integrations. Tokens never live in the shared `docs` table (which clients can write);
-- they live here, encrypted with TOKEN_ENCRYPTION_KEY, and are only ever read by the Worker.

CREATE TABLE integration_accounts (
  id          TEXT PRIMARY KEY,                 -- deterministic hash of the tuple below
  org_id      TEXT NOT NULL,
  provider    TEXT NOT NULL,                    -- github | figma | canva
  kind        TEXT NOT NULL,                    -- 'user' (one person's linked account) | 'installation' (org-wide app install)
  user_id     TEXT NOT NULL DEFAULT '',         -- Mika user for kind='user'; '' for installations
  external_id TEXT NOT NULL,                    -- the provider's own id: GitHub user/installation id, Figma user id, Canva user id
  label       TEXT NOT NULL DEFAULT '',         -- what the UI shows, e.g. a GitHub login
  secret_enc  TEXT,                             -- AES-GCM encrypted JSON {access_token, refresh_token, expires_at}; NULL when nothing is stored
  scopes      TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX integration_accounts_uq ON integration_accounts(org_id, provider, kind, user_id, external_id);
CREATE INDEX integration_accounts_ext ON integration_accounts(provider, kind, external_id);
CREATE INDEX integration_accounts_user ON integration_accounts(org_id, provider, user_id);

-- Webhooks we registered with a provider (Figma). The passcode is stored only as a hash.
CREATE TABLE integration_webhooks (
  provider      TEXT NOT NULL,
  webhook_id    TEXT NOT NULL,
  org_id        TEXT NOT NULL,
  task_id       TEXT,
  context_id    TEXT,
  created_by    TEXT NOT NULL,
  passcode_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (provider, webhook_id)
);

-- Providers retry webhooks; remembering delivery ids makes handling idempotent.
CREATE TABLE webhook_deliveries (
  provider    TEXT NOT NULL,
  delivery_id TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  PRIMARY KEY (provider, delivery_id)
);
