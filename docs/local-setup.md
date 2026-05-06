# Local setup

This repo now supports a self-contained local setup using Docker Compose and `.env`.

## First run

```bash
npm install
npm run db:up
npm run db:prepare
npm run db:push
npm run dev
```

The app runs at `http://127.0.0.1:8080`.

If you upload large base64 images, the request parser limit is controlled by `REQUEST_BODY_LIMIT` in `.env`. The default is `50mb`.
AI image payloads are additionally capped by the shared API schema before Vision calls are made.

## Production essentials

- Set `SESSION_SECRET` to at least 32 random characters. Production startup fails without it.
- Set `SESSION_SECURE=true` when serving over HTTPS.
- Replace `ADMIN_USERNAMES=change-me-admin-username` before creating admin accounts.
- Set `CORS_ORIGIN` to the deployed web origin if the API is served from a different host.
- Keep `AI_RERANK_ENABLED`, `AUTOMATIC_MATCH_QUEUE_ENABLED`, and `OPENAI_IMAGE_METADATA_NORMALIZE_ENABLED` disabled unless you intentionally accept the extra LLM cost.
- Tune `AI_SEARCH_GUEST_RATE_LIMIT`, `AI_SEARCH_USER_RATE_LIMIT`, and `AI_IMAGE_ANALYSIS_RATE_LIMIT` before opening the service publicly.
- Tune `AUTH_LOGIN_RATE_LIMIT` and `AUTH_REGISTER_RATE_LIMIT` if your deployment sits behind a shared proxy or classroom network.
- Tune `CHAT_MESSAGE_RATE_LIMIT` if real users need faster back-and-forth messaging.
- Set `KAKAO_REST_API_KEY` so reverse geocoding goes through the server cache before falling back to the browser Kakao SDK.
- Tune `REVERSE_GEOCODE_GUEST_RATE_LIMIT` and `REVERSE_GEOCODE_USER_RATE_LIMIT` if map/detail views create too much Kakao Local API traffic.

## Database

- Postgres runs from `docker-compose.yml`.
- Vector search uses `pgvector`, and `npm run db:prepare` ensures the extension exists for existing local databases.
- Local data is stored in `./.postgres-data`.
- The default connection string is already defined in `.env` and points to local port `5433`.

## AI providers

- Text-only matching uses GPT via `AI_INTEGRATIONS_OPENAI_API_KEY`.
- Text and image search now use vector retrieval. Query embeddings use OpenAI-compatible embeddings, and image queries are first summarized by Qwen.
- Image analysis and image-inclusive preprocessing use Qwen via `QWEN_API_KEY` and `QWEN_BASE_URL`.
- Hybrid search tuning uses `VECTOR_CANDIDATE_COUNT` (default `40`) and `FINAL_RESULT_COUNT` (default `12`).
- Update the placeholder keys in `.env` before using AI endpoints.

## Helpful commands

```bash
npm run db:up
npm run db:prepare
npm run db:push
npm run db:logs
npm run db:down
```
