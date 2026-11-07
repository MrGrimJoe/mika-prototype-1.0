-- "Host your own server": an organisation's own S3-compatible storage (Garage, SeaweedFS, RustFS, MinIO, Ceph, ...).
-- The access key and secret are encrypted (AES-GCM, bound to this row) and are never returned by any API.
CREATE TABLE org_storage (
  org_id      TEXT PRIMARY KEY,
  endpoint    TEXT NOT NULL,                 -- https://storage.school.example
  region      TEXT NOT NULL DEFAULT 'us-east-1',
  bucket      TEXT NOT NULL,
  path_style  INTEGER NOT NULL DEFAULT 1,    -- 1 = https://host/bucket/key (what self-hosted servers expect)
  secret_enc  TEXT NOT NULL,
  key_hint    TEXT NOT NULL DEFAULT '',      -- last 4 characters of the access key id, so the root can tell which key is saved
  updated_by  TEXT NOT NULL,
  updated_at  INTEGER NOT NULL,
  verified_at INTEGER
);
