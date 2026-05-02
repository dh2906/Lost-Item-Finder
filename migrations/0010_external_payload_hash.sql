ALTER TABLE items
ADD COLUMN IF NOT EXISTS external_payload_hash text;
