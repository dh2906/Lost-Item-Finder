# AI Search Evaluation

AI search quality is measured with a fixed local evaluation set instead of relying
on a single demo query. The dataset lives at `script/ai-search-eval.local.json`
and is tied to the seeded/local Lost112-style records in the development
database.

## What We Measure

- `top1`: an expected item appears as the first result.
- `top3`: an expected item appears in the first three results.
- `top5`: an expected item appears in the first five results.
- `mrr`: mean reciprocal rank, which rewards placing the correct result higher.
- `avgLatencyMs`: average end-to-end search API latency.

Each case can validate more than the title. Expectations may include report
type, category, color, location text, address, place name, date, tags, and
evidence labels. This makes the score useful for checking whether the search
pipeline understood the user's constraints, not only whether it returned a
semantically similar item.

## Case Coverage

The local set covers:

- natural language item queries such as `충남대에서 5월 2일에 잃어버린 민트색 텀블러`
- location aliases such as `충남대`, `충남대학교`, station names, libraries, and
  facility names
- separate date input through `lostDateText`
- coordinate/radius search
- color constraints, including Korean color synonyms and source colors
- category constraints such as tumbler, wireless earphones, wallet, and umbrella
- feature/tag constraints such as Stanley, handle, straw, and brand-like words
- badge expectations such as `색상 유사`, `지역 일치`, and `날짜 유사`

## Running Locally

Start the app against the local database and embedding server, then run:

```bash
npm run eval:ai-search -- \
  --cases=script/ai-search-eval.local.json \
  --base-url=http://localhost:8080 \
  --min-top3=0.65 \
  --min-mrr=0.6 \
  --output=tmp/ai-search-eval.json
```

For stricter regression checks, add:

```bash
--min-top1=0.6 --min-top5=0.7 --max-avg-latency-ms=20000
```

The JSON output is intended for reports and presentations. The failed case list
shows which query dimension regressed first, so future improvements can be
tracked with repeatable numbers instead of screenshots.

## Current Local Baseline

The first 24-case local baseline measured on May 6, 2026 was:

- `top1`: 0.6667
- `top3`: 0.6667
- `top5`: 0.7083
- `mrr`: 0.6750
- `avgLatencyMs`: 15795

The failed cases are mostly location alias extraction and strict place-name
disambiguation cases. That is useful signal: the next search-quality work should
target natural-place extraction, place geocoding, and latency reduction rather
than only prompt tuning.
