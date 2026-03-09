# AI provider configuration

This project reads AI credentials from runtime environment variables.

- GPT routes use `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL`.
- The main text-only fallback model in `server/routes.ts` defaults to `gpt-4o-mini`, and you can override it with `OPENAI_TEXT_MODEL`.
- Vector search embeddings use `OPENAI_EMBEDDING_MODEL`, which defaults to `text-embedding-3-small`.
- Hybrid search first retrieves `VECTOR_CANDIDATE_COUNT` vector candidates, then returns up to `FINAL_RESULT_COUNT` reranked results.
- Image analysis routes use `QWEN_API_KEY`.
- Qwen defaults to `https://coding-intl.dashscope.aliyuncs.com/v1`, and you can override it with `QWEN_BASE_URL`.
- The Qwen image-analysis model defaults to `qwen3.5-plus`, and you can override it with `QWEN_VISION_MODEL`.

Examples:

```bash
export AI_INTEGRATIONS_OPENAI_API_KEY="your-gpt-key"
export AI_INTEGRATIONS_OPENAI_BASE_URL="your-openai-compatible-base-url"
export OPENAI_TEXT_MODEL="gpt-4o-mini"
export OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
export VECTOR_CANDIDATE_COUNT="40"
export FINAL_RESULT_COUNT="12"

export QWEN_API_KEY="your-qwen-key"
export QWEN_BASE_URL="https://coding-intl.dashscope.aliyuncs.com/v1"
export QWEN_VISION_MODEL="qwen3.5-plus"
```

If you run this project in Replit, put these values in the Replit Secrets panel.
If you run it locally, export them in your shell before `npm run dev`.
