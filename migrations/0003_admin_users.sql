ALTER TABLE users
ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

UPDATE users
SET role = 'member'
WHERE role IS NULL;

UPDATE users
SET status = 'active'
WHERE status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_role_check CHECK (role IN ('member', 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_status_check'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'suspended'));
  END IF;
END $$;
