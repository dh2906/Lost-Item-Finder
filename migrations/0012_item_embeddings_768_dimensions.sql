DELETE FROM item_embeddings;

ALTER TABLE item_embeddings
ALTER COLUMN embedding TYPE vector(768);
