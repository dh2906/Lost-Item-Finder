ALTER TABLE items
ADD COLUMN IF NOT EXISTS external_source text,
ADD COLUMN IF NOT EXISTS external_id text,
ADD COLUMN IF NOT EXISTS external_url text,
ADD COLUMN IF NOT EXISTS external_payload jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS items_external_source_id_unique
ON items (external_source, external_id);
