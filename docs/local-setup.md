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

The app runs at `http://127.0.0.1:5001`.

If you upload large base64 images, the request parser limit is controlled by `REQUEST_BODY_LIMIT` in `.env`. The default is `50mb`.

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
