ALTER TABLE users
ALTER COLUMN password DROP NOT NULL;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_image_url text;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS auth_provider text NOT NULL DEFAULT 'local';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS auth_provider_id text;

CREATE UNIQUE INDEX IF NOT EXISTS users_auth_provider_id_unique
ON users (auth_provider, auth_provider_id);

ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_oauth_provider_id_required;

ALTER TABLE users
ADD CONSTRAINT users_oauth_provider_id_required
CHECK (auth_provider = 'local' OR auth_provider_id IS NOT NULL);

ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_local_password_required;

ALTER TABLE users
ADD CONSTRAINT users_local_password_required
CHECK (auth_provider <> 'local' OR password IS NOT NULL);

CREATE TABLE IF NOT EXISTS item_claim_reports (
  id serial PRIMARY KEY,
  reporter_id integer NOT NULL REFERENCES users(id) ON DELETE cascade,
  item_id integer REFERENCES items(id) ON DELETE set null,
  suspected_user_info text,
  incident_summary text NOT NULL,
  evidence text,
  contact_info text,
  status text NOT NULL DEFAULT 'open',
  admin_note text,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

ALTER TABLE item_claim_reports
DROP CONSTRAINT IF EXISTS item_claim_reports_status_check;

ALTER TABLE item_claim_reports
ADD CONSTRAINT item_claim_reports_status_check
CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed'));

CREATE INDEX IF NOT EXISTS item_claim_reports_reporter_idx
ON item_claim_reports (reporter_id);

CREATE INDEX IF NOT EXISTS item_claim_reports_item_idx
ON item_claim_reports (item_id);

CREATE INDEX IF NOT EXISTS item_claim_reports_status_idx
ON item_claim_reports (status);
