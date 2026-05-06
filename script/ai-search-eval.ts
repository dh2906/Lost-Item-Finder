import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

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
  reasoning: string;
  evidenceLabels?: string[];
  distanceKm?: number | null;
};

type CaseResult = {
  name: string;
  count: number;
  latencyMs: number;
  rank: number | null;
  top1: boolean;
  top3: boolean;
  top5: boolean;
  bestTitle: string | null;
  bestScore: number | null;
  labels: string[];
  matchedExpectation: boolean;
};

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

function matchesExpected(result: SearchResult, expected: ExpectedResult): boolean {
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
    labelsInclude(result.evidenceLabels, expected.evidenceLabels)
  );
}

async function runCase(baseUrl: string, cookie: string | undefined, testCase: EvalCase): Promise<CaseResult> {
  const startedAt = performance.now();
  const response = await fetch(new URL("/api/ai/search", baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(testCase.input),
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(`${testCase.name}: ${response.status} ${JSON.stringify(body)}`);
  }

  const results = body as SearchResult[];
  const rankIndex = results.findIndex((result) =>
    matchesExpected(result, testCase.expected)
  );
  const rank = rankIndex >= 0 ? rankIndex + 1 : null;
  const first = results[0];

  return {
    name: testCase.name,
    count: results.length,
    latencyMs: Math.round(performance.now() - startedAt),
    rank,
    top1: rank === 1,
    top3: rank !== null && rank <= 3,
    top5: rank !== null && rank <= 5,
    bestTitle: first?.item.title ?? null,
    bestScore: first?.score ?? null,
    labels: first?.evidenceLabels ?? [],
    matchedExpectation: rank !== null,
  };
}

function printUsage(): void {
  console.log(`Usage:
  npm run eval:ai-search -- --cases=script/ai-search-eval.example.json --base-url=http://localhost:8080

Optional:
  FINDY_SESSION_COOKIE="connect.sid=..." npm run eval:ai-search -- --cases=cases.json
  npm run eval:ai-search -- --cases=cases.json --min-top3=0.8 --min-mrr=0.6
  npm run eval:ai-search -- --cases=cases.json --output=tmp/ai-search-eval.json`);
}

async function main(): Promise<void> {
  const casesPath = getArgValue("cases");
  if (!casesPath || process.argv.includes("--help")) {
    printUsage();
    return;
  }

  const baseUrl = getArgValue("base-url") ?? process.env.FINDY_BASE_URL ?? "http://localhost:8080";
  const minTop3 = Number(getArgValue("min-top3") ?? process.env.FINDY_EVAL_MIN_TOP3 ?? "0");
  const minTop1 = Number(getArgValue("min-top1") ?? process.env.FINDY_EVAL_MIN_TOP1 ?? "0");
  const minTop5 = Number(getArgValue("min-top5") ?? process.env.FINDY_EVAL_MIN_TOP5 ?? "0");
  const minMrr = Number(getArgValue("min-mrr") ?? process.env.FINDY_EVAL_MIN_MRR ?? "0");
  const maxAvgLatencyMs = Number(
    getArgValue("max-avg-latency-ms") ??
      process.env.FINDY_EVAL_MAX_AVG_LATENCY_MS ??
      "0"
  );
  const outputPath = getArgValue("output");
  const cookie = process.env.FINDY_SESSION_COOKIE;
  const cases = JSON.parse(readFileSync(casesPath, "utf8")) as EvalCase[];

  if (!Array.isArray(cases) || cases.length === 0) {
    throw new Error("평가 케이스가 비어 있습니다.");
  }

  const results: CaseResult[] = [];
  for (const testCase of cases) {
    results.push(await runCase(baseUrl, cookie, testCase));
  }

  const top1 = results.filter((result) => result.top1).length / results.length;
  const top3 = results.filter((result) => result.top3).length / results.length;
  const top5 = results.filter((result) => result.top5).length / results.length;
  const mrr =
    results.reduce((sum, result) => sum + (result.rank ? 1 / result.rank : 0), 0) /
    results.length;
  const avgLatencyMs =
    results.reduce((sum, result) => sum + result.latencyMs, 0) / results.length;

  console.table(
    results.map((result) => ({
      name: result.name,
      rank: result.rank ?? "-",
      count: result.count,
      topScore: result.bestScore?.toFixed(3) ?? "-",
      topTitle: result.bestTitle ?? "-",
      labels: result.labels.join(", "),
      latencyMs: result.latencyMs,
    }))
  );

  const summary = {
    cases: results.length,
    top1: Number(top1.toFixed(4)),
    top3: Number(top3.toFixed(4)),
    top5: Number(top5.toFixed(4)),
    mrr: Number(mrr.toFixed(4)),
    avgLatencyMs: Math.round(avgLatencyMs),
    failedCases: results
      .filter((result) => !result.matchedExpectation)
      .map((result) => result.name),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (outputPath) {
    writeFileSync(
      outputPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          baseUrl,
          summary,
          results,
        },
        null,
        2
      )
    );
  }

  if (
    top1 < minTop1 ||
    top3 < minTop3 ||
    top5 < minTop5 ||
    mrr < minMrr ||
    (maxAvgLatencyMs > 0 && avgLatencyMs > maxAvgLatencyMs)
  ) {
    throw new Error(
      `AI 검색 평가 기준 미달: top1=${top1.toFixed(4)} min=${minTop1}, top3=${top3.toFixed(4)} min=${minTop3}, top5=${top5.toFixed(4)} min=${minTop5}, mrr=${mrr.toFixed(4)} min=${minMrr}, avgLatencyMs=${Math.round(avgLatencyMs)} max=${maxAvgLatencyMs || "-"}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
