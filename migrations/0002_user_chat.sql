ALTER TABLE items
ADD COLUMN IF NOT EXISTS user_id integer REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS chat_rooms (
  id serial PRIMARY KEY,
  item_id integer NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  sender_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id serial PRIMARY KEY,
  room_id integer NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_read integer DEFAULT 0,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
  id serial PRIMARY KEY,
  title text NOT NULL,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id serial PRIMARY KEY,
  conversation_id integer NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
