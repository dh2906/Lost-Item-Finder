CREATE INDEX CONCURRENTLY IF NOT EXISTS item_embeddings_embedding_hnsw_idx
ON item_embeddings
USING hnsw (embedding vector_cosine_ops);
