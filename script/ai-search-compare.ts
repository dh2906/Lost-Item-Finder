import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import pg from "pg";

const { Pool } = pg;

type SearchInput = {
  prompt?: string;
  imageUrl?: string;
  lostDateText?: string;
  location?: string;
  latitude?: string;
  longitude?: string;
  radiusKm?: number;
};

type ExpectedResult = {
  itemId?: number;
  reportType?: string;
  titleIncludes?: string[];
  itemCategoryIncludes?: string[];
  colorIncludes?: string[];
  locationIncludes?: string[];
  addressIncludes?: string[];
  placeNameIncludes?: string[];
  dateIncludes?: string[];
  tagsInclude?: string[];
  evidenceLabels?: string[];
};

type EvalCase = {
  name: string;
  input: SearchInput;
  expected: ExpectedResult;
};

type SearchResult = {
  item: {
    id: number;
    reportType?: string | null;
    title?: string | null;
    itemCategory?: string | null;
    color?: string | null;
    location?: string | null;
    address?: string | null;
    placeName?: string | null;
    date?: string | Date | null;
    tags?: string[] | null;
  };
  score: number;
  evidenceLabels?: string[];
};

type CaseResult = {
  name: string;
  rank: number | null;
  count: number;
  latencyMs: number;
  topTitle: string | null;
};

type ModeResult = {
  mode: string;
  cases: number;
  top1: number;
  top3: number;
  top5: number;
  mrr: number;
  avgLatencyMs: number;
  failedCases: string[];
};

const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5433/lost_found_finder";
const DEFAULT_BASE_URL = "http://127.0.0.1:8080";
const DEFAULT_EMBEDDING_URL = "http://127.0.0.1:8090/embed";
const FINAL_RESULT_COUNT = 12;

function getArgValue(name: string): string | undefined {
  const prefixed = `--${name}=`;
  const entry = process.argv.find((arg) => arg.startsWith(prefixed));
  return entry ? entry.slice(prefixed.length) : undefined;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/\s+/g, "");
}

function includesAll(haystack: string | null | undefined, needles?: string[]): boolean {
  if (!needles || needles.length === 0) {
    return true;
  }

  const normalizedHaystack = normalizeText(haystack);
  return needles.every((needle) => normalizedHaystack.includes(normalizeText(needle)));
}

function tagsInclude(tags: string[] | null | undefined, expected?: string[]): boolean {
  if (!expected || expected.length === 0) {
    return true;
  }

  const normalizedTags = (tags ?? []).map(normalizeText);
  return expected.every((needle) =>
    normalizedTags.some((tag) => tag.includes(normalizeText(needle)))
  );
}

function labelsInclude(labels: string[] | undefined, expected?: string[]): boolean {
  if (!expected || expected.length === 0) {
    return true;
  }

  const normalizedLabels = new Set((labels ?? []).map(normalizeText));
  return expected.every((label) => normalizedLabels.has(normalizeText(label)));
}

function dateIncludes(value: string | Date | null | undefined, expected?: string[]): boolean {
  if (!expected || expected.length === 0) {
    return true;
  }

  const normalizedDate =
    value instanceof Date ? value.toISOString() : typeof value === "string" ? value : "";
  return expected.every((needle) => normalizedDate.includes(needle));
}

function matchesExpected(
  result: SearchResult,
  expected: ExpectedResult,
  options: { includeEvidenceLabels: boolean }
): boolean {
  if (expected.itemId !== undefined && result.item.id !== expected.itemId) {
    return false;
  }

  if (expected.reportType !== undefined && result.item.reportType !== expected.reportType) {
    return false;
  }

  return (
    includesAll(result.item.title, expected.titleIncludes) &&
    includesAll(result.item.itemCategory, expected.itemCategoryIncludes) &&
    includesAll(result.item.color, expected.colorIncludes) &&
    includesAll(result.item.location, expected.locationIncludes) &&
    includesAll(result.item.address, expected.addressIncludes) &&
    includesAll(result.item.placeName, expected.placeNameIncludes) &&
    dateIncludes(result.item.date, expected.dateIncludes) &&
    tagsInclude(result.item.tags, expected.tagsInclude) &&
    (!options.includeEvidenceLabels ||
      labelsInclude(result.evidenceLabels, expected.evidenceLabels))
  );
}

function buildQueryText(input: SearchInput): string {
  return [input.prompt, input.location, input.lostDateText]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
    .trim();
}

function extractKeywordTokens(input: SearchInput): string[] {
  return Array.from(
    new Set(
      buildQueryText(input)
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
        .filter((token) => !/^\d{1,4}$/.test(token))
        .filter((token) => !/^(에서|근처|잃어버린|잃어버렸어|분실|주운|것|있는|있고)$/.test(token))
    )
  ).slice(0, 10);
}

function toResult(row: Record<string, unknown>): SearchResult {
  return {
    item: {
      id: Number(row.id),
      reportType: row.report_type as string | null,
      title: row.title as string | null,
      itemCategory: row.item_category as string | null,
      color: row.color as string | null,
      location: row.location as string | null,
      address: row.address as string | null,
      placeName: row.place_name as string | null,
      date: row.date as string | Date | null,
      tags: Array.isArray(row.tags) ? (row.tags as string[]) : null,
    },
    score: Number(row.score ?? 0),
  };
}

async function runApiCase(baseUrl: string, testCase: EvalCase): Promise<SearchResult[]> {
  const response = await fetch(new URL("/api/ai/search", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(testCase.input),
  });

  if (!response.ok) {
    throw new Error(`${testCase.name}: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as SearchResult[];
}

async function runKeywordCase(pool: pg.Pool, testCase: EvalCase): Promise<SearchResult[]> {
  const tokens = extractKeywordTokens(testCase.input);
  if (tokens.length === 0) {
    return [];
  }

  const scoreExpressions = tokens.flatMap((_, index) => {
    const param = `$${index + 1}`;
    return [
      `(CASE WHEN title ILIKE ${param} THEN 4 ELSE 0 END)`,
      `(CASE WHEN item_category ILIKE ${param} THEN 3 ELSE 0 END)`,
      `(CASE WHEN color ILIKE ${param} THEN 3 ELSE 0 END)`,
      `(CASE WHEN location ILIKE ${param} THEN 2 ELSE 0 END)`,
      `(CASE WHEN address ILIKE ${param} THEN 2 ELSE 0 END)`,
      `(CASE WHEN place_name ILIKE ${param} THEN 2 ELSE 0 END)`,
      `(CASE WHEN description ILIKE ${param} THEN 1 ELSE 0 END)`,
    ];
  });
  const whereExpressions = tokens.map((_, index) => {
    const param = `$${index + 1}`;
    return `(title ILIKE ${param} OR description ILIKE ${param} OR item_category ILIKE ${param} OR color ILIKE ${param} OR location ILIKE ${param} OR address ILIKE ${param} OR place_name ILIKE ${param})`;
  });

  const query = `
    SELECT id, report_type, title, item_category, color, location, address, place_name, date, tags,
      (${scoreExpressions.join(" + ")})::float / ${Math.max(tokens.length, 1)} AS score
    FROM items
    WHERE report_type = 'found'
      AND status = 'active'
      AND (${whereExpressions.join(" OR ")})
    ORDER BY score DESC, date DESC, id DESC
    LIMIT ${FINAL_RESULT_COUNT}
  `;
  const result = await pool.query(query, tokens.map((token) => `%${token}%`));
  return result.rows.map(toResult);
}

async function createEmbedding(embeddingUrl: string, input: SearchInput): Promise<number[]> {
  const queryText = buildQueryText(input);
  if (!queryText) {
    return [];
  }

  const response = await fetch(embeddingUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: `query: ${queryText}` }),
  });
  if (!response.ok) {
    throw new Error(`embedding failed: ${response.status} ${await response.text()}`);
  }
  const payload = (await response.json()) as { data?: unknown };
  const embedding = Array.isArray(payload.data)
    ? Array.isArray(payload.data[0])
      ? payload.data[0]
      : payload.data
    : [];
  return embedding.filter((value): value is number => typeof value === "number");
}

async function runVectorCase(
  pool: pg.Pool,
  embeddingUrl: string,
  testCase: EvalCase
): Promise<SearchResult[]> {
  const embedding = await createEmbedding(embeddingUrl, testCase.input);
  if (embedding.length === 0) {
    return [];
  }

  const vectorLiteral = `[${embedding.join(",")}]`;
  const result = await pool.query(
    `
      SELECT i.id, i.report_type, i.title, i.item_category, i.color, i.location,
        i.address, i.place_name, i.date, i.tags,
        GREATEST(0, 1 - (ie.embedding <=> $1::vector)) AS score
      FROM item_embeddings ie
      JOIN items i ON i.id = ie.item_id
      WHERE i.report_type = 'found'
        AND i.status = 'active'
      ORDER BY ie.embedding <=> $1::vector
      LIMIT ${FINAL_RESULT_COUNT}
    `,
    [vectorLiteral]
  );
  return result.rows.map(toResult);
}

async function runCase(
  mode: string,
  pool: pg.Pool,
  baseUrl: string,
  embeddingUrl: string,
  testCase: EvalCase
): Promise<CaseResult> {
  const startedAt = performance.now();
  const results =
    mode === "api" || mode === "api-content"
      ? await runApiCase(baseUrl, testCase)
      : mode === "keyword"
      ? await runKeywordCase(pool, testCase)
      : await runVectorCase(pool, embeddingUrl, testCase);
  const rankIndex = results.findIndex((result) =>
    matchesExpected(result, testCase.expected, {
      includeEvidenceLabels: mode === "api",
    })
  );
  const first = results[0];

  return {
    name: testCase.name,
    rank: rankIndex >= 0 ? rankIndex + 1 : null,
    count: results.length,
    latencyMs: Math.round(performance.now() - startedAt),
    topTitle: first?.item.title ?? null,
  };
}

function summarize(mode: string, results: CaseResult[]): ModeResult {
  const top1 = results.filter((result) => result.rank === 1).length / results.length;
  const top3 =
    results.filter((result) => result.rank !== null && result.rank <= 3).length /
    results.length;
  const top5 =
    results.filter((result) => result.rank !== null && result.rank <= 5).length /
    results.length;
  const mrr =
    results.reduce((sum, result) => sum + (result.rank ? 1 / result.rank : 0), 0) /
    results.length;
  const avgLatencyMs =
    results.reduce((sum, result) => sum + result.latencyMs, 0) / results.length;

  return {
    mode,
    cases: results.length,
    top1: Number(top1.toFixed(4)),
    top3: Number(top3.toFixed(4)),
    top5: Number(top5.toFixed(4)),
    mrr: Number(mrr.toFixed(4)),
    avgLatencyMs: Math.round(avgLatencyMs),
    failedCases: results
      .filter((result) => result.rank === null)
      .map((result) => result.name),
  };
}

async function main(): Promise<void> {
  const casesPath = getArgValue("cases") ?? "script/ai-search-eval.local.json";
  const outputPath = getArgValue("output");
  const modes = (getArgValue("modes") ?? "keyword,vector,api-content,api")
    .split(",")
    .map((mode) => mode.trim())
    .filter(Boolean);
  const baseUrl = getArgValue("base-url") ?? process.env.FINDY_BASE_URL ?? DEFAULT_BASE_URL;
  const embeddingUrl =
    getArgValue("embedding-url") ?? process.env.LOCAL_EMBEDDING_URL ?? DEFAULT_EMBEDDING_URL;
  const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  const cases = JSON.parse(readFileSync(casesPath, "utf8")) as EvalCase[];

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const allResults: Record<string, CaseResult[]> = {};
    const summaries: ModeResult[] = [];

    for (const mode of modes) {
      if (!["keyword", "vector", "api-content", "api"].includes(mode)) {
        throw new Error(`지원하지 않는 비교 모드입니다: ${mode}`);
      }
      const results: CaseResult[] = [];
      for (const testCase of cases) {
        results.push(await runCase(mode, pool, baseUrl, embeddingUrl, testCase));
      }
      allResults[mode] = results;
      summaries.push(summarize(mode, results));
    }

    console.table(
      summaries.map((summary) => ({
        mode: summary.mode,
        cases: summary.cases,
        top1: summary.top1,
        top3: summary.top3,
        top5: summary.top5,
        mrr: summary.mrr,
        avgLatencyMs: summary.avgLatencyMs,
        failed: summary.failedCases.length,
      }))
    );
    console.log(JSON.stringify({ summaries }, null, 2));

    if (outputPath) {
      writeFileSync(
        outputPath,
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            casesPath,
            summaries,
            results: allResults,
          },
          null,
          2
        )
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
