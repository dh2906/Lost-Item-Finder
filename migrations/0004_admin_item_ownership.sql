ALTER TABLE items
ADD COLUMN IF NOT EXISTS user_id integer REFERENCES users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'items_report_type_check'
  ) THEN
    ALTER TABLE items
    ADD CONSTRAINT items_report_type_check CHECK (report_type IN ('lost', 'found'));
  END IF;
END $$;
