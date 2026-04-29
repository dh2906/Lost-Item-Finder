import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export async function ensureVectorExtension(): Promise<void> {
  await pool.query("CREATE EXTENSION IF NOT EXISTS vector;");
}

export async function ensureChatSchema(): Promise<void> {
  await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS user_id integer REFERENCES users(id) ON DELETE SET NULL;`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_rooms (
      id serial PRIMARY KEY,
      item_id integer NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      sender_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamp DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id serial PRIMARY KEY,
      room_id integer NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
      sender_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content text NOT NULL,
      is_read integer DEFAULT 0,
      created_at timestamp DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id serial PRIMARY KEY,
      title text NOT NULL,
      created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id serial PRIMARY KEY,
      conversation_id integer NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role text NOT NULL,
      content text NOT NULL,
      created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `);
}

export async function ensureItemImageSchema(): Promise<void> {
  await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS image_url text;`);
  await pool.query(
    `ALTER TABLE items ADD COLUMN IF NOT EXISTS image_urls jsonb NOT NULL DEFAULT '[]'::jsonb;`
  );
  await pool.query(`
    UPDATE items
    SET image_urls = CASE
      WHEN image_url IS NULL OR btrim(image_url) = '' THEN '[]'::jsonb
      ELSE jsonb_build_array(image_url)
    END
    WHERE image_urls IS NULL OR jsonb_typeof(image_urls) <> 'array';
  `);
}

export async function ensureItemMatchSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS item_matches (
      id serial PRIMARY KEY,
      lost_item_id integer NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      found_item_id integer NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      score integer NOT NULL,
      match_reason text NOT NULL,
      status text NOT NULL DEFAULT 'new',
      notified_at timestamp,
      created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
      CONSTRAINT item_matches_lost_found_unique UNIQUE (lost_item_id, found_item_id)
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS item_matches_lost_item_idx ON item_matches (lost_item_id);`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS item_matches_found_item_idx ON item_matches (found_item_id);`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS item_matches_status_idx ON item_matches (status);`
  );
}

export async function ensureExternalItemSchema(): Promise<void> {
  await pool.query(`
    ALTER TABLE items
    ADD COLUMN IF NOT EXISTS external_source text,
    ADD COLUMN IF NOT EXISTS external_id text,
    ADD COLUMN IF NOT EXISTS external_url text,
    ADD COLUMN IF NOT EXISTS external_payload jsonb,
    ADD COLUMN IF NOT EXISTS external_payload_hash text;
  `);
  await pool.query(`
    ALTER TABLE items
    ADD COLUMN IF NOT EXISTS region1 text,
    ADD COLUMN IF NOT EXISTS region2 text,
    ADD COLUMN IF NOT EXISTS region3 text,
    ADD COLUMN IF NOT EXISTS address text,
    ADD COLUMN IF NOT EXISTS place_name text;
  `);
  await pool.query(`
    UPDATE items
    SET
      address = COALESCE(address, NULLIF(external_payload #>> '{geocoding,address}', '')),
      place_name = COALESCE(place_name, NULLIF(external_payload #>> '{geocoding,placeName}', ''))
    WHERE external_payload ? 'geocoding';
  `);
  await pool.query(`
    UPDATE items
    SET
      address = COALESCE(address, NULLIF(split_part(location, ' - ', 1), '')),
      place_name = COALESCE(
        place_name,
        NULLIF(
          CASE
            WHEN position(' - ' in location) > 0 THEN split_part(location, ' - ', 2)
            ELSE NULL
          END,
          ''
        )
      )
    WHERE location IS NOT NULL;
  `);
  await pool.query(`
    UPDATE items
    SET
      region1 = COALESCE(
        region1,
        CASE split_part(COALESCE(address, location), ' ', 1)
          WHEN '서울' THEN '서울특별시'
          WHEN '서울특별시' THEN '서울특별시'
          WHEN '부산' THEN '부산광역시'
          WHEN '부산광역시' THEN '부산광역시'
          WHEN '대구' THEN '대구광역시'
          WHEN '대구광역시' THEN '대구광역시'
          WHEN '인천' THEN '인천광역시'
          WHEN '인천광역시' THEN '인천광역시'
          WHEN '광주' THEN '광주광역시'
          WHEN '광주광역시' THEN '광주광역시'
          WHEN '대전' THEN '대전광역시'
          WHEN '대전광역시' THEN '대전광역시'
          WHEN '울산' THEN '울산광역시'
          WHEN '울산광역시' THEN '울산광역시'
          WHEN '세종' THEN '세종특별자치시'
          WHEN '세종특별자치시' THEN '세종특별자치시'
          WHEN '경기' THEN '경기도'
          WHEN '경기도' THEN '경기도'
          WHEN '강원' THEN '강원특별자치도'
          WHEN '강원도' THEN '강원특별자치도'
          WHEN '강원특별자치도' THEN '강원특별자치도'
          WHEN '충북' THEN '충청북도'
          WHEN '충청북도' THEN '충청북도'
          WHEN '충남' THEN '충청남도'
          WHEN '충청남도' THEN '충청남도'
          WHEN '전북' THEN '전북특별자치도'
          WHEN '전라북도' THEN '전북특별자치도'
          WHEN '전북특별자치도' THEN '전북특별자치도'
          WHEN '전남' THEN '전라남도'
          WHEN '전라남도' THEN '전라남도'
          WHEN '경북' THEN '경상북도'
          WHEN '경상북도' THEN '경상북도'
          WHEN '경남' THEN '경상남도'
          WHEN '경상남도' THEN '경상남도'
          WHEN '제주' THEN '제주특별자치도'
          WHEN '제주도' THEN '제주특별자치도'
          WHEN '제주특별자치도' THEN '제주특별자치도'
          ELSE NULLIF(split_part(COALESCE(address, location), ' ', 1), '')
        END
      ),
      region2 = COALESCE(region2, NULLIF(split_part(COALESCE(address, location), ' ', 2), '')),
      region3 = COALESCE(region3, NULLIF(split_part(COALESCE(address, location), ' ', 3), ''))
    WHERE COALESCE(address, location) IS NOT NULL
      AND COALESCE(address, location) !~ '^(습득|보관|담당)\\s*(장소|기관):';
  `);
  await pool.query(`
    UPDATE items
    SET region1 = NULL, region2 = NULL, region3 = NULL
    WHERE region1 IN ('습득', '보관', '담당');
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS items_external_source_id_unique
    ON items (external_source, external_id);
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS items_region1_idx ON items (region1);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS items_region2_idx ON items (region2);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS items_external_source_idx ON items (external_source);`);
}

export async function ensureLost112SyncRunSchema(): Promise<void> {
  await pool.query(`
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
  `);
}
