-- Linked work (Figma / Canva) and the activity Mika has observed about it.
-- Nothing here stores provider tokens (those stay encrypted in integration_accounts) or provider content
-- beyond what accountability needs: a title, a link, a version marker and an optional thumbnail hint.

-- A resource a person has deliberately linked to one assignment (task). Linking is NOT submitting.
CREATE TABLE integration_resources (
  id                   TEXT PRIMARY KEY,               -- deterministic hash of (org, task, provider, external id, node), so re-linking is idempotent
  org_id               TEXT NOT NULL,
  task_id              TEXT NOT NULL,
  provider             TEXT NOT NULL,                  -- figma | canva
  external_id          TEXT NOT NULL,                  -- Figma file key / Canva design id
  node_id              TEXT NOT NULL DEFAULT '',       -- Figma frame id when the link points at one
  resource_type        TEXT NOT NULL,                  -- design | prototype | board | ...
  url                  TEXT NOT NULL,
  title                TEXT NOT NULL DEFAULT '',
  linked_by            TEXT NOT NULL,                  -- Mika user whose OWN provider account is used to read it
  linked_at            INTEGER NOT NULL,               -- ms epoch (all timestamps in these tables are ms epoch)
  version              TEXT,                           -- latest provider revision id we have seen, when the provider has one
  provider_modified_at INTEGER,                        -- provider-reported last-modified time
  thumbnail_url        TEXT,                           -- provider URL, short lived: a hint only
  preview_file_id      TEXT,                           -- preview archived in Mika storage when the resource was submitted
  last_synced_at       INTEGER,
  sync_state           TEXT NOT NULL DEFAULT 'never',  -- never | ok | error | reconnect
  sync_error           TEXT,
  retry_count          INTEGER NOT NULL DEFAULT 0,
  next_sync_after      INTEGER,                        -- backoff: do not call the provider before this time
  activity_cursor      TEXT,                           -- provider specific JSON, only an optimisation (events are deduplicated regardless)
  limits               TEXT NOT NULL DEFAULT '',       -- comma separated capabilities the provider refused on the last sync (e.g. comments)
  submitted_at         INTEGER,                        -- set only by an explicit submission by the assignee
  submitted_by         TEXT
);
CREATE UNIQUE INDEX integration_resources_uq ON integration_resources(org_id, task_id, provider, external_id, node_id);
CREATE INDEX integration_resources_task ON integration_resources(org_id, task_id);
CREATE INDEX integration_resources_ext  ON integration_resources(org_id, provider, external_id);

-- One normalised row per thing that happened. Three different things live here and are never conflated:
--   activity    what the provider reported about a linked resource (version saved, comment added, file changed)
--   submission  the assignee explicitly presented a resource as their deliverable
--   review      an authorised reviewer accepted it or sent it back
-- No row means "done". Completion is decided only by the task's own review flow.
CREATE TABLE integration_events (
  id                TEXT PRIMARY KEY,                  -- hash of (resource, source event), so a replayed webhook or a repeated sync is a no-op
  org_id            TEXT NOT NULL,
  task_id           TEXT NOT NULL,
  resource_id       TEXT NOT NULL,
  provider          TEXT NOT NULL,
  event_type        TEXT NOT NULL,
  source_event_id   TEXT NOT NULL,                     -- provider event id, or a Mika-generated one for Mika-side events
  actor_external_id TEXT,                              -- provider user id, only when the provider supplies one
  actor_user_id     TEXT,                              -- Mika user, only when that provider id is linked to exactly one member
  occurred_at       INTEGER NOT NULL,                  -- when it happened (provider clock where given)
  received_at       INTEGER NOT NULL,                  -- when Mika learned of it; late and out-of-order events keep their own occurred_at
  metadata          TEXT NOT NULL DEFAULT '{}'         -- minimal safe fields only: ids, counts, short labels. Never comment text or file content.
);
CREATE UNIQUE INDEX integration_events_src  ON integration_events(resource_id, source_event_id);
CREATE INDEX        integration_events_task ON integration_events(org_id, task_id, occurred_at);

-- Activity-only Figma webhooks Mika registered when a file was linked. They can record events but can never
-- submit a task (the older integration_webhooks table, used by the version-label shortcut, is unchanged).
CREATE TABLE integration_watches (
  provider      TEXT NOT NULL,
  webhook_id    TEXT NOT NULL,
  org_id        TEXT NOT NULL,
  context_id    TEXT NOT NULL,                         -- Figma file key
  event_type    TEXT NOT NULL,                         -- FILE_VERSION_UPDATE | FILE_COMMENT
  created_by    TEXT NOT NULL,                         -- Mika user whose Figma account owns the webhook
  passcode_hash TEXT NOT NULL,                         -- the passcode itself is never stored
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (provider, webhook_id)
);
CREATE UNIQUE INDEX integration_watches_uq ON integration_watches(provider, org_id, context_id, event_type, created_by);
