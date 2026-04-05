ALTER TABLE items
ADD COLUMN IF NOT EXISTS image_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE items
SET image_urls = CASE
  WHEN image_url IS NOT NULL AND btrim(image_url) <> '' THEN jsonb_build_array(image_url)
  ELSE '[]'::jsonb
END
WHERE image_urls = '[]'::jsonb;

UPDATE items
SET image_url = image_urls ->> 0
WHERE (image_url IS NULL OR btrim(image_url) = '')
  AND jsonb_typeof(image_urls) = 'array'
  AND jsonb_array_length(image_urls) > 0;
