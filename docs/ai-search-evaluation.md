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

To compare the current search pipeline against weaker baselines, run:

```bash
npm run eval:ai-search:compare -- \
  --cases=script/ai-search-eval.local.json \
  --base-url=http://localhost:8080 \
  --output=tmp/ai-search-compare.json
```

The comparison modes are:

- `keyword`: direct database keyword search over item text fields.
- `vector`: vector similarity only, without location/date/color/category
  filtering and rescoring.
- `api-content`: the current hybrid pipeline evaluated only by returned item
  content.
- `api`: the current hybrid pipeline evaluated by returned item content and
  evidence labels.

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

The first baseline comparison on the same 24 cases was:

| Mode | What It Checks | Top-1 | Top-3 | Top-5 | MRR | Avg latency |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Keyword only | Literal DB text search | 0.7500 | 0.7500 | 0.7500 | 0.7569 | 1134ms |
| Vector only | Embedding similarity only | 0.6250 | 0.6250 | 0.7083 | 0.6549 | 715ms |
| Hybrid API, content only | Product pipeline, returned item only | 0.7083 | 0.7083 | 0.7917 | 0.7271 | 15874ms |
| Hybrid API, content + evidence | Product pipeline, item and labels | 0.6667 | 0.6667 | 0.7083 | 0.6750 | 16724ms |

This comparison should not be presented as "hybrid always beats keyword." On
the current local dataset, many cases contain literal item/color/location words,
so keyword search is a strong baseline and is faster. The stronger claim is more
specific:

- On the natural-place/date subset represented by the first four cases,
  `keyword` and `vector` fail the three `충남대/충남대학교` alias-date cases,
  while `api-content` resolves all four at rank 1.
- `vector` is weaker than the product pipeline on overall Top-1 and MRR because
  it lacks structured color, date, and location constraints.
- The product pipeline is the only mode that can evaluate whether the result is
  explainable through evidence labels such as `색상 유사`, `지역 일치`, and
  `날짜 유사`.
- Latency is the main regression target: the product pipeline is much slower
  than direct keyword/vector baselines.
