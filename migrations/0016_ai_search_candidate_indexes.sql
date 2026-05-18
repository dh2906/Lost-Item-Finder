CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS items_report_status_date_idx
ON items (report_type, status, date DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS items_title_trgm_idx
ON items USING gin (title gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS items_description_trgm_idx
ON items USING gin (description gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS items_item_category_trgm_idx
ON items USING gin (item_category gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS items_color_trgm_idx
ON items USING gin (color gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS items_location_trgm_idx
ON items USING gin (location gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS items_region1_trgm_idx
ON items USING gin (region1 gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS items_region2_trgm_idx
ON items USING gin (region2 gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS items_region3_trgm_idx
ON items USING gin (region3 gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS items_address_trgm_idx
ON items USING gin (address gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS items_place_name_trgm_idx
ON items USING gin (place_name gin_trgm_ops);
