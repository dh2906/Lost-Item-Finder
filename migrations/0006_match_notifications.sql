CREATE TABLE IF NOT EXISTS match_notifications (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lost_item_id integer NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  found_item_id integer NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  score real NOT NULL,
  reasoning text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS match_notifications_user_lost_found_unique
  ON match_notifications (user_id, lost_item_id, found_item_id);
