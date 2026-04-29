# AI provider configuration

This project reads AI credentials from runtime environment variables.

- GPT routes use `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL`.
- The main text-only fallback model in `server/routes.ts` defaults to `gpt-5.4-mini`, and you can override it with `OPENAI_TEXT_MODEL`.
- Vector search embeddings use `EMBEDDING_PROVIDER`, which supports `local` and `openai`.
- Local embeddings call `LOCAL_EMBEDDING_URL`, defaulting to `http://127.0.0.1:8090/embed`, and are formatted for E5 models with `passage:` for stored items and `query:` for searches.
- Embeddings are stored as 768-dimensional vectors by default for `intfloat/multilingual-e5-base`. Keep `EMBEDDING_DIMENSIONS` aligned with the `item_embeddings.embedding` vector dimension.
- Hybrid search first retrieves `VECTOR_CANDIDATE_COUNT` vector candidates, then returns up to `FINAL_RESULT_COUNT` reranked results.
- Image analysis routes use `QWEN_API_KEY`.
- Qwen defaults to `https://coding-intl.dashscope.aliyuncs.com/v1`, and you can override it with `QWEN_BASE_URL`.
- The Qwen image-analysis model defaults to `qwen3.5-plus`, and you can override it with `QWEN_VISION_MODEL`.

Examples:

```bash
export AI_INTEGRATIONS_OPENAI_API_KEY="your-gpt-key"
export AI_INTEGRATIONS_OPENAI_BASE_URL="your-openai-compatible-base-url"
export OPENAI_TEXT_MODEL="gpt-5.4-mini"
export EMBEDDING_PROVIDER="local"
export EMBEDDING_DIMENSIONS="768"
export LOCAL_EMBEDDING_URL="http://127.0.0.1:8090/embed"
export LOCAL_EMBEDDING_MODEL="intfloat/multilingual-e5-base"
export OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
export VECTOR_CANDIDATE_COUNT="40"
export FINAL_RESULT_COUNT="12"

export LOST112_API_KEY="your-public-data-service-key"
export LOST112_SYNC_ENABLED="true"
export LOST112_SYNC_INTERVAL_MS="1800000"
export LOST112_SYNC_INITIAL_DELAY_MS="60000"
export LOST112_SYNC_START_PAGE="1"
export LOST112_SYNC_NUM_ROWS="50"
export LOST112_SYNC_MAX_PAGES="1"

export KAKAO_REST_API_KEY="your-kakao-rest-api-key"

export QWEN_API_KEY="your-qwen-key"
export QWEN_BASE_URL="https://coding-intl.dashscope.aliyuncs.com/v1"
export QWEN_VISION_MODEL="qwen3.5-plus"
```

For a one-time Lost112 backfill, call `POST /api/lost112/sync` as an admin with `{"numOfRows":100,"maxPages":1000}`. Scheduled sync should usually keep a smaller `LOST112_SYNC_MAX_PAGES` value to avoid repeated AI/API cost.

Set `KAKAO_REST_API_KEY` to enrich Lost112 facility names with Kakao Local API addresses and coordinates. Without this key, Lost112 sync still stores the source location text but cannot fill latitude/longitude.

If you run this project in Replit, put these values in the Replit Secrets panel.
If you run it locally, export them in your shell before `npm run dev`.
