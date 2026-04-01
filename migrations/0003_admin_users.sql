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
