CREATE TABLE IF NOT EXISTS lost112_sync_runs (
  id serial PRIMARY KEY,
  trigger text NOT NULL,
  status text NOT NULL,
  page integer NOT NULL,
  num_of_rows integer NOT NULL,
  max_pages integer NOT NULL,
  fetched_count integer NOT NULL DEFAULT 0,
  created_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  embedded_count integer NOT NULL DEFAULT 0,
  embedding_failed_count integer NOT NULL DEFAULT 0,
  automatic_match_count integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at timestamp
);
