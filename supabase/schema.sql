-- Kumar Enterprises Billing — Supabase Schema Setup
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste → Run
-- You only need to do this ONCE.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Pairing codes (6-char, 10-min TTL, single-use)
CREATE TABLE IF NOT EXISTS pairing_codes (
  code         TEXT PRIMARY KEY,
  owner_id     UUID NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ
);

-- Sync records (unified — all data stored as JSONB)
CREATE TABLE IF NOT EXISTS sync_records (
  owner_id     UUID NOT NULL,
  table_name   TEXT NOT NULL,
  id           TEXT NOT NULL,
  data         JSONB NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL,
  deleted_at   TIMESTAMPTZ,
  PRIMARY KEY (owner_id, table_name, id)
);

CREATE INDEX IF NOT EXISTS idx_sync_owner ON sync_records(owner_id);
CREATE INDEX IF NOT EXISTS idx_sync_updated ON sync_records(owner_id, updated_at);

ALTER TABLE pairing_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_records  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_pairing" ON pairing_codes;
DROP POLICY IF EXISTS "allow_all_sync" ON sync_records;
CREATE POLICY "allow_all_pairing" ON pairing_codes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_sync"    ON sync_records  FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'sync_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sync_records;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION cleanup_expired_codes()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM pairing_codes
  WHERE expires_at < now() OR (used_at IS NOT NULL AND used_at < now() - interval '1 hour');
$$;

SELECT cleanup_expired_codes();
