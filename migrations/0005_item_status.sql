ALTER TABLE items
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

UPDATE items
SET status = 'active'
WHERE status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'items_status_check'
  ) THEN
    ALTER TABLE items
    ADD CONSTRAINT items_status_check CHECK (status IN ('active', 'resolved'));
  END IF;
END $$;
