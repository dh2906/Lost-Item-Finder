import type { Express } from "express";
import { createServer, type Server } from "http";
import { createHash } from "crypto";
import passport from "passport";
import { isAdmin, isAuthenticated } from "./auth";
import { maskSensitiveInfo } from "./lib/masking";
import { storage, type ExternalFoundItemInput } from "./storage";
import { api } from "@shared/routes";
import { normalizeItemImageUrls } from "@shared/item-images";
import { z } from "zod";
import OpenAI from "openai";
import { db } from "./db";
import { and, eq, ne, or, desc, asc, isNull } from "drizzle-orm";
import {
  chatRooms,
  chatMessages,
  items,
  itemEmbeddings,
  itemMatches,
  lost112SyncRuns,
  matchNotifications,
  updateItemMatchStatusSchema,
  users,
  type Item,
  type ItemMatchStatus,
} from "@shared/schema";
import { sendFcmNotification } from "./fcm";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const qwen = process.env.QWEN_API_KEY
  ? new OpenAI({
      apiKey: process.env.QWEN_API_KEY,
      baseURL:
        process.env.QWEN_BASE_URL ??
        "https://coding-intl.dashscope.aliyuncs.com/v1",
    })
  : null;

const GPT_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL ?? "gpt-5.4-mini";
const QWEN_VISION_MODEL = process.env.QWEN_VISION_MODEL ?? "qwen3.5-plus";
const EMBEDDING_PROVIDER = (
  process.env.EMBEDDING_PROVIDER ?? "openai"
).toLowerCase();
const OPENAI_EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
const LOCAL_EMBEDDING_MODEL =
  process.env.LOCAL_EMBEDDING_MODEL ?? "intfloat/multilingual-e5-base";
const LOCAL_EMBEDDING_URL =
  process.env.LOCAL_EMBEDDING_URL ?? "http://127.0.0.1:8090/embed";
const EMBEDDING_DIMENSIONS = Number(
  process.env.EMBEDDING_DIMENSIONS ??
    process.env.OPENAI_EMBEDDING_DIMENSIONS ??
    768
);
const VECTOR_CANDIDATE_COUNT = Number(process.env.VECTOR_CANDIDATE_COUNT ?? 20);
const FINAL_RESULT_COUNT = Number(process.env.FINAL_RESULT_COUNT ?? 12);
const AUTO_MATCH_RESULT_COUNT = Number(
  process.env.AUTO_MATCH_RESULT_COUNT ?? 5
);
const AUTO_MATCH_BACKFILL_LIMIT = Number(
  process.env.AUTO_MATCH_BACKFILL_LIMIT ?? 3
);
const AUTO_MATCH_JOB_TIMEOUT_MS = Number(
  process.env.AUTO_MATCH_JOB_TIMEOUT_MS ?? 15000
);
const MIN_VECTOR_MATCH_SCORE = Number(
  process.env.MIN_VECTOR_MATCH_SCORE ?? 0.22
);
const MIN_FINAL_MATCH_SCORE = Number(process.env.MIN_FINAL_MATCH_SCORE ?? 0.42);
const MIN_FALLBACK_MATCH_SCORE = Number(
  process.env.MIN_FALLBACK_MATCH_SCORE ?? 0.3
);
const DEFAULT_AI_SEARCH_RADIUS_KM = 1;
const positiveIdSchema = z.coerce.number().int().positive();
const embeddingRelevantFields = new Set([
  "title",
  "description",
  "itemCategory",
  "color",
  "size",
  "tags",
  "location",
  "latitude",
  "longitude",
]);
const AUTO_MATCH_CANDIDATE_LIMIT = Number(
  process.env.AUTO_MATCH_CANDIDATE_LIMIT ?? 120
);
const AUTO_MATCH_MIN_SCORE = Number(process.env.AUTO_MATCH_MIN_SCORE ?? 0.42);
const AUTO_MATCH_MIN_VECTOR_SCORE = Number(
  process.env.AUTO_MATCH_MIN_VECTOR_SCORE ?? 0.3
);
const AUTO_MATCH_MIN_KEYWORD_SCORE = Number(
  process.env.AUTO_MATCH_MIN_KEYWORD_SCORE ?? 0.12
);
const AUTO_MATCH_MIN_CATEGORY_SCORE = Number(
  process.env.AUTO_MATCH_MIN_CATEGORY_SCORE ?? 0.2
);
const AUTO_MATCH_MAX_RESULTS = Number(process.env.AUTO_MATCH_MAX_RESULTS ?? 12);
const LOST112_SYNC_ENABLED = process.env.LOST112_SYNC_ENABLED !== "false";
const LOST112_SYNC_INTERVAL_MS = Number(
  process.env.LOST112_SYNC_INTERVAL_MS ?? 1000 * 60 * 30
);
const LOST112_SYNC_INITIAL_DELAY_MS = Number(
  process.env.LOST112_SYNC_INITIAL_DELAY_MS ?? 1000 * 60
);
const LOST112_SYNC_NUM_ROWS = Number(process.env.LOST112_SYNC_NUM_ROWS ?? 50);
const LOST112_SYNC_MAX_PAGES = Number(process.env.LOST112_SYNC_MAX_PAGES ?? 1);
const LOST112_SYNC_START_PAGE = Number(process.env.LOST112_SYNC_START_PAGE ?? 1);
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;

function getQwenClient(): OpenAI {
  if (!qwen) {
    throw new Error("QWEN_API_KEY is not configured");
  }
  return qwen;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }
  return "Internal server error";
}

type Lost112NormalizedItem = {
  atcId?: string;
  fdSn?: string;
  fdYmd?: string;
  prdtClNm?: string;
  fdFilePathImg?: string;
  fdSbjt?: string;
  fdPrdtNm?: string;
  depPlace?: string;
  fdHor?: string;
  clrNm?: string;
  fdPlace?: string;
  tel?: string;
  orgNm?: string;
};

type Lost112NormalizedResponse = {
  response?: {
    header?: {
      resultCode?: string;
      resultMsg?: string;
    };
    body?: {
      items?: {
        item?: Lost112NormalizedItem[] | Lost112NormalizedItem;
      };
      totalCount?: number;
      numOfRows?: number;
      pageNo?: number;
    };
  };
};

const LOST112_ITEM_FIELDS = [
  "atcId",
  "fdSn",
  "fdYmd",
  "prdtClNm",
  "fdFilePathImg",
  "fdSbjt",
  "fdPrdtNm",
  "depPlace",
  "fdHor",
  "clrNm",
  "fdPlace",
  "tel",
  "orgNm",
] as const;

function decodeXmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getXmlTagValue(xml: string, tagName: string): string | undefined {
  const escapedTagName = escapeRegExp(tagName);
  const fullTagPattern = new RegExp(
    `<${escapedTagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapedTagName}>`,
    "i"
  );
  const fullTagMatch = xml.match(fullTagPattern);
  if (fullTagMatch) {
    return decodeXmlEntities(fullTagMatch[1]);
  }

  const selfClosingPattern = new RegExp(
    `<${escapedTagName}(?:\\s[^>]*)?\\s*/>`,
    "i"
  );
  if (selfClosingPattern.test(xml)) {
    return "";
  }
  return undefined;
}

function getXmlTagBlocks(xml: string, tagName: string): string[] {
  const escapedTagName = escapeRegExp(tagName);
  const pattern = new RegExp(
    `<${escapedTagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapedTagName}>`,
    "gi"
  );
  return Array.from(xml.matchAll(pattern), (match) => match[1]);
}

function toOptionalNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseLost112XmlResponse(xml: string): Lost112NormalizedResponse {
  const responseXml = getXmlTagBlocks(xml, "response")[0] ?? xml;
  const headerXml = getXmlTagBlocks(responseXml, "header")[0] ?? "";
  const bodyXml = getXmlTagBlocks(responseXml, "body")[0];

  if (!bodyXml) {
    throw new Error(
      `Lost112 API 응답 본문이 비어 있습니다: ${xml.slice(0, 160)}`
    );
  }

  const resultCode = getXmlTagValue(headerXml, "resultCode");
  const resultMsg = getXmlTagValue(headerXml, "resultMsg");
  if (resultCode && resultCode !== "00") {
    throw new Error(
      `Lost112 API 오류: ${resultCode}${resultMsg ? ` ${resultMsg}` : ""}`
    );
  }

  const itemsXml = getXmlTagBlocks(bodyXml, "items")[0] ?? "";
  const items = getXmlTagBlocks(itemsXml, "item").map((itemXml) => {
    const normalizedItem: Lost112NormalizedItem = {};
    for (const field of LOST112_ITEM_FIELDS) {
      const value = getXmlTagValue(itemXml, field);
      if (value !== undefined) {
        normalizedItem[field] = value;
      }
    }
    return normalizedItem;
  });

  return {
    response: {
      header: {
        resultCode,
        resultMsg,
      },
      body: {
        items: {
          item: items,
        },
        totalCount: toOptionalNumber(getXmlTagValue(bodyXml, "totalCount")),
        numOfRows: toOptionalNumber(getXmlTagValue(bodyXml, "numOfRows")),
        pageNo: toOptionalNumber(getXmlTagValue(bodyXml, "pageNo")),
      },
    },
  };
}

function parseLost112ApiResponse(rawText: string): Lost112NormalizedResponse {
  try {
    return JSON.parse(rawText) as Lost112NormalizedResponse;
  } catch {
    const trimmed = rawText.trim();
    if (trimmed.startsWith("<")) {
      return parseLost112XmlResponse(trimmed);
    }
    throw new Error(
      `Lost112 API가 JSON/XML이 아닌 응답을 반환했습니다: ${rawText.slice(
        0,
        160
      )}`
    );
  }
}

type Lost112FetchOptions = {
  apiKey: string;
  category?: string;
  region?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  numOfRows?: number;
  timeoutMs?: number;
};

type Lost112FetchedPage = {
  items: Lost112NormalizedItem[];
  totalCount: number;
  pageNo: number;
  numOfRows: number;
  rawCount: number;
};

type Lost112SyncOptions = {
  apiKey: string;
  category?: string;
  region?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  numOfRows?: number;
  maxPages?: number;
  trigger?: string;
};

type Lost112SyncResult = {
  fetchedCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  embeddedCount: number;
  embeddingFailedCount: number;
  automaticMatchCount: number;
  items: Item[];
};

type Lost112ActiveSyncRun = {
  id: number;
  trigger: string;
  phase: "fetching" | "processing";
  page: number;
  numOfRows: number;
  maxPages: number;
  currentPage: number | null;
  fetchedCount: number;
  processedCount: number;
  totalToProcess: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  embeddedCount: number;
  embeddingFailedCount: number;
  automaticMatchCount: number;
  currentExternalId: string | null;
  currentTitle: string | null;
  recentItems: Array<{
    externalId: string;
    title: string | null;
    action: "created" | "updated" | "skipped" | "failed";
  }>;
  startedAt: Date;
  updatedAt: Date;
};

const LOST112_SOURCE = "lost112";
const LOST112_NORMALIZATION_VERSION = "geocoded-location-v3";
const activeLost112SyncRuns = new Map<number, Lost112ActiveSyncRun>();

const LOST112_REGION_CODES: Record<string, string> = {
  서울특별시: "LCA000",
  부산광역시: "LCB000",
  대구광역시: "LCC000",
  인천광역시: "LCD000",
  광주광역시: "LCE000",
  대전광역시: "LCF000",
  울산광역시: "LCG000",
  세종특별자치시: "LCR000",
  경기도: "LCI000",
  강원특별자치도: "LCJ000",
  충청북도: "LCK000",
  충청남도: "LCL000",
  전북특별자치도: "LCM000",
  전라남도: "LCN000",
  경상북도: "LCO000",
  경상남도: "LCP000",
  제주특별자치도: "LCQ000",
};

function normalizeLost112ItemList(rawItems: unknown): Lost112NormalizedItem[] {
  if (!rawItems) {
    return [];
  }
  return (
    Array.isArray(rawItems) ? rawItems : [rawItems]
  ) as Lost112NormalizedItem[];
}

function matchesLost112TextFilter(
  item: Lost112NormalizedItem,
  filter: string,
  fields: Array<keyof Lost112NormalizedItem>
): boolean {
  if (!filter) {
    return true;
  }
  return fields
    .map((field) => item[field])
    .filter((value): value is string => Boolean(value))
    .some((value) => value.includes(filter));
}

const ADMINISTRATIVE_LOCATION_SUFFIXES = [
  "특별자치도",
  "특별자치시",
  "특별시",
  "광역시",
  "자치도",
  "시",
  "군",
  "구",
  "읍",
  "면",
  "동",
  "리",
] as const;

function getAdministrativeLocationTokenVariants(token: string): string[] {
  const variants = new Set([token]);
  for (const suffix of ADMINISTRATIVE_LOCATION_SUFFIXES) {
    if (!token.endsWith(suffix)) {
      continue;
    }
    const withoutSuffix = token.slice(0, -suffix.length);
    if (withoutSuffix.length >= 2) {
      variants.add(withoutSuffix);
    }
  }
  return Array.from(variants);
}

function getLocationFilterTokenGroups(
  locationText?: string | null
): string[][] {
  return normalizePlainSearchText(locationText)
    .split(" ")
    .filter((token) => token.length >= 2)
    .map(getAdministrativeLocationTokenVariants);
}

function locationTextMatchesFilter(
  candidateText: string,
  locationText?: string | null
): boolean {
  const tokenGroups = getLocationFilterTokenGroups(locationText);
  if (tokenGroups.length === 0) {
    return true;
  }
  const normalizedCandidate = normalizePlainSearchText(candidateText);
  const compactCandidate = normalizedCandidate.replace(/\s+/g, "");
  if (!normalizedCandidate) {
    return false;
  }
  return tokenGroups.every((variants) =>
    variants.some((variant) => {
      const compactVariant = variant.replace(/\s+/g, "");
      return (
        normalizedCandidate.includes(variant) ||
        compactCandidate.includes(compactVariant)
      );
    })
  );
}

function matchesLost112RegionFilter(
  item: Lost112NormalizedItem,
  region: string
): boolean {
  if (!region) {
    return true;
  }
  const locationText = [item.depPlace, item.fdPlace, item.orgNm]
    .filter((value): value is string => Boolean(value))
    .join(" ");

  return locationTextMatchesFilter(locationText, region);
}

async function fetchLost112ItemsPage({
  apiKey,
  category = "",
  region = "",
  startDate = "",
  endDate = "",
  page = 1,
  numOfRows = 20,
  timeoutMs = 10000,
}: Lost112FetchOptions): Promise<Lost112FetchedPage> {
  const safePageNo = Math.max(1, page);
  const safeNumOfRows = Math.min(100, Math.max(1, numOfRows));
  const normalizedCategory = category.trim();
  const normalizedRegion = region.trim();

  const hasRegionCode =
    normalizedRegion && LOST112_REGION_CODES[normalizedRegion];
  const externalNumOfRows =
    normalizedCategory && !hasRegionCode
      ? Math.min(100, Math.max(safeNumOfRows * 3, safeNumOfRows))
      : safeNumOfRows;

  const params = new URLSearchParams({
    serviceKey: apiKey,
    pageNo: String(safePageNo),
    numOfRows: String(externalNumOfRows),
    _type: "json",
  });

  if (startDate) params.set("START_YMD", startDate);
  if (endDate) params.set("END_YMD", endDate);

  // API에 지역 코드 전달
  if (hasRegionCode) {
    params.set("N_FD_LCT_CD", LOST112_REGION_CODES[normalizedRegion]);
  }

  const url = `https://apis.data.go.kr/1320000/LosPtfundInfoInqireService/getPtLosfundInfoAccToClAreaPd?${params.toString()}`;
  const safeUrl = new URL(url);
  safeUrl.searchParams.set("serviceKey", "***");
  console.log("[Lost112] request:", safeUrl.toString());

  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Lost112 API HTTP error: ${response.status} ${rawText.slice(0, 160)}`
    );
  }

  const data = parseLost112ApiResponse(rawText);
  const body = data.response?.body;

  if (!body) {
    throw new Error(
      `Lost112 API response body is empty: ${rawText.slice(0, 160)}`
    );
  }

  const rawItems = normalizeLost112ItemList(body.items?.item);
  const filteredItems = rawItems.filter((item) => {
    const categoryMatched = matchesLost112TextFilter(item, normalizedCategory, [
      "prdtClNm",
      "fdSbjt",
      "fdPrdtNm",
    ]);

    // API에서 이미 지역을 필터링했다면, 예외 케이스 방지용으로 통과시킵니다.
    const regionMatched = hasRegionCode
      ? true
      : matchesLost112RegionFilter(item, normalizedRegion);

    return categoryMatched && regionMatched;
  });

  filteredItems.sort((a, b) => {
    const dateA = a.fdYmd ? parseInt(a.fdYmd.replace(/\D/g, ""), 10) : 0;
    const dateB = b.fdYmd ? parseInt(b.fdYmd.replace(/\D/g, ""), 10) : 0;

    if (dateA !== dateB) {
      return dateB - dateA; // 날짜 기준 내림차순
    }

    // 날짜가 같으면 atcId(보통 접수 연도/순번 포함) 기준으로 내림차순 정렬
    const idA = a.atcId || "";
    const idB = b.atcId || "";
    return idB.localeCompare(idA);
  });

  return {
    items: filteredItems.slice(0, safeNumOfRows),
    totalCount:
      normalizedCategory || (normalizedRegion && !hasRegionCode)
        ? filteredItems.length
        : body.totalCount ?? filteredItems.length,
    pageNo: body.pageNo ?? safePageNo,
    numOfRows: safeNumOfRows,
    rawCount: rawItems.length,
  };
}

function getLost112DetailUrl(item: Lost112NormalizedItem): string | null {
  if (!item.atcId) {
    return null;
  }
  const params = new URLSearchParams({ ATC_ID: item.atcId });
  if (item.fdSn) {
    params.set("FD_SN", item.fdSn);
  }
  return `https://www.lost112.go.kr/find/findDetail.do?${params.toString()}`;
}

function parseLost112Date(value?: string): Date | null {
  if (!value) {
    return null;
  }
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 8) {
    return null;
  }
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6)) - 1;
  const day = Number(digits.slice(6, 8));
  const parsed = new Date(year, month, day);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function createLost112PayloadHash(item: Lost112NormalizedItem): string {
  return createHash("sha256")
    .update(stableStringify({ version: LOST112_NORMALIZATION_VERSION, item }))
    .digest("hex");
}

function touchLost112ActiveSyncRun(progress: Lost112ActiveSyncRun): void {
  progress.updatedAt = new Date();
}

function addLost112RecentSyncItem(
  progress: Lost112ActiveSyncRun,
  item: {
    externalId: string;
    title: string | null;
    action: "created" | "updated" | "skipped" | "failed";
  }
): void {
  progress.recentItems.unshift(item);
  progress.recentItems = progress.recentItems.slice(0, 20);
  touchLost112ActiveSyncRun(progress);
}

function getActiveLost112SyncRuns(): Lost112ActiveSyncRun[] {
  return Array.from(activeLost112SyncRuns.values()).sort(
    (left, right) => right.startedAt.getTime() - left.startedAt.getTime()
  );
}

function hasLost112LocationEnrichment(item: Item): boolean {
  return Boolean(item.latitude && item.longitude);
}

function normalizeStoredLost112Payload(
  payload: unknown
): Lost112NormalizedItem | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const source = payload as Record<string, unknown>;
  const normalized = Object.fromEntries(
    LOST112_ITEM_FIELDS.map((field) => {
      const value = source[field];
      return [field, typeof value === "string" ? value : ""];
    })
  ) as Lost112NormalizedItem;

  return normalized.atcId?.trim() ? normalized : null;
}

type KakaoKeywordDocument = {
  place_name?: string;
  address_name?: string;
  road_address_name?: string;
  x?: string;
  y?: string;
};

type Lost112GeocodingResult = {
  provider: "kakao";
  query: string;
  placeName?: string;
  address?: string;
  addressName?: string;
  roadAddressName?: string;
  latitude: string;
  longitude: string;
  location: string;
};

type ParsedLocationParts = {
  region1?: string | null;
  region2?: string | null;
  region3?: string | null;
  address?: string | null;
  placeName?: string | null;
};

const REGION1_ALIASES = new Map<string, string>([
  ["서울", "서울특별시"],
  ["서울특별시", "서울특별시"],
  ["부산", "부산광역시"],
  ["부산광역시", "부산광역시"],
  ["대구", "대구광역시"],
  ["대구광역시", "대구광역시"],
  ["인천", "인천광역시"],
  ["인천광역시", "인천광역시"],
  ["광주", "광주광역시"],
  ["광주광역시", "광주광역시"],
  ["대전", "대전광역시"],
  ["대전광역시", "대전광역시"],
  ["울산", "울산광역시"],
  ["울산광역시", "울산광역시"],
  ["세종", "세종특별자치시"],
  ["세종특별자치시", "세종특별자치시"],
  ["경기", "경기도"],
  ["경기도", "경기도"],
  ["강원", "강원특별자치도"],
  ["강원도", "강원특별자치도"],
  ["강원특별자치도", "강원특별자치도"],
  ["충북", "충청북도"],
  ["충청북도", "충청북도"],
  ["충남", "충청남도"],
  ["충청남도", "충청남도"],
  ["전북", "전북특별자치도"],
  ["전라북도", "전북특별자치도"],
  ["전북특별자치도", "전북특별자치도"],
  ["전남", "전라남도"],
  ["전라남도", "전라남도"],
  ["경북", "경상북도"],
  ["경상북도", "경상북도"],
  ["경남", "경상남도"],
  ["경상남도", "경상남도"],
  ["제주", "제주특별자치도"],
  ["제주도", "제주특별자치도"],
  ["제주특별자치도", "제주특별자치도"],
]);

function parseLocationParts(
  location?: string | null,
  geocoding?: Lost112GeocodingResult | null
): ParsedLocationParts {
  const address = geocoding?.address?.trim() || location?.split(" - ")[0]?.trim() || null;
  const administrativeAddress =
    geocoding?.addressName?.trim() || address || location?.split(" - ")[0]?.trim() || null;
  const placeName =
    geocoding?.placeName?.trim() ||
    (location?.includes(" - ") ? location.split(" - ").slice(1).join(" - ").trim() : "") ||
    null;
  const tokens = (administrativeAddress ?? location ?? "").split(/\s+/).filter(Boolean);
  const canonicalRegion1 = tokens[0] ? REGION1_ALIASES.get(tokens[0]) ?? tokens[0] : null;

  return {
    region1: canonicalRegion1,
    region2: tokens[1] ?? null,
    region3: tokens[2] ?? null,
    address,
    placeName,
  };
}

function getLost112LocationSearchQueries(
  item: Lost112NormalizedItem,
  fallbackLocation?: string | null
): string[] {
  return Array.from(
    new Set(
      [
        [item.orgNm, item.depPlace].filter(Boolean).join(" "),
        [item.orgNm, item.fdPlace].filter(Boolean).join(" "),
        item.depPlace,
        item.orgNm,
        item.fdPlace,
        fallbackLocation,
      ]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );
}

function formatLost112GeocodedLocation(document: KakaoKeywordDocument): string {
  const address = document.road_address_name || document.address_name || "";
  const placeName = document.place_name || "";
  if (address && placeName && !address.includes(placeName)) {
    return `${address} - ${placeName}`;
  }
  return address || placeName;
}

async function geocodeLost112Location(
  item: Lost112NormalizedItem,
  fallbackLocation?: string | null
): Promise<Lost112GeocodingResult | null> {
  if (!KAKAO_REST_API_KEY) {
    return null;
  }

  for (const query of getLost112LocationSearchQueries(item, fallbackLocation)) {
    try {
      const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
      url.searchParams.set("query", query);
      url.searchParams.set("size", "1");

      const response = await fetch(url, {
        headers: {
          Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
        },
      });

      if (!response.ok) {
        console.error(
          `Failed to geocode Lost112 location with Kakao: ${response.status} ${response.statusText}`
        );
        continue;
      }

      const body = z
        .object({
          documents: z.array(
            z.object({
              place_name: z.string().optional(),
              address_name: z.string().optional(),
              road_address_name: z.string().optional(),
              x: z.string().optional(),
              y: z.string().optional(),
            })
          ),
        })
        .parse(await response.json());
      const document = body.documents.find(
        (entry) => entry.x && entry.y && formatLost112GeocodedLocation(entry)
      );

      if (!document?.x || !document.y) {
        continue;
      }

      return {
        provider: "kakao",
        query,
        placeName: document.place_name,
        address: document.road_address_name || document.address_name,
        addressName: document.address_name,
        roadAddressName: document.road_address_name,
        latitude: document.y,
        longitude: document.x,
        location: formatLost112GeocodedLocation(document),
      };
    } catch (error) {
      console.error("Failed to geocode Lost112 location with Kakao:", error);
    }
  }

  return null;
}

async function getLost112SyncState(externalId: string): Promise<{
  item: Item;
  hasEmbedding: boolean;
} | null> {
  const [row] = await db
    .select({
      item: items,
      embeddingItemId: itemEmbeddings.itemId,
    })
    .from(items)
    .leftJoin(itemEmbeddings, eq(items.id, itemEmbeddings.itemId))
    .where(
      and(
        eq(items.externalSource, LOST112_SOURCE),
        eq(items.externalId, externalId)
      )
    )
    .limit(1);

  return row
    ? {
        item: row.item,
        hasEmbedding: row.embeddingItemId !== null,
      }
    : null;
}

function normalizeLost112ToExternalFoundItem(
  item: Lost112NormalizedItem
): ExternalFoundItemInput | null {
  const atcId = item.atcId?.trim();
  if (!atcId) {
    return null;
  }
  const fdSn = item.fdSn?.trim() || "1";
  const title =
    item.fdSbjt?.trim() ||
    item.fdPrdtNm?.trim() ||
    item.prdtClNm?.trim() ||
    "Lost112 found item";
  const location = Array.from(
    new Set(
      [
        item.fdPlace ? `습득 장소: ${item.fdPlace}` : null,
        item.depPlace ? `보관 장소: ${item.depPlace}` : null,
        item.orgNm ? `담당 기관: ${item.orgNm}` : null,
      ]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  ).join(" / ") || null;
  const contactInfo = [item.orgNm, item.tel]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(" / ");
  const imageUrl = item.fdFilePathImg?.trim() || null;
  const tags = Array.from(
    new Set(
      [
        "경찰청",
        LOST112_SOURCE,
        "police",
        item.prdtClNm,
        item.fdPrdtNm,
        item.orgNm,
      ]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );
  const descriptionParts = [
    item.fdPrdtNm ? `물품명: ${item.fdPrdtNm}` : null,
    item.prdtClNm ? `분류: ${item.prdtClNm}` : null,
    item.clrNm ? `색상: ${item.clrNm}` : null,
    item.fdPlace ? `습득 장소: ${item.fdPlace}` : null,
    item.depPlace ? `보관 장소: ${item.depPlace}` : null,
    item.orgNm ? `담당 기관: ${item.orgNm}` : null,
    item.fdYmd ? `습득일: ${item.fdYmd}` : null,
    item.fdHor ? `습득 시간: ${item.fdHor}` : null,
    `Lost112 접수번호: ${atcId}-${fdSn}`,
  ].filter((value): value is string => Boolean(value));

  return {
    externalSource: LOST112_SOURCE,
    externalId: `${atcId}:${fdSn}`,
    externalUrl: getLost112DetailUrl(item),
    externalPayload: { ...item },
    externalPayloadHash: createLost112PayloadHash(item),
    title,
    description: descriptionParts.join("\n"),
    imageUrl,
    imageUrls: imageUrl ? [imageUrl] : [],
    itemCategory: item.prdtClNm?.trim() || null,
    color: item.clrNm?.trim() || null,
    tags,
    location,
    date: parseLost112Date(item.fdYmd),
    contactInfo: contactInfo || null,
  };
}

async function normalizeLost112ExternalFoundItemWithAi(
  item: Lost112NormalizedItem
): Promise<ExternalFoundItemInput | null> {
  const fallbackItem = normalizeLost112ToExternalFoundItem(item);
  if (!fallbackItem) {
    return null;
  }

  const applyGeocoding = async (
    externalItem: ExternalFoundItemInput
  ): Promise<ExternalFoundItemInput> => {
    const geocoding = await geocodeLost112Location(item, externalItem.location);
    if (!geocoding) {
      return externalItem;
    }

    return {
      ...externalItem,
      location: geocoding.location,
      ...parseLocationParts(geocoding.location, geocoding),
      latitude: geocoding.latitude,
      longitude: geocoding.longitude,
      externalPayload: {
        ...(externalItem.externalPayload ?? {}),
        geocoding,
      },
    };
  };

  try {
    const response = await openai.chat.completions.create({
      model: GPT_TEXT_MODEL,
      messages: [
        {
          role: "system",
          content: [
            "너는 경찰청 Lost112 습득물 원천 데이터를 우리 서비스의 검색용 물건 메타데이터로 정규화하는 도우미다.",
            '반드시 JSON 객체만 반환하고 형식은 {"title":"...","itemCategory":"...","color":"...","size":"...","tags":["..."],"description":"...","location":"..."} 이어야 한다.',
            "원천 데이터에 없는 사실을 만들어내지 말고, 불확실하면 '알 수 없음' 또는 원천 표현을 보존해라.",
            "title은 사용자가 물건을 바로 알아볼 수 있는 짧은 한국어 명사구로 작성해라.",
            "description은 물품명, 색상, 습득 장소, 보관 장소, 담당 기관, 습득일처럼 매칭에 필요한 사실을 자연스러운 한국어 문장으로 정리해라.",
            "location은 반드시 행정구역 정보를 우선 포함해라. 가능한 경우 '시/도 시/군/구 읍/면/동 - 시설명/보관장소' 형식으로 작성해라.",
            "fdPlace, depPlace, orgNm에 행정구역이 일부만 있으면 추론 가능한 시/도·시/군/구까지만 포함하고, 확실하지 않은 세부 행정동은 만들지 마라.",
            "행정구역을 전혀 알 수 없으면 시설명과 보관장소를 함께 보존해라.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `Lost112 원천 JSON:\n${JSON.stringify(item, null, 2)}`,
            `현재 fallback JSON:\n${JSON.stringify(fallbackItem, null, 2)}`,
            "fallback의 externalSource, externalId, externalUrl, externalPayload, imageUrl, imageUrls, date, contactInfo는 유지한다. 검색/매칭 품질에 필요한 텍스트 메타데이터만 더 정확하게 정규화해라.",
            "특히 location은 시설명만 쓰지 말고 행정구역과 시설/보관장소를 같이 포함해라.",
          ].join("\n\n"),
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = getCompletionText(
      response,
      "Lost112 메타데이터 정규화 응답을 받지 못했습니다"
    );
    const normalized = normalizedAnalyzeImageSchema
      .extend({ location: z.string().min(1).optional() })
      .parse(JSON.parse(content));
    const normalizedMetadata = normalizeItemMetadata(normalized);

    const locationParts = parseLocationParts(
      normalizedMetadata.location ?? fallbackItem.location,
      null
    );

    return applyGeocoding({
      ...fallbackItem,
      title: normalizedMetadata.title,
      description: fallbackItem.description,
      itemCategory: normalizedMetadata.itemCategory,
      color: normalizedMetadata.color,
      size: normalizedMetadata.size,
      tags: Array.from(
        new Set([
          ...(fallbackItem.tags ?? []),
          ...(normalizedMetadata.tags ?? []),
        ])
      ),
      location: normalizedMetadata.location ?? fallbackItem.location,
      ...locationParts,
    });
  } catch (error) {
    console.error("Failed to normalize Lost112 item with AI:", error);
    return applyGeocoding({
      ...fallbackItem,
      ...parseLocationParts(fallbackItem.location, null),
    });
  }
}

async function runLost112Sync({
  apiKey,
  category,
  region,
  startDate,
  endDate,
  page = 1,
  numOfRows = 50,
  maxPages = 1,
  trigger = "manual",
}: Lost112SyncOptions): Promise<Lost112SyncResult> {
  const [syncRun] = await db
    .insert(lost112SyncRuns)
    .values({
      trigger,
      status: "running",
      page,
      numOfRows,
      maxPages,
    })
    .returning();
  const progress: Lost112ActiveSyncRun = {
    id: syncRun.id,
    trigger,
    phase: "fetching",
    page,
    numOfRows,
    maxPages,
    currentPage: null,
    fetchedCount: 0,
    processedCount: 0,
    totalToProcess: 0,
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    embeddedCount: 0,
    embeddingFailedCount: 0,
    automaticMatchCount: 0,
    currentExternalId: null,
    currentTitle: null,
    recentItems: [],
    startedAt: syncRun.startedAt,
    updatedAt: new Date(),
  };
  activeLost112SyncRuns.set(syncRun.id, progress);

  const fetchedItems: Lost112NormalizedItem[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let embeddedCount = 0;
  let embeddingFailedCount = 0;
  let automaticMatchCount = 0;
  const syncedItems: Item[] = [];

  try {
    for (let pageOffset = 0; pageOffset < maxPages; pageOffset += 1) {
      const pageData = await fetchLost112ItemsPage({
        apiKey,
        category,
        region,
        startDate,
        endDate,
        page: page + pageOffset,
        numOfRows,
      });

      progress.currentPage = pageData.pageNo;
      progress.fetchedCount = fetchedItems.length + pageData.items.length;
      touchLost112ActiveSyncRun(progress);

      console.log("[Lost112 Sync] page fetched:", {
        page: pageData.pageNo,
        rawCount: pageData.rawCount,
        filteredCount: pageData.items.length,
        totalCount: pageData.totalCount,
      });

      fetchedItems.push(...pageData.items);
      progress.totalToProcess = fetchedItems.length;
      touchLost112ActiveSyncRun(progress);

      if (pageData.items.length < pageData.numOfRows) {
        console.log("[Lost112 Sync] stopping page scan:", {
          page: pageData.pageNo,
          reason: "page returned fewer items than requested",
          filteredCount: pageData.items.length,
          numOfRows: pageData.numOfRows,
        });
        break;
      }
    }

    progress.phase = "processing";
    progress.totalToProcess = fetchedItems.length;
    touchLost112ActiveSyncRun(progress);

    for (const lost112Item of fetchedItems) {
      const atcId = lost112Item.atcId?.trim();
      if (!atcId) {
        progress.processedCount += 1;
        touchLost112ActiveSyncRun(progress);
        continue;
      }
      const fdSn = lost112Item.fdSn?.trim() || "1";
      const externalId = `${atcId}:${fdSn}`;
      progress.currentExternalId = externalId;
      progress.currentTitle =
        lost112Item.fdSbjt?.trim() ||
        lost112Item.fdPrdtNm?.trim() ||
        lost112Item.prdtClNm?.trim() ||
        null;
      touchLost112ActiveSyncRun(progress);
      const payloadHash = createLost112PayloadHash(lost112Item);
      const existingState = await getLost112SyncState(externalId);
      if (
        existingState?.item.externalPayloadHash === payloadHash &&
        existingState.hasEmbedding &&
        (!KAKAO_REST_API_KEY ||
          hasLost112LocationEnrichment(existingState.item))
      ) {
        skippedCount += 1;
        progress.skippedCount = skippedCount;
        progress.processedCount += 1;
        addLost112RecentSyncItem(progress, {
          externalId,
          title: existingState.item.title,
          action: "skipped",
        });
        syncedItems.push(existingState.item);
        continue;
      }

      const externalItem = await normalizeLost112ExternalFoundItemWithAi(
        lost112Item
      );
      if (!externalItem) {
        progress.processedCount += 1;
        addLost112RecentSyncItem(progress, {
          externalId,
          title: progress.currentTitle,
          action: "failed",
        });
        continue;
      }

      const { item, created } = await storage.upsertExternalFoundItem(
        externalItem
      );
      syncedItems.push(item);

      if (created) {
        createdCount += 1;
        progress.createdCount = createdCount;
      } else {
        updatedCount += 1;
        progress.updatedCount = updatedCount;
      }

      let itemEmbedding: number[] | undefined;
      try {
        itemEmbedding = await ensureItemEmbedding(item);
        embeddedCount += 1;
        progress.embeddedCount = embeddedCount;
      } catch (embeddingError) {
        embeddingFailedCount += 1;
        progress.embeddingFailedCount = embeddingFailedCount;
        console.error("Failed to store Lost112 item embedding:", embeddingError);
      }

      if (item.status === "active" && itemEmbedding !== undefined) {
        queueAutomaticMatchNotificationsForFoundItem(item, itemEmbedding);
        try {
          automaticMatchCount += await findAutomaticMatchesForFoundItem(item);
          progress.automaticMatchCount = automaticMatchCount;
        } catch (matchError) {
          console.error("Failed to match Lost112 item:", matchError);
        }
      }

      progress.processedCount += 1;
      addLost112RecentSyncItem(progress, {
        externalId,
        title: item.title,
        action: created ? "created" : "updated",
      });
    }

    await db
      .update(lost112SyncRuns)
      .set({
        status: "completed",
        fetchedCount: fetchedItems.length,
        createdCount,
        updatedCount,
        skippedCount,
        embeddedCount,
        embeddingFailedCount,
        automaticMatchCount,
        finishedAt: new Date(),
      })
      .where(eq(lost112SyncRuns.id, syncRun.id));

    console.log("[Lost112 Sync] job completed:", {
      trigger,
      fetchedCount: fetchedItems.length,
      createdCount,
      updatedCount,
      skippedCount,
      embeddedCount,
      embeddingFailedCount,
      automaticMatchCount,
    });

    return {
      fetchedCount: fetchedItems.length,
      createdCount,
      updatedCount,
      skippedCount,
      embeddedCount,
      embeddingFailedCount,
      automaticMatchCount,
      items: syncedItems,
    };
  } catch (error) {
    await db
      .update(lost112SyncRuns)
      .set({
        status: "failed",
        fetchedCount: fetchedItems.length,
        createdCount,
        updatedCount,
        skippedCount,
        embeddedCount,
        embeddingFailedCount,
        automaticMatchCount,
        errorMessage: getErrorMessage(error),
        finishedAt: new Date(),
      })
      .where(eq(lost112SyncRuns.id, syncRun.id));
    throw error;
  } finally {
    activeLost112SyncRuns.delete(syncRun.id);
  }
}

async function reprocessExistingLost112Items({
  limit = 100,
  offset = 0,
  onlyMissingLocation = true,
  onlyMissingEmbedding = false,
}: {
  limit?: number;
  offset?: number;
  onlyMissingLocation?: boolean;
  onlyMissingEmbedding?: boolean;
}): Promise<{
  fetchedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  embeddedCount: number;
  embeddingFailedCount: number;
  automaticMatchCount: number;
  items: Item[];
}> {
  const conditions = [eq(items.externalSource, LOST112_SOURCE)];
  if (onlyMissingLocation) {
    conditions.push(or(isNull(items.latitude), isNull(items.longitude))!);
  }

  const existingItems = onlyMissingEmbedding
    ? (
        await db
          .select({ item: items })
          .from(items)
          .leftJoin(itemEmbeddings, eq(items.id, itemEmbeddings.itemId))
          .where(and(...conditions, isNull(itemEmbeddings.itemId)))
          .orderBy(asc(items.id))
          .limit(limit)
          .offset(offset)
      ).map((row) => row.item)
    : await db
        .select()
        .from(items)
        .where(and(...conditions))
        .orderBy(asc(items.id))
        .limit(limit)
        .offset(offset);

  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let embeddedCount = 0;
  let embeddingFailedCount = 0;
  let automaticMatchCount = 0;
  const processedItems: Item[] = [];

  for (const existingItem of existingItems) {
    const lost112Item = normalizeStoredLost112Payload(
      existingItem.externalPayload
    );
    if (!lost112Item) {
      skippedCount += 1;
      continue;
    }

    try {
      const externalItem = await normalizeLost112ExternalFoundItemWithAi(
        lost112Item
      );
      if (!externalItem) {
        skippedCount += 1;
        continue;
      }

      const { item } = await storage.upsertExternalFoundItem(externalItem);
      processedItems.push(item);
      updatedCount += 1;

      let itemEmbedding: number[] | undefined;
      try {
        itemEmbedding = await ensureItemEmbedding(item);
        embeddedCount += 1;
      } catch (embeddingError) {
        embeddingFailedCount += 1;
        console.error(
          "Failed to store reprocessed Lost112 item embedding:",
          embeddingError
        );
      }

      if (item.status === "active" && itemEmbedding !== undefined) {
        queueAutomaticMatchNotificationsForFoundItem(item, itemEmbedding);
        try {
          automaticMatchCount += await findAutomaticMatchesForFoundItem(item);
        } catch (matchError) {
          console.error("Failed to match reprocessed Lost112 item:", matchError);
        }
      }
    } catch (error) {
      failedCount += 1;
      console.error("Failed to reprocess existing Lost112 item:", error);
    }
  }

  return {
    fetchedCount: existingItems.length,
    updatedCount,
    skippedCount,
    failedCount,
    embeddedCount,
    embeddingFailedCount,
    automaticMatchCount,
    items: processedItems,
  };
}

function startLost112SyncScheduler(): void {
  const apiKey = process.env.LOST112_API_KEY;
  if (!LOST112_SYNC_ENABLED) {
    console.log("[Lost112 Sync] scheduler disabled by LOST112_SYNC_ENABLED");
    return;
  }
  if (!apiKey) {
    console.log("[Lost112 Sync] scheduler disabled because LOST112_API_KEY is missing");
    return;
  }

  let isRunning = false;
  const initialDelayMs = Math.max(0, LOST112_SYNC_INITIAL_DELAY_MS);
  const intervalMs = Math.max(1000 * 60, LOST112_SYNC_INTERVAL_MS);

  console.log("[Lost112 Sync] scheduler started:", {
    initialDelayMs,
    intervalMs,
    startPage: LOST112_SYNC_START_PAGE,
    numOfRows: LOST112_SYNC_NUM_ROWS,
    maxPages: LOST112_SYNC_MAX_PAGES,
  });

  const runScheduledSync = async () => {
    if (isRunning) {
      console.warn("[Lost112 Sync] previous job is still running; skipped");
      return;
    }

    isRunning = true;
    try {
      const result = await runLost112Sync({
        apiKey,
        page: LOST112_SYNC_START_PAGE,
        numOfRows: LOST112_SYNC_NUM_ROWS,
        maxPages: LOST112_SYNC_MAX_PAGES,
        trigger: "scheduled",
      });
      console.log("[Lost112 Sync] scheduled job completed:", {
        fetchedCount: result.fetchedCount,
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        skippedCount: result.skippedCount,
        embeddedCount: result.embeddedCount,
        embeddingFailedCount: result.embeddingFailedCount,
        automaticMatchCount: result.automaticMatchCount,
      });
    } catch (error) {
      console.error("[Lost112 Sync] scheduled job failed:", error);
    } finally {
      isRunning = false;
    }
  };

  setTimeout(() => {
    void runScheduledSync();
  }, initialDelayMs);

  setInterval(() => {
    void runScheduledSync();
  }, intervalMs);
}

function normalizePlainSearchText(value?: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^0-9a-zA-Z가-힣\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function itemMatchesLocationText(item: Item, locationText?: string): boolean {
  const locationHaystack = [
    item.title,
    item.location,
    item.description,
    item.itemCategory,
    item.contactInfo,
    item.externalPayload && typeof item.externalPayload === "object"
      ? Object.values(item.externalPayload).join(" ")
      : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");

  return locationTextMatchesFilter(locationHaystack, locationText);
}

function extractCompletionMessageContent(content: unknown): string | null {
  if (typeof content === "string") {
    const trimmed = content.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(content)) {
    const textParts = content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (
          typeof part === "object" &&
          part !== null &&
          "text" in part &&
          typeof (part as { text?: unknown }).text === "string"
        ) {
          return (part as { text: string }).text;
        }
        return "";
      })
      .join("")
      .trim();
    return textParts.length > 0 ? textParts : null;
  }
  if (typeof content === "object" && content !== null) {
    return JSON.stringify(content);
  }
  return null;
}

function getCompletionText(
  response: {
    choices?: Array<{ message?: { content?: unknown; refusal?: unknown } }>;
  },
  emptyContentErrorMessage: string
): string {
  const message = response.choices?.[0]?.message;
  const content = extractCompletionMessageContent(message?.content);
  if (content) {
    return content;
  }
  if (
    typeof message?.refusal === "string" &&
    message.refusal.trim().length > 0
  ) {
    throw new Error(`${emptyContentErrorMessage}: ${message.refusal.trim()}`);
  }
  throw new Error(emptyContentErrorMessage);
}

function validateSearchPrompt(prompt: string): string | null {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (normalized.length < 2) {
    return "검색어가 너무 짧아요. 물건 특징을 조금 더 입력해 주세요.";
  }
  const meaningfulChars = normalized.match(/[가-힣A-Za-z0-9]/g)?.length ?? 0;
  if (meaningfulChars < 2) {
    return "의미 있는 검색어를 입력해 주세요.";
  }
  const jamoCount = normalized.match(/[ㄱ-ㅎㅏ-ㅣ]/g)?.length ?? 0;
  const alnumKoreanCount = normalized.match(/[가-힣A-Za-z0-9]/g)?.length ?? 0;
  const totalSignal = jamoCount + alnumKoreanCount;
  const jamoRatio = totalSignal > 0 ? jamoCount / totalSignal : 0;

  if (jamoCount >= 3 || jamoRatio > 0.25) {
    return "자음/모음만 섞인 입력이 많아요. 물건 특징을 자연어로 입력해 주세요.";
  }
  const isEnglishOnly = /^[A-Za-z\s]+$/.test(normalized);
  if (isEnglishOnly) {
    const tokens = normalized.toLowerCase().split(/\s+/).filter(Boolean);
    const suspiciousTokenCount = tokens.filter((token) => {
      if (token.length < 6) {
        return false;
      }
      const vowelCount = token.match(/[aeiou]/g)?.length ?? 0;
      const vowelRatio = vowelCount / token.length;
      const uniqueRatio = new Set(token).size / token.length;
      return vowelRatio < 0.22 || uniqueRatio < 0.3;
    }).length;

    if (
      (tokens.length === 1 &&
        tokens[0].length >= 7 &&
        suspiciousTokenCount >= 1) ||
      suspiciousTokenCount >= 2
    ) {
      return "영문 난타처럼 보여요. 물건 특징을 문장으로 입력해 주세요. (예: black leather wallet with silver clip)";
    }
  }
  return null;
}

function parseCoordinate(value?: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getSearchCoordinates(input: {
  latitude?: string;
  longitude?: string;
}): { latitude: number; longitude: number } | null {
  const hasLatitude = Boolean(input.latitude);
  const hasLongitude = Boolean(input.longitude);

  if (!hasLatitude && !hasLongitude) {
    return null;
  }
  if (!hasLatitude || !hasLongitude) {
    throw new Error("위치 검색을 하려면 위도와 경도를 모두 전달해야 합니다.");
  }

  const latitude = parseCoordinate(input.latitude);
  const longitude = parseCoordinate(input.longitude);

  if (latitude === null || longitude === null) {
    throw new Error("위치 좌표 형식이 올바르지 않습니다.");
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("위치 좌표 범위가 올바르지 않습니다.");
  }

  return { latitude, longitude };
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function calculateDistanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  const earthRadiusKm = 6371;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(deltaLongitude / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function formatDistanceText(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)}km`;
}

function buildItemSearchText(item: {
  title?: string | null;
  description?: string | null;
  itemCategory?: string | null;
  color?: string | null;
  size?: string | null;
  tags?: string[] | null;
  location?: string | null;
  region1?: string | null;
  region2?: string | null;
  region3?: string | null;
  address?: string | null;
  placeName?: string | null;
}): string {
  const normalizedItem = normalizeItemMetadata(item);
  const region = [
    normalizedItem.region1,
    normalizedItem.region2,
    normalizedItem.region3,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
  const description = normalizedItem.description
    ? normalizedItem.description.slice(0, 300)
    : null;

  const sections = [
    normalizedItem.title ? `물건=${normalizedItem.title}` : null,
    normalizedItem.itemCategory
      ? `분류=${normalizedItem.itemCategory}`
      : null,
    normalizedItem.color ? `색상=${normalizedItem.color}` : null,
    normalizedItem.size ? `크기=${normalizedItem.size}` : null,
    region ? `지역=${region}` : null,
    normalizedItem.placeName ? `장소=${normalizedItem.placeName}` : null,
    normalizedItem.location ? `위치=${normalizedItem.location}` : null,
    normalizedItem.address ? `주소=${normalizedItem.address}` : null,
    description ? `설명=${description}` : null,
    normalizedItem.tags?.length
      ? `태그=${normalizedItem.tags.join(", ")}`
      : null,
  ].filter((value): value is string => Boolean(value));

  return sections.join(". ");
}

function normalizeKoreanText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^가-힣a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractQueryKeywords(queryText: string): string[] {
  const tokens = normalizeKoreanText(queryText)
    .split(" ")
    .filter((token) => token.length >= 2)
    .filter((token) => !/^\d+$/.test(token));
  return Array.from(new Set(tokens)).slice(0, 20);
}

function getItemEvidenceText(item: {
  title?: string | null;
  description?: string | null;
  itemCategory?: string | null;
  color?: string | null;
  size?: string | null;
  tags?: string[] | null;
  location?: string | null;
}): string {
  const normalizedItem = normalizeItemMetadata(item);
  return [
    normalizedItem.title,
    normalizedItem.description,
    normalizedItem.itemCategory,
    normalizedItem.color,
    normalizedItem.size,
    normalizedItem.location,
    normalizedItem.tags?.join(" "),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

function buildReasoningFromEvidence(params: {
  queryText: string;
  item: {
    title?: string | null;
    itemCategory?: string | null;
    color?: string | null;
    size?: string | null;
    tags?: string[] | null;
    description?: string | null;
  };
  matchScore: number;
  distanceKm?: number | null;
  llmReasoning?: string;
}): string {
  const { queryText, item, matchScore, distanceKm, llmReasoning } = params;

  const keywords = extractQueryKeywords(queryText);
  const evidenceText = normalizeKoreanText(getItemEvidenceText(item));
  const matchedKeywords = keywords
    .filter((keyword) => evidenceText.includes(keyword))
    .slice(0, 4);

  const detailClauses: string[] = [];
  if (item.itemCategory) {
    detailClauses.push(`카테고리는 '${item.itemCategory}'로 분류돼 있고`);
  }
  if (item.color) {
    detailClauses.push(`색상은 '${item.color}' 계열로 보이며`);
  }
  if (item.size) {
    detailClauses.push(`크기 정보는 '${item.size}'에 가깝습니다`);
  }
  if (item.tags?.length) {
    detailClauses.push(
      `태그에는 ${item.tags.slice(0, 3).join(", ")} 같은 특징이 포함돼 있어요`
    );
  }

  const evidenceSummary =
    matchedKeywords.length > 0
      ? `입력하신 표현 중 ${matchedKeywords.join(
          ", "
        )} 키워드가 후보 정보와 직접 겹칩니다.`
      : detailClauses.length > 0
      ? `${detailClauses.slice(0, 2).join(", ")}.`
      : "후보 설명과의 의미 유사도를 기준으로 우선 노출되었습니다.";

  const scorePercent = (Math.max(0, Math.min(1, matchScore)) * 100).toFixed(1);
  const normalizedScore = Math.max(0, Math.min(1, matchScore));

  const scoreSummary =
    normalizedScore >= 0.75
      ? `최종 매칭 점수는 약 ${scorePercent}%로 높습니다. 핵심 특징이 많이 겹치는 강한 후보입니다.`
      : normalizedScore >= 0.45
      ? `최종 매칭 점수는 약 ${scorePercent}%로 중간 수준입니다. 일부 특징이 맞아 추가 확인이 필요한 후보입니다.`
      : normalizedScore >= 0.25
      ? `최종 매칭 점수는 약 ${scorePercent}%로 낮은 편이라 참고용 후보로 보는 것이 좋습니다.`
      : `최종 매칭 점수는 약 ${scorePercent}%로 매우 낮아, 관련성이 약한 후보일 수 있습니다.`;
  const normalizedLlmReasoning = llmReasoning?.trim();
  const locationSummary =
    distanceKm !== null && distanceKm !== undefined
      ? `선택한 분실 위치 기준으로 약 ${formatDistanceText(
          distanceKm
        )} 거리여서 위치도 함께 반영했습니다.`
      : null;

  if (normalizedLlmReasoning) {
    return [
      normalizedLlmReasoning,
      evidenceSummary,
      locationSummary,
      scoreSummary,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" ");
  }

  return [evidenceSummary, locationSummary, scoreSummary]
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("Operation aborted");
  }
}

function isAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === "AbortError" || error.message === "Operation aborted";
}

function normalizeComparableText(value?: string | null): string {
  return normalizeKoreanText(value ?? "");
}

const CATEGORY_SYNONYM_GROUPS = [
  ["지갑", "반지갑", "장지갑", "카드지갑", "wallet", "card wallet"],
  ["가방", "백팩", "배낭", "숄더백", "토트백", "크로스백", "bag", "backpack"],
  [
    "핸드폰",
    "휴대폰",
    "스마트폰",
    "폰",
    "phone",
    "smartphone",
    "iphone",
    "galaxy",
  ],
  ["이어폰", "에어팟", "헤드폰", "무선이어폰", "earbuds", "airpods"],
  ["키", "열쇠", "차키", "key", "car key"],
  ["노트북", "랩탑", "laptop", "macbook"],
  ["모자", "캡", "cap", "hat"],
] as const;

const COLOR_SYNONYM_GROUPS = [
  ["검정", "검은색", "블랙", "까만색", "black", "dark"],
  ["흰색", "화이트", "하양", "white", "ivory", "cream"],
  ["회색", "그레이", "gray", "grey", "은색", "실버", "silver"],
  ["갈색", "브라운", "brown", "베이지", "tan", "camel"],
  ["파랑", "파란색", "블루", "남색", "네이비", "blue", "navy"],
  ["빨강", "빨간색", "레드", "red", "burgundy", "와인"],
  ["초록", "초록색", "그린", "green", "olive", "khaki", "카키"],
  ["노랑", "노란색", "옐로", "yellow", "gold", "골드"],
  ["보라", "보라색", "퍼플", "purple", "violet"],
] as const;

const LOCATION_SYNONYM_GROUPS = [
  ["지하철", "역", "출구", "station", "subway"],
  ["버스", "정류장", "bus", "stop"],
  ["학교", "캠퍼스", "college", "campus"],
  ["카페", "커피숍", "coffee", "cafe"],
  ["강남역", "2호선강남역", "강남역출구"],
  ["홍대입구역", "홍대역", "홍대입구"],
  ["잠실역", "잠실"],
] as const;

const KEYWORD_SYNONYM_GROUPS = [
  ...CATEGORY_SYNONYM_GROUPS,
  ...COLOR_SYNONYM_GROUPS,
  ...LOCATION_SYNONYM_GROUPS,
  ["주움", "주웠", "발견", "습득", "found"],
  ["잃어", "분실", "없어졌", "lost"],
  ["가죽", "레더", "leather"],
  ["충전케이스", "케이스", "case"],
  ["노트북가방", "노트북", "랩탑가방"],
] as const;

type NormalizableItemMetadata = {
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  itemCategory?: string | null;
  color?: string | null;
  size?: string | null;
  tags?: string[] | null;
  location?: string | null;
  region1?: string | null;
  region2?: string | null;
  region3?: string | null;
  address?: string | null;
  placeName?: string | null;
};

function canonicalizeWithGroups(
  value: string | null | undefined,
  groups: readonly (readonly string[])[]
): string {
  const normalizedValue = normalizeComparableText(value);
  if (!normalizedValue) {
    return "";
  }
  const matchedGroup = groups.find((group) =>
    group.some((token) =>
      normalizedValue.includes(normalizeComparableText(token))
    )
  );
  if (matchedGroup) {
    return normalizeComparableText(matchedGroup[0]);
  }
  return normalizedValue;
}

function normalizeMetadataTags(tags?: string[] | null): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }
  const normalizedTags = tags
    .map((tag) => tag.replace(/\s+/g, " ").trim())
    .filter((tag) => tag.length > 0);
  return Array.from(new Set(normalizedTags));
}

function normalizeItemMetadata<T extends NormalizableItemMetadata>(item: T): T {
  const normalizePlainText = (value?: string | null): string | undefined => {
    if (typeof value !== "string") {
      return undefined;
    }
    const normalizedValue = value.replace(/\s+/g, " ").trim();
    return normalizedValue.length > 0 ? normalizedValue : undefined;
  };

  const normalizedItem = { ...item } as T;

  if (item.title !== undefined) {
    normalizedItem.title = normalizePlainText(item.title) as T["title"];
  }
  if (item.description !== undefined) {
    normalizedItem.description = normalizePlainText(
      item.description
    ) as T["description"];
  }
  if (item.imageUrl !== undefined || item.imageUrls !== undefined) {
    const normalizedImageUrls = normalizeItemImageUrls(item);
    normalizedItem.imageUrls = normalizedImageUrls as T["imageUrls"];
    normalizedItem.imageUrl = (normalizedImageUrls[0] ?? null) as T["imageUrl"];
  }
  if (item.itemCategory !== undefined) {
    normalizedItem.itemCategory = normalizePlainText(
      item.itemCategory
    ) as T["itemCategory"];
  }
  if (item.color !== undefined) {
    normalizedItem.color = normalizePlainText(item.color) as T["color"];
  }
  if (item.size !== undefined) {
    normalizedItem.size = normalizePlainText(item.size) as T["size"];
  }
  if (item.location !== undefined) {
    normalizedItem.location = normalizePlainText(
      item.location
    ) as T["location"];
  }
  if (item.region1 !== undefined) {
    normalizedItem.region1 = normalizePlainText(item.region1) as T["region1"];
  }
  if (item.region2 !== undefined) {
    normalizedItem.region2 = normalizePlainText(item.region2) as T["region2"];
  }
  if (item.region3 !== undefined) {
    normalizedItem.region3 = normalizePlainText(item.region3) as T["region3"];
  }
  if (item.address !== undefined) {
    normalizedItem.address = normalizePlainText(item.address) as T["address"];
  }
  if (item.placeName !== undefined) {
    normalizedItem.placeName = normalizePlainText(
      item.placeName
    ) as T["placeName"];
  }
  if (item.tags !== undefined) {
    normalizedItem.tags = normalizeMetadataTags(item.tags) as T["tags"];
  }

  return normalizedItem;
}

function areSameNormalizedValue(
  left?: string | null,
  right?: string | null
): boolean {
  const normalizedLeft = normalizeComparableText(left);
  const normalizedRight = normalizeComparableText(right);
  return Boolean(normalizedLeft) && normalizedLeft === normalizedRight;
}

function hasTokenContainment(
  left?: string | null,
  right?: string | null
): boolean {
  const normalizedLeft = normalizeComparableText(left);
  const normalizedRight = normalizeComparableText(right);
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }
  return (
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  );
}

function hasSynonymGroupMatch(
  left: string | null | undefined,
  right: string | null | undefined,
  groups: readonly (readonly string[])[]
): boolean {
  const normalizedLeft = normalizeComparableText(left);
  const normalizedRight = normalizeComparableText(right);
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }
  return groups.some((group) => {
    const matchedLeft = group.some((token) =>
      normalizedLeft.includes(normalizeComparableText(token))
    );
    const matchedRight = group.some((token) =>
      normalizedRight.includes(normalizeComparableText(token))
    );
    return matchedLeft && matchedRight;
  });
}

function calculateFieldSimilarity(
  left: string | null | undefined,
  right: string | null | undefined,
  groups: readonly (readonly string[])[] = []
): number {
  const normalizedLeft = normalizeComparableText(left);
  const normalizedRight = normalizeComparableText(right);
  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }
  if (normalizedLeft === normalizedRight) {
    return 1;
  }
  if (hasSynonymGroupMatch(normalizedLeft, normalizedRight, groups)) {
    return 0.82;
  }
  if (hasTokenContainment(normalizedLeft, normalizedRight)) {
    return 0.64;
  }
  return 0;
}

function calculateTokenSimilarity(
  left: string,
  right: string,
  groups: readonly (readonly string[])[] = []
): number {
  if (left === right) {
    return 1;
  }
  if (hasSynonymGroupMatch(left, right, groups)) {
    return 0.88;
  }
  if (left.includes(right) || right.includes(left)) {
    return 0.68;
  }
  const shorterLength = Math.min(left.length, right.length);
  if (shorterLength >= 3) {
    const prefixLength = Array.from({ length: shorterLength }).findIndex(
      (_, index) => left[index] !== right[index]
    );
    const sharedPrefix = prefixLength === -1 ? shorterLength : prefixLength;
    if (sharedPrefix / shorterLength >= 0.6) {
      return 0.48;
    }
  }
  return 0;
}

function calculateTokenSetSimilarity(
  leftTokens: string[],
  rightTokens: string[],
  groups: readonly (readonly string[])[] = []
): number {
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }
  const scoreDirection = (
    sourceTokens: string[],
    candidateTokens: string[]
  ) => {
    const total = sourceTokens.reduce((sum, sourceToken) => {
      const bestMatch = candidateTokens.reduce((best, candidateToken) => {
        return Math.max(
          best,
          calculateTokenSimilarity(sourceToken, candidateToken, groups)
        );
      }, 0);
      return sum + bestMatch;
    }, 0);
    return total / sourceTokens.length;
  };
  return Number(
    (
      (scoreDirection(leftTokens, rightTokens) +
        scoreDirection(rightTokens, leftTokens)) /
      2
    ).toFixed(4)
  );
}

function calculateKeywordOverlapScore(source: Item, candidate: Item): number {
  const sourceKeywords = Array.from(
    new Set(
      extractQueryKeywords(getItemEvidenceText(source)).concat(
        (source.tags ?? [])
          .map((tag) => normalizeComparableText(tag))
          .filter(Boolean)
      )
    )
  );
  const candidateKeywords = Array.from(
    new Set(
      extractQueryKeywords(getItemEvidenceText(candidate)).concat(
        (candidate.tags ?? [])
          .map((tag) => normalizeComparableText(tag))
          .filter(Boolean)
      )
    )
  );

  if (sourceKeywords.length === 0 || candidateKeywords.length === 0) {
    return 0;
  }
  return calculateTokenSetSimilarity(
    sourceKeywords,
    candidateKeywords,
    KEYWORD_SYNONYM_GROUPS
  );
}

function calculateLocationTextSimilarity(
  source: Item,
  candidate: Item
): number {
  const normalizedSource = normalizeItemMetadata(source);
  const normalizedCandidate = normalizeItemMetadata(candidate);
  const sourceTokens = extractQueryKeywords(normalizedSource.location ?? "");
  const candidateTokens = extractQueryKeywords(
    normalizedCandidate.location ?? ""
  );
  return calculateTokenSetSimilarity(
    sourceTokens,
    candidateTokens,
    LOCATION_SYNONYM_GROUPS
  );
}

function calculateDateClosenessScore(source: Item, candidate: Item): number {
  if (!source.date || !candidate.date) {
    return 0;
  }
  const sourceTime = new Date(source.date).getTime();
  const candidateTime = new Date(candidate.date).getTime();
  const diffDays = Math.abs(sourceTime - candidateTime) / (1000 * 60 * 60 * 24);

  if (diffDays <= 3) {
    return 1;
  }
  if (diffDays <= 14) {
    return 0.75;
  }
  if (diffDays <= 30) {
    return 0.45;
  }
  if (diffDays <= 90) {
    return 0.2;
  }
  return 0;
}

function calculateDistanceScore(distanceKm: number | null): number {
  if (distanceKm === null) {
    return 0;
  }
  if (distanceKm <= 1) {
    return 0.35;
  }
  if (distanceKm <= 3) {
    return 0.2;
  }
  if (distanceKm <= 10) {
    return 0.08;
  }
  if (distanceKm <= 30) {
    return 0.02;
  }
  return 0;
}

function calculateCosineSimilarity(
  left: number[] | undefined,
  right: number[] | undefined
): number {
  if (!left || !right || left.length === 0 || right.length === 0) {
    return 0;
  }
  const dimensions = Math.min(left.length, right.length);
  let dotProduct = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < dimensions; index += 1) {
    dotProduct += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }
  const similarity = dotProduct / Math.sqrt(leftNorm * rightNorm);
  return Math.max(0, Math.min(1, similarity));
}

function calculateMatchDistanceKm(
  source: Item,
  candidate: Item
): number | null {
  const sourceLatitude = parseCoordinate(source.latitude);
  const sourceLongitude = parseCoordinate(source.longitude);
  const candidateLatitude = parseCoordinate(candidate.latitude);
  const candidateLongitude = parseCoordinate(candidate.longitude);

  if (
    sourceLatitude === null ||
    sourceLongitude === null ||
    candidateLatitude === null ||
    candidateLongitude === null
  ) {
    return null;
  }
  return calculateDistanceKm(
    { latitude: sourceLatitude, longitude: sourceLongitude },
    { latitude: candidateLatitude, longitude: candidateLongitude }
  );
}

function calculateAutomaticMatchScore(params: {
  sourceItem: Item;
  candidateItem: Item;
  sourceEmbedding?: number[];
  candidateEmbedding?: number[];
  distanceKm: number | null;
}): number {
  const { sourceEmbedding, candidateEmbedding, distanceKm } = params;
  const sourceItem = normalizeItemMetadata(params.sourceItem);
  const candidateItem = normalizeItemMetadata(params.candidateItem);

  const categoryScore = calculateFieldSimilarity(
    sourceItem.itemCategory,
    candidateItem.itemCategory,
    CATEGORY_SYNONYM_GROUPS
  );
  const colorScore = calculateFieldSimilarity(
    sourceItem.color,
    candidateItem.color,
    COLOR_SYNONYM_GROUPS
  );
  const keywordScore = calculateKeywordOverlapScore(sourceItem, candidateItem);
  const dateScore = calculateDateClosenessScore(sourceItem, candidateItem);
  const locationScore = Math.max(
    calculateDistanceScore(distanceKm),
    calculateLocationTextSimilarity(sourceItem, candidateItem)
  );
  const vectorScore = calculateCosineSimilarity(
    sourceEmbedding,
    candidateEmbedding
  );
  const hasMinimumSemanticEvidence =
    vectorScore >= AUTO_MATCH_MIN_VECTOR_SCORE ||
    keywordScore >= AUTO_MATCH_MIN_KEYWORD_SCORE ||
    categoryScore >= AUTO_MATCH_MIN_CATEGORY_SCORE;

  if (!hasMinimumSemanticEvidence) {
    return 0;
  }
  if (categoryScore === 0 && keywordScore < 0.2 && vectorScore < 0.38) {
    return 0;
  }
  if (dateScore === 0 && locationScore === 0 && vectorScore < 0.34) {
    return 0;
  }

  const blendedScore =
    categoryScore * 0.18 +
    colorScore * 0.08 +
    keywordScore * 0.26 +
    dateScore * 0.18 +
    locationScore * 0.06 +
    vectorScore * 0.24;

  return Math.max(0, Math.min(1, Number(blendedScore.toFixed(4))));
}

function formatStoredMatchScore(score: number): number {
  return Math.max(0, Math.min(1, score / 100));
}

function buildAutomaticMatchReason(params: {
  sourceItem: Item;
  candidateItem: Item;
  score: number;
  distanceKm: number | null;
}): string {
  const { sourceItem, candidateItem, score, distanceKm } = params;
  return buildReasoningFromEvidence({
    queryText: buildItemSearchText(sourceItem),
    item: candidateItem,
    matchScore: score,
    distanceKm,
  });
}

function getAutomaticRerankImageUrl(item: FoundItemForAutoMatch): string | undefined {
  if (!qwen || item.externalSource === LOST112_SOURCE) {
    return undefined;
  }

  const imageUrl = item.imageUrl?.trim();
  return imageUrl ? imageUrl : undefined;
}

async function ensureEmbeddingsForItems(itemsToEnsure: Item[]): Promise<void> {
  for (const item of itemsToEnsure) {
    try {
      await ensureItemEmbedding(item);
    } catch (error) {
      console.error(`Failed to ensure embedding for item ${item.id}:`, error);
    }
  }
}

const rawAnalyzeImageSchema = z.object({
  itemCategory: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  tags: z.array(z.string()).optional(),
  description: z.string().optional(),
  requiresMasking: z.boolean().optional(),
});

const normalizedAnalyzeImageSchema = z.object({
  title: z.string().min(1),
  itemCategory: z.string().min(1),
  color: z.string().min(1),
  size: z.string().min(1),
  tags: z.array(z.string()),
  description: z.string().min(1),
});

type RawAnalyzeImageResult = z.infer<typeof rawAnalyzeImageSchema>;
type NormalizedAnalyzeImageResult = z.infer<
  typeof normalizedAnalyzeImageSchema
>;

function buildLocalAnalyzeImageResult(
  rawResult: RawAnalyzeImageResult
): NormalizedAnalyzeImageResult {
  return normalizeItemMetadata({
    title: buildAnalyzedTitle(rawResult),
    itemCategory: rawResult.itemCategory?.trim() || "알 수 없음",
    color: rawResult.color?.trim() || "알 수 없음",
    size: rawResult.size?.trim() || "알 수 없음",
    tags: Array.isArray(rawResult.tags)
      ? rawResult.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)
      : [],
    description: rawResult.description?.trim() || "설명이 없습니다",
  });
}

function buildAnalyzedTitle(result: {
  description?: unknown;
  color?: unknown;
  itemCategory?: unknown;
}): string {
  const description =
    typeof result.description === "string" ? result.description.trim() : "";
  const color = typeof result.color === "string" ? result.color.trim() : "";
  const itemCategory =
    typeof result.itemCategory === "string" ? result.itemCategory.trim() : "";

  const cleanedDescriptionTitle = description
    .split(/[.!?\n]/)[0]
    ?.trim()
    .replace(/[(){}\[\]]/g, " ")
    .replace(/[,/]+/g, " ")
    .replace(
      /(?:으로\s*보이며|로\s*보이며|으로\s*보입니다|로\s*보입니다|으로\s*추정됩니다|로\s*추정됩니다|으로\s*추정됨|로\s*추정됨|으로\s*판단됩니다|로\s*판단됩니다|입니다|같습니다).*$/,
      ""
    )
    .replace(/^(?:이 물건은|해당 물건은|사진 속 물건은)\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  const titleSource =
    cleanedDescriptionTitle && cleanedDescriptionTitle.length >= 2
      ? cleanedDescriptionTitle
      : [color, itemCategory]
          .filter((value) => value.length > 0)
          .join(" ")
          .trim();

  if (!titleSource) {
    return "분실물";
  }

  const includesColor = color.length > 0 && titleSource.includes(color);
  const simplifiedTitle = includesColor
    ? titleSource
    : [color, titleSource].filter((value) => value.length > 0).join(" ");

  if (simplifiedTitle.length > 30) {
    return simplifiedTitle.slice(0, 30).trim();
  }
  return simplifiedTitle;
}

async function normalizeAnalyzeImageMetadata(
  rawResult: RawAnalyzeImageResult
): Promise<NormalizedAnalyzeImageResult> {
  const fallbackResult = buildLocalAnalyzeImageResult(rawResult);
  const response = await openai.chat.completions.create({
    model: GPT_TEXT_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "너는 분실물 이미지 분석 결과를 정규화하는 도우미다.",
          '반드시 JSON 객체만 반환하고 형식은 {"title":"...","itemCategory":"...","color":"...","size":"...","tags":["..."],"description":"..."} 이어야 한다.',
          "각 필드는 다음 규칙을 따른다.",
          "- title: 물건이 무엇인지 바로 알 수 있는 짧은 한국어 명사구. 문장형 표현 금지. 색상과 브랜드/종류가 중요하면 포함.",
          "- itemCategory: 가장 적절한 물건 카테고리 하나.",
          "- color: 대표 색상 1~2개를 짧게 정리.",
          "- size: 보이면 구체적으로, 없으면 '알 수 없음'.",
          "- tags: 검색에 도움이 되는 짧은 키워드 배열. 중복 금지.",
          "- description: 자연스러운 한국어 1~2문장. 첫 문장에서 물건의 정체를 먼저 설명.",
          "불확실한 정보는 과장하지 말고, 알 수 없으면 보수적으로 정리해라.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `원본 분석 JSON:\n${JSON.stringify(rawResult, null, 2)}`,
          `안전 fallback JSON:\n${JSON.stringify(fallbackResult, null, 2)}`,
          "fallback은 참고용이며, 원본 분석을 바탕으로 가장 자연스럽고 검색 친화적인 최종 JSON을 만들어라.",
        ].join("\n\n"),
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = getCompletionText(
    response,
    "이미지 메타데이터 정규화 응답을 받지 못했습니다"
  );

  const normalized = normalizedAnalyzeImageSchema.parse(JSON.parse(content));
  return normalizeItemMetadata({
    title: normalized.title.trim(),
    itemCategory: normalized.itemCategory.trim(),
    color: normalized.color.trim(),
    size: normalized.size.trim(),
    tags: normalized.tags
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0),
    description: normalized.description.trim(),
  });
}

type EmbeddingInputKind = "query" | "passage";

function formatEmbeddingInput(text: string, kind: EmbeddingInputKind): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    throw new Error("임베딩할 검색 텍스트가 없습니다");
  }
  if (EMBEDDING_PROVIDER === "local") {
    return normalized.startsWith("query: ") || normalized.startsWith("passage: ")
      ? normalized
      : `${kind}: ${normalized}`;
  }
  return normalized;
}

async function createEmbedding(
  text: string,
  kind: EmbeddingInputKind = "query",
  signal?: AbortSignal
): Promise<number[]> {
  const input = formatEmbeddingInput(text, kind);
  abortIfNeeded(signal);
  if (EMBEDDING_PROVIDER === "local") {
    const response = await fetch(LOCAL_EMBEDDING_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input }),
      signal,
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `로컬 임베딩 생성에 실패했습니다 (${response.status}): ${errorText}`
      );
    }
    const payload = (await response.json()) as {
      model?: string;
      dimensions?: number;
      data?: unknown;
    };
    const embedding = Array.isArray(payload.data)
      ? Array.isArray(payload.data[0])
        ? payload.data[0]
        : payload.data
      : undefined;
    if (
      !Array.isArray(embedding) ||
      !embedding.every((value) => typeof value === "number")
    ) {
      throw new Error("로컬 임베딩 서버 응답 형식이 올바르지 않습니다");
    }
    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `로컬 임베딩 차원이 맞지 않습니다: expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}`
      );
    }
    return embedding;
  }

  if (EMBEDDING_PROVIDER !== "openai") {
    throw new Error(`지원하지 않는 임베딩 provider입니다: ${EMBEDDING_PROVIDER}`);
  }
  const response = await openai.embeddings.create(
    {
      model: OPENAI_EMBEDDING_MODEL,
      input,
      dimensions: EMBEDDING_DIMENSIONS,
    },
    {
      signal,
    }
  );

  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error("임베딩 생성에 실패했습니다");
  }
  return embedding;
}

async function createImageSearchText(
  imageUrl: string,
  signal?: AbortSignal
): Promise<string> {
  abortIfNeeded(signal);
  const response = await getQwenClient().chat.completions.create(
    {
      model: QWEN_VISION_MODEL,
      messages: [
        {
          role: "system",
          content:
            '너는 분실물 검색용 이미지 요약 도우미다. 제공된 이미지를 보고 검색에 도움이 되는 한국어 JSON 객체만 반환해라. 형식은 {"itemCategory":"...","color":"...","size":"...","tags":["..."],"description":"..."} 이다.',
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "이 이미지를 분실물 검색용 텍스트로 요약해줘. 반드시 한국어 JSON만 반환해줘.",
            },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    },
    {
      signal,
    }
  );

  const content = getCompletionText(
    response,
    "이미지 검색 텍스트 생성에 실패했습니다"
  );
  const parsed = normalizeItemMetadata(JSON.parse(content));
  return buildItemSearchText({
    itemCategory: parsed.itemCategory,
    color: parsed.color,
    size: parsed.size,
    description: parsed.description,
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
  });
}

async function ensureItemEmbedding(
  item: {
    id: number;
    title?: string | null;
    description?: string | null;
    itemCategory?: string | null;
    color?: string | null;
    size?: string | null;
    tags?: string[] | null;
    location?: string | null;
    latitude?: string | null;
    longitude?: string | null;
    region1?: string | null;
    region2?: string | null;
    region3?: string | null;
    address?: string | null;
    placeName?: string | null;
  },
  signal?: AbortSignal
): Promise<number[]> {
  const normalizedItem = normalizeItemMetadata(item);
  const content = buildItemSearchText(normalizedItem);
  const embedding = await createEmbedding(content, "passage", signal);
  await storage.upsertItemEmbedding(item.id, content, embedding);
  return embedding;
}

async function backfillItemEmbeddings(
  reportType: "lost" | "found",
  limit?: number,
  signal?: AbortSignal
): Promise<void> {
  const missingItems = await storage.getItemsWithoutEmbeddings(
    reportType,
    limit
  );
  for (const item of missingItems) {
    abortIfNeeded(signal);
    try {
      await ensureItemEmbedding(item, signal);
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      console.error(
        `Failed to backfill embedding for ${reportType} item ${item.id}:`,
        error
      );
    }
  }
}

async function backfillFoundItemEmbeddings(): Promise<void> {
  await backfillItemEmbeddings("found");
}

function mapMatchResponse(match: {
  match: {
    id: number;
    lostItemId: number;
    foundItemId: number;
    score: number;
    matchReason: string;
    status: string;
    notifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
  lostItem: Item;
  foundItem: Item;
}) {
  return {
    ...match.match,
    status: match.match.status as ItemMatchStatus,
    score: formatStoredMatchScore(match.match.score),
    lostItem: match.lostItem,
    foundItem: match.foundItem,
  };
}

async function findAutomaticMatchesForFoundItem(
  foundItem: Item
): Promise<number> {
  const candidateLostItems = await storage.getCandidateItemsForAutoMatch(
    foundItem,
    AUTO_MATCH_CANDIDATE_LIMIT
  );

  if (candidateLostItems.length === 0) {
    return 0;
  }

  const relatedItems = [foundItem, ...candidateLostItems];
  let embeddingsByItemId = await storage.getItemEmbeddings(
    relatedItems.map((item) => item.id)
  );

  if (!embeddingsByItemId.has(foundItem.id)) {
    await ensureEmbeddingsForItems([foundItem]);
    embeddingsByItemId = await storage.getItemEmbeddings(
      relatedItems.map((item) => item.id)
    );
  }

  const sourceEmbedding = embeddingsByItemId.get(foundItem.id);
  const matchesToPersist = candidateLostItems
    .map((lostItem) => {
      const distanceKm = calculateMatchDistanceKm(foundItem, lostItem);
      const normalizedScore = calculateAutomaticMatchScore({
        sourceItem: foundItem,
        candidateItem: lostItem,
        sourceEmbedding,
        candidateEmbedding: embeddingsByItemId.get(lostItem.id),
        distanceKm,
      });

      if (normalizedScore < AUTO_MATCH_MIN_SCORE) {
        return null;
      }

      return {
        lostItemId: lostItem.id,
        foundItemId: foundItem.id,
        score: Math.round(normalizedScore * 100),
        matchReason: buildAutomaticMatchReason({
          sourceItem: foundItem,
          candidateItem: lostItem,
          score: normalizedScore,
          distanceKm,
        }),
        status: "new" as const,
      };
    })
    .filter(
      (
        match
      ): match is {
        lostItemId: number;
        foundItemId: number;
        score: number;
        matchReason: string;
        status: "new";
      } => Boolean(match)
    )
    .sort((left, right) => right.score - left.score)
    .slice(0, AUTO_MATCH_MAX_RESULTS);

  await Promise.all(
    matchesToPersist.map((match) => storage.upsertItemMatch(match))
  );

  console.log(
    `[FCM] findAutomaticMatchesForFoundItem: ${matchesToPersist.length}개 매칭, FCM 발송 시작`
  );
  for (const match of matchesToPersist) {
    const lostItem = await storage.getItem(match.lostItemId);
    if (!lostItem?.userId) {
      console.log(`[FCM] 분실물 ${match.lostItemId}의 userId 없음 - 스킵`);
      continue;
    }

    const existingMatch = await db.query.itemMatches.findFirst({
      where: and(
        eq(itemMatches.lostItemId, match.lostItemId),
        eq(itemMatches.foundItemId, match.foundItemId)
      ),
    });
    if (existingMatch?.notifiedAt) {
      console.log(
        `[FCM] 매칭 ${match.lostItemId}-${match.foundItemId} 이미 알림 발송됨 - 스킵`
      );
      continue;
    }

    const user = await storage.getUser(lostItem.userId);
    if (!user?.fcmToken) {
      console.log(`[FCM] 사용자 ${lostItem.userId}의 FCM 토큰 없음 - 스킵`);
      continue;
    }

    console.log(`[FCM] 사용자 ${lostItem.userId}에게 매칭 알림 발송`);
    void sendFcmNotification({
      fcmToken: user.fcmToken,
      title: "새로운 매칭 발견!",
      body: `"${lostItem.title}"과 유사한 습득물이 등록되었어요.`,
      data: {
        type: "item_match",
        lostItemId: String(match.lostItemId),
        foundItemId: String(match.foundItemId),
      },
    });

    await db
      .update(itemMatches)
      .set({ notifiedAt: new Date() })
      .where(
        and(
          eq(itemMatches.lostItemId, match.lostItemId),
          eq(itemMatches.foundItemId, match.foundItemId)
        )
      );
  }

  return matchesToPersist.length;
}

async function findAutomaticMatchesForLostItem(
  lostItem: Item
): Promise<number> {
  const candidateFoundItems = await storage.getCandidateItemsForAutoMatch(
    lostItem,
    AUTO_MATCH_CANDIDATE_LIMIT
  );

  if (candidateFoundItems.length === 0) {
    return 0;
  }

  const relatedItems = [lostItem, ...candidateFoundItems];
  let embeddingsByItemId = await storage.getItemEmbeddings(
    relatedItems.map((item) => item.id)
  );

  if (!embeddingsByItemId.has(lostItem.id)) {
    await ensureEmbeddingsForItems([lostItem]);
    embeddingsByItemId = await storage.getItemEmbeddings(
      relatedItems.map((item) => item.id)
    );
  }

  const sourceEmbedding = embeddingsByItemId.get(lostItem.id);
  const matchesToPersist = candidateFoundItems
    .map((foundItem) => {
      const distanceKm = calculateMatchDistanceKm(lostItem, foundItem);
      const normalizedScore = calculateAutomaticMatchScore({
        sourceItem: lostItem,
        candidateItem: foundItem,
        sourceEmbedding,
        candidateEmbedding: embeddingsByItemId.get(foundItem.id),
        distanceKm,
      });

      if (normalizedScore < AUTO_MATCH_MIN_SCORE) {
        return null;
      }

      return {
        lostItemId: lostItem.id,
        foundItemId: foundItem.id,
        score: Math.round(normalizedScore * 100),
        matchReason: buildAutomaticMatchReason({
          sourceItem: lostItem,
          candidateItem: foundItem,
          score: normalizedScore,
          distanceKm,
        }),
        status: "new" as const,
      };
    })
    .filter(
      (
        match
      ): match is {
        lostItemId: number;
        foundItemId: number;
        score: number;
        matchReason: string;
        status: "new";
      } => Boolean(match)
    )
    .sort((left, right) => right.score - left.score)
    .slice(0, AUTO_MATCH_MAX_RESULTS);

  await Promise.all(
    matchesToPersist.map((match) => storage.upsertItemMatch(match))
  );

  console.log(
    `[FCM] findAutomaticMatchesForLostItem: ${matchesToPersist.length}개 매칭, FCM 발송 시작`
  );
  for (const match of matchesToPersist) {
    const foundItem = await storage.getItem(match.foundItemId);
    if (!foundItem?.userId) {
      console.log(`[FCM] 습득물 ${match.foundItemId}의 userId 없음 - 스킵`);
      continue;
    }

    const existingMatch = await db.query.itemMatches.findFirst({
      where: and(
        eq(itemMatches.lostItemId, match.lostItemId),
        eq(itemMatches.foundItemId, match.foundItemId)
      ),
    });
    if (existingMatch?.notifiedAt) {
      console.log(
        `[FCM] 매칭 ${match.lostItemId}-${match.foundItemId} 이미 알림 발송됨 - 스킵`
      );
      continue;
    }

    const user = await storage.getUser(foundItem.userId);
    if (!user?.fcmToken) {
      console.log(`[FCM] 사용자 ${foundItem.userId}의 FCM 토큰 없음 - 스킵`);
      continue;
    }

    console.log(`[FCM] 사용자 ${foundItem.userId}에게 매칭 알림 발송`);
    void sendFcmNotification({
      fcmToken: user.fcmToken,
      title: "새로운 매칭 발견!",
      body: `"${foundItem.title}"과 유사한 분실물이 등록되었어요.`,
      data: {
        type: "item_match",
        lostItemId: String(match.lostItemId),
        foundItemId: String(match.foundItemId),
      },
    });

    await db
      .update(itemMatches)
      .set({ notifiedAt: new Date() })
      .where(
        and(
          eq(itemMatches.lostItemId, match.lostItemId),
          eq(itemMatches.foundItemId, match.foundItemId)
        )
      );
  }

  return matchesToPersist.length;
}

type VectorCandidate = Awaited<
  ReturnType<typeof storage.searchItemsByEmbedding>
>[number];
type RankedVectorCandidate = VectorCandidate & {
  distanceKm: number | null;
};
type FoundItemForAutoMatch = {
  id: number;
  userId?: number | null;
  reportType: string;
  status?: string | null;
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  itemCategory?: string | null;
  color?: string | null;
  size?: string | null;
  tags?: string[] | null;
  location?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  externalSource?: string | null;
};
let automaticMatchQueue: Promise<void> = Promise.resolve();

async function monitorAutomaticMatchJob<T>(
  jobFactory: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  const abortController = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      console.warn(`${label} exceeded timeout of ${timeoutMs}ms`);
      abortController.abort();
      reject(new Error(`${label} exceeded timeout of ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      jobFactory(abortController.signal),
      timeoutPromise,
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function queueAutomaticMatchNotificationsForFoundItem(
  foundItem: FoundItemForAutoMatch,
  existingEmbedding?: number[]
): void {
  automaticMatchQueue = automaticMatchQueue
    .catch(() => undefined)
    .then(() =>
      monitorAutomaticMatchJob(
        (signal) =>
          runAutomaticMatchNotificationsForFoundItem(
            foundItem,
            existingEmbedding,
            signal
          ),
        AUTO_MATCH_JOB_TIMEOUT_MS,
        `Automatic match job for item ${foundItem.id}`
      )
    )
    .catch((error) => {
      console.error("Failed to process automatic match notifications:", error);
    });
}

async function runAutomaticMatchNotificationsForFoundItem(
  foundItem: FoundItemForAutoMatch,
  existingEmbedding?: number[],
  signal?: AbortSignal
): Promise<void> {
  if (foundItem.reportType !== "found" || foundItem.status !== "active") {
    return;
  }

  abortIfNeeded(signal);
  const storedEmbedding = existingEmbedding
    ? undefined
    : await storage.getItemEmbedding(foundItem.id);
  const foundEmbedding =
    existingEmbedding ??
    storedEmbedding?.embedding ??
    (await ensureItemEmbedding(foundItem, signal));
  await backfillItemEmbeddings("lost", AUTO_MATCH_BACKFILL_LIMIT, signal);

  const foundLatitude = parseCoordinate(foundItem.latitude);
  const foundLongitude = parseCoordinate(foundItem.longitude);
  const normalizedCoordinates =
    foundLatitude !== null && foundLongitude !== null
      ? {
          latitude: foundLatitude,
          longitude: foundLongitude,
        }
      : null;

  const vectorMatches = await storage.searchItemsByEmbedding(
    "lost",
    foundEmbedding,
    VECTOR_CANDIDATE_COUNT
  );

  const filteredVectorMatches: RankedVectorCandidate[] = vectorMatches
    .filter((result) => result.score >= MIN_VECTOR_MATCH_SCORE)
    .map((result) => {
      const itemLatitude = parseCoordinate(result.item.latitude);
      const itemLongitude = parseCoordinate(result.item.longitude);
      const distanceKm =
        normalizedCoordinates && itemLatitude !== null && itemLongitude !== null
          ? calculateDistanceKm(normalizedCoordinates, {
              latitude: itemLatitude,
              longitude: itemLongitude,
            })
          : null;

      return {
        ...result,
        distanceKm,
      };
    });

  if (filteredVectorMatches.length === 0) {
    return;
  }

  abortIfNeeded(signal);
  const queryText = buildItemSearchText(foundItem);
  const rerankedMatches = await rerankCandidates({
    prompt: foundItem.description ?? undefined,
    imageUrl: getAutomaticRerankImageUrl(foundItem),
    queryText,
    candidates: filteredVectorMatches,
    signal,
  });

  const vectorMatchById = new Map(
    filteredVectorMatches.map((candidate) => [candidate.item.id, candidate])
  );

  const matchedNotifications = rerankedMatches
    .map((result) => {
      const vectorMatch = vectorMatchById.get(result.itemId);
      if (!vectorMatch) {
        return null;
      }

      const llmScore = Math.max(0, Math.min(1, result.score));
      const blendedScore = Number(
        (vectorMatch.score * 0.35 + llmScore * 0.65).toFixed(4)
      );

      if (blendedScore < MIN_FINAL_MATCH_SCORE) {
        return null;
      }

      if (
        !vectorMatch.item.userId ||
        vectorMatch.item.userId === foundItem.userId
      ) {
        return null;
      }

      return {
        userId: vectorMatch.item.userId,
        lostItemId: vectorMatch.item.id,
        foundItemId: foundItem.id,
        score: blendedScore,
        reasoning: buildReasoningFromEvidence({
          queryText,
          item: vectorMatch.item,
          matchScore: blendedScore,
          distanceKm: vectorMatch.distanceKm,
          llmReasoning: result.reasoning,
        }),
      };
    })
    .filter(
      (
        notification
      ): notification is {
        userId: number;
        lostItemId: number;
        foundItemId: number;
        score: number;
        reasoning: string;
      } => notification !== null
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, AUTO_MATCH_RESULT_COUNT);

  await Promise.all(
    matchedNotifications.map((notification) =>
      storage.upsertMatchNotification(notification)
    )
  );

  console.log(
    `[FCM] 매칭 알림 ${matchedNotifications.length}개 생성됨, FCM 발송 시작`
  );
  for (const notification of matchedNotifications) {
    const existingNotification = await db.query.matchNotifications.findFirst({
      where: and(
        eq(matchNotifications.userId, notification.userId),
        eq(matchNotifications.lostItemId, notification.lostItemId),
        eq(matchNotifications.foundItemId, notification.foundItemId)
      ),
    });
    if (existingNotification?.notifiedAt) {
      console.log(
        `[FCM] 매칭 알림 ${notification.lostItemId}-${notification.foundItemId} 이미 발송됨 - 스킵`
      );
      continue;
    }

    console.log(`[FCM] 사용자 ${notification.userId} 조회 중...`);
    const user = await storage.getUser(notification.userId);
    if (!user?.fcmToken) {
      console.log(`[FCM] 사용자 ${notification.userId} 토큰 없음 - 스킵`);
      continue;
    }
    console.log(`[FCM] 사용자 ${notification.userId} 토큰 확인됨, 발송 시도`);
    const foundItemData = await storage.getItem(notification.foundItemId);
    void sendFcmNotification({
      fcmToken: user.fcmToken,
      title: "새로운 매칭 발견!",
      body: `"${
        foundItemData?.title ?? "물건"
      }"과 유사한 습득물이 등록되었어요.`,
      data: {
        type: "match_notification",
        lostItemId: String(notification.lostItemId),
        foundItemId: String(notification.foundItemId),
      },
    });

    await db
      .update(matchNotifications)
      .set({ notifiedAt: new Date() })
      .where(
        and(
          eq(matchNotifications.userId, notification.userId),
          eq(matchNotifications.lostItemId, notification.lostItemId),
          eq(matchNotifications.foundItemId, notification.foundItemId)
        )
      );
  }
}

async function rerankCandidates(params: {
  prompt?: string;
  imageUrl?: string;
  queryText: string;
  candidates: VectorCandidate[];
  signal?: AbortSignal;
}): Promise<Array<{ itemId: number; score: number; reasoning: string }>> {
  const { prompt, imageUrl, queryText, candidates, signal } = params;
  const aiClient = imageUrl ? getQwenClient() : openai;
  const model = imageUrl ? QWEN_VISION_MODEL : GPT_TEXT_MODEL;

  abortIfNeeded(signal);

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: [
        "다음은 벡터 검색으로 먼저 추린 습득물 후보 목록이다.",
        "사용자 분실물 정보와 각 후보를 비교해서 실제로 같은 물건일 가능성을 다시 평가해라.",
        '반드시 JSON 객체만 반환하고 형식은 {"matches": [{"itemId": 1, "score": 0.91, "reasoning": "한국어 설명"}]} 이어야 한다.',
        "score는 0부터 1 사이 숫자여야 하고, reasoning은 자연스러운 한국어 한두 문장이어야 한다.",
        `사용자 검색 텍스트:\n${queryText}`,
        prompt ? `사용자 원문 설명:\n${prompt}` : null,
        `후보 목록:\n${JSON.stringify(
          candidates.map((candidate) => ({
            itemId: candidate.item.id,
            vectorScore: Number(candidate.score.toFixed(4)),
            title: candidate.item.title,
            description: candidate.item.description,
            itemCategory: candidate.item.itemCategory,
            color: candidate.item.color,
            size: candidate.item.size,
            tags: candidate.item.tags,
            location: candidate.item.location,
          }))
        )}`,
      ]
        .filter((value): value is string => Boolean(value))
        .join("\n\n"),
    },
  ];

  if (imageUrl) {
    userContent.push({ type: "image_url", image_url: { url: imageUrl } });
  }

  const response = await aiClient.chat.completions.create(
    {
      model,
      messages: [
        {
          role: "system",
          content:
            "너는 분실물-습득물 매칭 재랭킹 도우미다. 벡터 검색 후보 중에서 실제로 일치할 가능성이 높은 항목만 골라 다시 점수화해라. 반드시 JSON 객체만 반환하고, reasoning은 모두 한국어로 작성해라.",
        },
        {
          role: "user",
          content: userContent,
        },
      ],
      response_format: { type: "json_object" },
    },
    {
      signal,
    }
  );

  const content = getCompletionText(response, "재랭킹 응답을 받지 못했습니다");

  const parsed = JSON.parse(content);
  const matches: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.matches)
    ? parsed.matches
    : [];

  return matches
    .map((match: unknown) => {
      const result = z
        .object({
          itemId: z.number(),
          score: z.number(),
          reasoning: z.string(),
        })
        .safeParse(match);

      return result.success ? result.data : null;
    })
    .filter(
      (match): match is { itemId: number; score: number; reasoning: string } =>
        Boolean(match)
    );
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // --- Auth API ---
  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);

      const existingUser = await storage.getUserByUsername(input.username);
      if (existingUser) {
        return res.status(400).json({ message: "이미 존재하는 아이디입니다" });
      }

      const user = await storage.createUser(input);
      req.login(user, (err) => {
        if (err) {
          return res
            .status(500)
            .json({ message: "로그인 처리 중 오류가 발생했습니다" });
        }
        const { password: _, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (err) {
      console.error("Register error:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      res.status(500).json({
        message: err instanceof Error ? err.message : "Internal server error",
      });
    }
  });

  app.post(api.auth.login.path, (req, res, next) => {
    passport.authenticate(
      "local",
      (
        err: Error | null,
        user: Express.User | false,
        info: { message: string } | undefined
      ) => {
        if (err) {
          return res.status(500).json({ message: "Internal server error" });
        }
        if (!user) {
          return res
            .status(401)
            .json({ message: info?.message || "로그인에 실패했습니다" });
        }
        req.login(user, (err) => {
          if (err) {
            return res
              .status(500)
              .json({ message: "로그인 처리 중 오류가 발생했습니다" });
          }
          const { password: _, ...userWithoutPassword } = user;
          res.json(userWithoutPassword);
        });
      }
    )(req, res, next);
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.logout((err) => {
      if (err) {
        return res
          .status(500)
          .json({ message: "로그아웃 중 오류가 발생했습니다" });
      }
      res.json({ message: "로그아웃 되었습니다" });
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (!req.user) {
      return res.json(null);
    }
    const { password: _, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });

  // --- Admin API ---
  app.get(api.admin.dashboard.path, isAdmin, async (_req, res) => {
    try {
      const dashboard = await storage.getAdminDashboardData();
      res.json(dashboard);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: getErrorMessage(err) });
    }
  });

  app.get(api.admin.users.path, isAdmin, async (req, res) => {
    try {
      const usersList = await storage.getAdminUsers({
        search:
          typeof req.query.search === "string" ? req.query.search : undefined,
        role:
          typeof req.query.role === "string"
            ? (req.query.role as "member" | "admin")
            : undefined,
        status:
          typeof req.query.status === "string"
            ? (req.query.status as "active" | "suspended")
            : undefined,
      });
      res.json(usersList);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: getErrorMessage(err) });
    }
  });

  app.patch(api.admin.updateUser.path, isAdmin, async (req, res) => {
    try {
      const userId = positiveIdSchema.parse(req.params.id);
      const input = api.admin.updateUser.input.parse(req.body);
      const isCurrentAdmin = req.user?.id === userId;

      if (isCurrentAdmin && input.status === "suspended") {
        return res.status(400).json({
          message:
            "\uD604\uC7AC \uB85C\uADF8\uC778\uD55C \uAD00\uB9AC\uC790 \uACC4\uC815\uC740 \uC815\uC9C0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.",
        });
      }

      if (isCurrentAdmin && input.role && input.role !== "admin") {
        return res.status(400).json({
          message:
            "\uD604\uC7AC \uB85C\uADF8\uC778\uD55C \uAD00\uB9AC\uC790 \uACC4\uC815\uC740 \uAD00\uB9AC\uC790 \uC5ED\uD560\uC5D0\uC11C \uAC15\uB4F1\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.",
        });
      }

      const updatedUser = await storage.updateUserByAdmin(userId, input);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const usersList = await storage.getAdminUsers();
      const managedUser = usersList.find((user) => user.id === userId);
      if (!managedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(managedUser);
    } catch (err) {
      console.error(err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      if (err instanceof Error) {
        return res.status(400).json({ message: err.message });
      }
      res.status(500).json({ message: getErrorMessage(err) });
    }
  });

  app.get(api.admin.items.path, isAdmin, async (req, res) => {
    try {
      const itemList = await storage.getAdminItems({
        search:
          typeof req.query.search === "string" ? req.query.search : undefined,
        type:
          typeof req.query.type === "string"
            ? (req.query.type as "lost" | "found")
            : undefined,
      });
      res.json(itemList);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: getErrorMessage(err) });
    }
  });

  app.delete(api.admin.deleteItem.path, isAdmin, async (req, res) => {
    try {
      const itemId = positiveIdSchema.parse(req.params.id);
      const deleted = await storage.deleteItemByAdmin(itemId);
      if (!deleted) {
        return res.status(404).json({ message: "Item not found" });
      }

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      res.status(500).json({ message: getErrorMessage(err) });
    }
  });

  // --- Items API ---
  app.get(api.items.list.path, async (req, res) => {
    try {
      const filters = api.items.list.input.parse({
        type: typeof req.query.type === "string" ? req.query.type : undefined,
        search:
          typeof req.query.search === "string" ? req.query.search : undefined,
        category:
          typeof req.query.category === "string"
            ? req.query.category
            : undefined,
        color:
          typeof req.query.color === "string" ? req.query.color : undefined,
        location:
          typeof req.query.location === "string"
            ? req.query.location
            : undefined,
        source:
          typeof req.query.source === "string"
            ? req.query.source
            : undefined,
        latitude:
          typeof req.query.latitude === "string"
            ? req.query.latitude
            : undefined,
        longitude:
          typeof req.query.longitude === "string"
            ? req.query.longitude
            : undefined,
        radiusKm:
          typeof req.query.radiusKm === "string"
            ? req.query.radiusKm
            : undefined,
        dateRange:
          typeof req.query.dateRange === "string"
            ? req.query.dateRange
            : undefined,
        sort: typeof req.query.sort === "string" ? req.query.sort : undefined,
        page: typeof req.query.page === "string" ? req.query.page : undefined,
        limit: typeof req.query.limit === "string" ? req.query.limit : undefined,
      });
      const itemsList = await storage.getItems(filters);
      res.json(itemsList);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.items.mine.path, isAuthenticated, async (req, res) => {
    try {
      const filters = api.items.mine.input.parse({
        type: typeof req.query.type === "string" ? req.query.type : undefined,
        status:
          typeof req.query.status === "string" ? req.query.status : undefined,
      });

      const itemsList = await storage.getMyItems(req.user!.id, filters);
      res.json(itemsList);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.items.get.path, async (req, res) => {
    try {
      const item = await storage.getItem(Number(req.params.id));
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.items.create.path, async (req, res) => {
    console.log("[API] POST /api/items - 물건 등록 시작", req.body?.reportType);
    try {
      const input = api.items.create.input.parse(req.body);
      console.log(
        "[API] 물건 데이터 파싱 완료:",
        input.reportType,
        input.title
      );
      const normalizedInput = normalizeItemMetadata(input);
      const item = await storage.createItem({
        ...normalizedInput,
        userId: req.user?.id ?? null,
      });
      console.log(
        `[API] 물건 저장 완료 - ID: ${item.id}, type: ${item.reportType}`
      );

      let automaticMatchCount = 0;

      let itemEmbedding: number[] | undefined;
      if (item.status === "active") {
        try {
          itemEmbedding = await ensureItemEmbedding(item);
        } catch (embeddingError) {
          console.error("Failed to store item embedding:", embeddingError);
        }
      }

      if (
        item.reportType === "found" &&
        item.status === "active" &&
        itemEmbedding !== undefined
      ) {
        console.log(
          `[AutoMatch] 습득물 ${item.id} - 매칭 알림 큐 추가 및 실행`
        );
        queueAutomaticMatchNotificationsForFoundItem(item, itemEmbedding);
        try {
          automaticMatchCount = await findAutomaticMatchesForFoundItem(item);
          console.log(
            `[AutoMatch] 습득물 ${item.id} - ${automaticMatchCount}개 매칭 생성 완료`
          );
        } catch (matchError) {
          console.error(
            "Failed to create automatic matches for found item:",
            matchError
          );
        }
      } else if (item.reportType === "lost" && item.status === "active") {
        console.log(`[AutoMatch] 분실물 ${item.id} - 매칭 실행`);
        try {
          automaticMatchCount = await findAutomaticMatchesForLostItem(item);
          console.log(
            `[AutoMatch] 분실물 ${item.id} - ${automaticMatchCount}개 매칭 생성 완료`
          );
        } catch (matchError) {
          console.error(
            "Failed to create automatic matches for lost item:",
            matchError
          );
        }
      } else {
        console.log(
          `[AutoMatch] ${item.id} - 조건 불충족으로 매칭 스킵 (reportType: ${
            item.reportType
          }, status: ${item.status}, hasEmbedding: ${
            itemEmbedding !== undefined
          })`
        );
      }

      res.status(201).json({
        ...item,
        automaticMatchCount,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch(api.items.update.path, isAuthenticated, async (req, res) => {
    try {
      const itemId = positiveIdSchema.parse(req.params.id);
      const input = api.items.update.input.parse(req.body);
      const normalizedInput = normalizeItemMetadata(input);
      const item = await storage.updateOwnedItem(
        req.user!.id,
        itemId,
        normalizedInput
      );

      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      const shouldRefreshEmbedding =
        item.status === "active" &&
        (Object.keys(normalizedInput).some((field) =>
          embeddingRelevantFields.has(field)
        ) ||
          normalizedInput.status === "active");

      let itemEmbedding: number[] | undefined;
      if (shouldRefreshEmbedding) {
        try {
          itemEmbedding = await ensureItemEmbedding(item);
        } catch (embeddingError) {
          console.error("Failed to update item embedding:", embeddingError);
        }
      }

      const shouldRunAutomaticMatching =
        item.reportType === "found" &&
        item.status === "active" &&
        (Object.keys(normalizedInput).some(
          (field) =>
            embeddingRelevantFields.has(field) ||
            field === "imageUrl" ||
            field === "imageUrls"
        ) ||
          normalizedInput.status === "active");
      const canQueueAutomaticMatching =
        itemEmbedding !== undefined || !shouldRefreshEmbedding;

      if (shouldRunAutomaticMatching && canQueueAutomaticMatching) {
        queueAutomaticMatchNotificationsForFoundItem(item, itemEmbedding);
      }

      res.json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.items.delete.path, isAuthenticated, async (req, res) => {
    try {
      const itemId = positiveIdSchema.parse(req.params.id);
      const deleted = await storage.deleteOwnedItem(req.user!.id, itemId);

      if (!deleted) {
        return res.status(404).json({ message: "Item not found" });
      }

      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.matches.list.path, isAuthenticated, async (req, res) => {
    try {
      const matches = await storage.getMatchesForUser(req.user!.id);
      res.json(matches.map(mapMatchResponse));
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: getErrorMessage(err) });
    }
  });

  app.get(api.matches.getByItem.path, isAuthenticated, async (req, res) => {
    try {
      const itemId = Number(req.params.id);
      const item = await storage.getItem(itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      if (item.userId !== req.user!.id || item.reportType !== "lost") {
        return res.status(404).json({ message: "Match not found" });
      }

      const matches = await storage.getMatchesForItem(itemId, req.user!.id);
      res.json(matches.map(mapMatchResponse));
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: getErrorMessage(err) });
    }
  });

  app.patch(
    api.matches.updateStatus.path,
    isAuthenticated,
    async (req, res) => {
      try {
        const matchId = Number(req.params.id);
        const input = updateItemMatchStatusSchema.parse(req.body);
        const updatedMatch = await storage.updateItemMatchStatus(
          matchId,
          req.user!.id,
          input.status
        );

        if (!updatedMatch) {
          return res.status(404).json({ message: "Match not found" });
        }

        const matches = await storage.getMatchesForUser(req.user!.id);
        const hydratedMatch = matches.find(
          ({ match }) => match.id === updatedMatch.id
        );
        if (!hydratedMatch) {
          return res.status(404).json({ message: "Match not found" });
        }

        res.json(mapMatchResponse(hydratedMatch));
      } catch (err) {
        console.error(err);
        if (err instanceof z.ZodError) {
          return res.status(400).json({
            message: err.errors[0].message,
            field: err.errors[0].path.join("."),
          });
        }
        res.status(500).json({ message: getErrorMessage(err) });
      }
    }
  );

  app.get(api.notifications.list.path, isAuthenticated, async (req, res) => {
    try {
      const notifications = await storage.getMatchNotifications(req.user!.id);
      res.json(notifications);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: getErrorMessage(err) });
    }
  });

  app.post(
    api.notifications.markRead.path,
    isAuthenticated,
    async (req, res) => {
      try {
        const notificationId = positiveIdSchema.parse(req.params.id);
        const notification = await storage.markMatchNotificationAsRead(
          req.user!.id,
          notificationId
        );

        if (!notification) {
          return res.status(404).json({ message: "Notification not found" });
        }

        res.json(notification);
      } catch (err) {
        console.error(err);
        if (err instanceof z.ZodError) {
          return res.status(400).json({
            message: err.errors[0].message,
            field: err.errors[0].path.join("."),
          });
        }
        res.status(500).json({ message: getErrorMessage(err) });
      }
    }
  );

  // --- AI API ---
  app.post(api.ai.analyzeImage.path, async (req, res) => {
    try {
      const input = api.ai.analyzeImage.input.parse(req.body);

      const response = await getQwenClient().chat.completions.create({
        model: QWEN_VISION_MODEL,
        messages: [
          {
            role: "system",
            content:
              "너는 분실물 보관 시스템에서 습득물을 분류하는 AI 도우미다. 이미지를 분석해서 다음 메타데이터를 한국어로 추출해라: itemCategory, color, size, tags, description, requiresMasking(개인정보, 얼굴, 신분증, 카드 등이 포함되어 있는지 여부 boolean). description은 자연스러운 한국어 1~2문장으로 작성해라. 사진 속에 사람의 이름, 주민등록번호, 카드 번호, 상세 주소, 발급일자는 절대 출력하지 마라. 반드시 JSON 객체만 반환해라.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "이 이미지를 분석하고 메타데이터를 JSON 형식의 한국어로 반환해줘.",
              },
              { type: "image_url", image_url: { url: input.imageUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      });

      const content = getCompletionText(
        response,
        "Failed to get response from AI"
      );

      const rawResult = rawAnalyzeImageSchema.parse(JSON.parse(content));
      const normalizedResult = await normalizeAnalyzeImageMetadata(
        rawResult
      ).catch((normalizationError) => {
        console.error(
          "Failed to normalize image metadata:",
          normalizationError
        );
        return buildLocalAnalyzeImageResult(rawResult);
      });

      let finalImageBase64 = input.imageUrl;

      if (rawResult.requiresMasking === true) {
        console.log("🔒 [보안] 개인정보 감지! 마스킹 처리를 시작합니다.");
        const base64Data = input.imageUrl.replace(
          /^data:image\/\w+;base64,/,
          ""
        );
        const imageBuffer = Buffer.from(base64Data, "base64");

        finalImageBase64 = await maskSensitiveInfo(imageBuffer);
      } else {
        console.log("✅ [안전] 일반 사물입니다. 마스킹을 건너뜁니다.");
      }

      res.json({
        ...normalizedResult,
        maskedImage: finalImageBase64,
      });
    } catch (err) {
      console.error(err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      res.status(500).json({ message: getErrorMessage(err) });
    }
  });

  app.post(api.ai.searchSimilar.path, async (req, res) => {
    try {
      const input = api.ai.searchSimilar.input.parse(req.body);

      if (!input.prompt && !input.imageUrl) {
        return res
          .status(400)
          .json({ message: "Either prompt or imageUrl must be provided" });
      }

      const searchCoordinates = getSearchCoordinates(input);
      const searchLocation = input.location?.trim();
      const radiusKm =
        typeof input.radiusKm === "number" && Number.isFinite(input.radiusKm)
          ? input.radiusKm
          : undefined;
      const effectiveRadiusKm = searchCoordinates
        ? radiusKm ?? DEFAULT_AI_SEARCH_RADIUS_KM
        : undefined;
      await backfillItemEmbeddings("found");

      const queryParts: string[] = [];
      const trimmedPrompt = input.prompt?.trim();
      if (trimmedPrompt) {
        const promptValidationError = validateSearchPrompt(trimmedPrompt);
        if (promptValidationError && !input.imageUrl) {
          return res
            .status(400)
            .json({ message: promptValidationError, field: "prompt" });
        }

        if (!promptValidationError) {
          queryParts.push(trimmedPrompt);
        }
      }

      if (input.imageUrl) {
        const imageSearchText = await createImageSearchText(input.imageUrl);
        if (imageSearchText) {
          queryParts.push(imageSearchText);
        }
      }

      const queryText = queryParts.join("\n\n").trim();
      const queryEmbedding = await createEmbedding(queryText);
      const vectorMatches = await storage.searchItemsByEmbedding(
        "found",
        queryEmbedding,
        VECTOR_CANDIDATE_COUNT
      );

      const filteredVectorMatches: RankedVectorCandidate[] = vectorMatches
        .filter((result) => result.score >= MIN_VECTOR_MATCH_SCORE)
        .map((result) => {
          const itemLatitude = parseCoordinate(result.item.latitude);
          const itemLongitude = parseCoordinate(result.item.longitude);
          const distanceKm =
            searchCoordinates && itemLatitude !== null && itemLongitude !== null
              ? calculateDistanceKm(searchCoordinates, {
                  latitude: itemLatitude,
                  longitude: itemLongitude,
                })
              : null;

          return {
            ...result,
            distanceKm,
          };
        })
        .filter((result) => {
          if (
            searchLocation &&
            !itemMatchesLocationText(result.item, searchLocation)
          ) {
            return false;
          }

          if (searchCoordinates && effectiveRadiusKm !== undefined) {
            return (
              result.distanceKm !== null &&
              result.distanceKm <= effectiveRadiusKm
            );
          }

          return true;
        });

      if (filteredVectorMatches.length === 0) {
        return res.json([]);
      }

      const rerankedMatches = await rerankCandidates({
        prompt: input.prompt,
        imageUrl: input.imageUrl,
        queryText,
        candidates: filteredVectorMatches,
      });

      const vectorMatchById = new Map(
        filteredVectorMatches.map((candidate) => [candidate.item.id, candidate])
      );

      const searchResults = rerankedMatches
        .map((result) => {
          const vectorMatch = vectorMatchById.get(result.itemId);
          if (!vectorMatch) {
            return null;
          }

          const llmScore = Math.max(0, Math.min(1, result.score));
          const blendedScore = Number(
            (vectorMatch.score * 0.35 + llmScore * 0.65).toFixed(4)
          );

          return {
            item: vectorMatch.item,
            score: blendedScore,
            distanceKm: vectorMatch.distanceKm,
            reasoning: buildReasoningFromEvidence({
              queryText,
              item: vectorMatch.item,
              matchScore: blendedScore,
              distanceKm: vectorMatch.distanceKm,
              llmReasoning: result.reasoning,
            }),
          };
        })
        .filter(
          (
            result
          ): result is {
            item: VectorCandidate["item"];
            score: number;
            distanceKm: number | null;
            reasoning: string;
          } => Boolean(result) && (result?.score ?? 0) >= MIN_FINAL_MATCH_SCORE
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, FINAL_RESULT_COUNT);

      if (searchResults.length === 0) {
        const fallbackResults = filteredVectorMatches
          .filter((result) => result.score >= MIN_FALLBACK_MATCH_SCORE)
          .slice(0, FINAL_RESULT_COUNT)
          .map((result) => ({
            item: result.item,
            score: Math.max(0, Math.min(1, result.score)),
            distanceKm: result.distanceKm,
            reasoning: buildReasoningFromEvidence({
              queryText,
              item: result.item,
              matchScore: result.score,
              distanceKm: result.distanceKm,
            }),
          }));

        return res.json(fallbackResults);
      }

      res.json(searchResults);
    } catch (err) {
      console.error(err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      res.status(500).json({ message: getErrorMessage(err) });
    }
  });

  // --- FCM 토큰 등록 API ---
  app.post("/api/fcm/token", isAuthenticated, async (req, res) => {
    try {
      const { token } = req.body;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "FCM 토큰이 필요합니다" });
      }
      await db
        .update(users)
        .set({ fcmToken: token })
        .where(eq(users.id, req.user!.id));
      res.json({ message: "FCM 토큰이 등록되었습니다" });
    } catch (err) {
      console.error("[FCM] 토큰 등록 오류:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // --- Chat API ---
  app.post("/api/chat/rooms", isAuthenticated, async (req, res) => {
    try {
      const { itemId, receiverId } = req.body;
      const senderId = req.user!.id;

      if (!itemId || !receiverId) {
        return res
          .status(400)
          .json({ message: "itemId와 receiverId가 필요합니다" });
      }

      const existingRoom = await db.query.chatRooms.findFirst({
        where: and(
          eq(chatRooms.itemId, itemId),
          eq(chatRooms.senderId, senderId),
          eq(chatRooms.receiverId, receiverId)
        ),
      });

      if (existingRoom) {
        return res.json(existingRoom);
      }

      const [room] = await db
        .insert(chatRooms)
        .values({
          itemId,
          senderId,
          receiverId,
        })
        .returning();

      res.status(201).json(room);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: getErrorMessage(err) });
    }
  });

  app.get("/api/chat/rooms", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;

      const rooms = await db.query.chatRooms.findMany({
        where: or(
          eq(chatRooms.senderId, userId),
          eq(chatRooms.receiverId, userId)
        ),
        with: {
          item: {
            columns: {
              id: true,
              title: true,
              reportType: true,
              imageUrl: true,
            },
          },
          sender: {
            columns: { id: true, username: true, name: true },
          },
          receiver: {
            columns: { id: true, username: true, name: true },
          },
        },
        orderBy: desc(chatRooms.updatedAt),
      });

      const roomsWithUnread = await Promise.all(
        rooms.map(async (room) => {
          const unreadMessage = await db.query.chatMessages.findFirst({
            where: and(
              eq(chatMessages.roomId, room.id),
              ne(chatMessages.senderId, userId),
              or(eq(chatMessages.isRead, 0), isNull(chatMessages.isRead))
            ),
          });

          const latestMessage = await db.query.chatMessages.findFirst({
            columns: {
              content: true,
              senderId: true,
              createdAt: true,
            },
            where: eq(chatMessages.roomId, room.id),
            orderBy: (_messages, { desc }) => [
              desc(chatMessages.createdAt),
              desc(chatMessages.id),
            ],
          });

          const rawOtherUser =
            room.senderId === userId ? room.receiver : room.sender;

          const otherUser = {
            ...rawOtherUser,
            nickname:
              rawOtherUser?.name ?? rawOtherUser?.username ?? "알 수 없음",
          };

          return {
            ...room,
            otherUser,
            hasUnread: Boolean(unreadMessage),
            latestMessage: latestMessage
              ? {
                  content: latestMessage.content,
                  senderId: latestMessage.senderId,
                  createdAt: latestMessage.createdAt,
                }
              : null,
          };
        })
      );

      res.json(roomsWithUnread);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: getErrorMessage(err) });
    }
  });

  app.get("/api/chat/rooms/:id/messages", isAuthenticated, async (req, res) => {
    try {
      const roomId = Number(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
      );
      const userId = req.user!.id;

      const room = await db.query.chatRooms.findFirst({
        where: eq(chatRooms.id, roomId),
      });

      if (!room || (room.senderId !== userId && room.receiverId !== userId)) {
        return res.status(403).json({ message: "접근 권한이 없습니다" });
      }

      await db
        .update(chatMessages)
        .set({ isRead: 1 })
        .where(
          and(
            eq(chatMessages.roomId, roomId),
            ne(chatMessages.senderId, userId),
            or(eq(chatMessages.isRead, 0), isNull(chatMessages.isRead))
          )
        );

      const messages = await db.query.chatMessages.findMany({
        where: eq(chatMessages.roomId, roomId),
        with: {
          sender: {
            columns: { id: true, username: true, name: true },
          },
        },
        orderBy: asc(chatMessages.createdAt),
      });

      res.json(messages);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: getErrorMessage(err) });
    }
  });

  app.post(
    "/api/chat/rooms/:id/messages",
    isAuthenticated,
    async (req, res) => {
      try {
        const roomId = Number(
          Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
        );
        const { content } = req.body;
        const senderId = req.user!.id;

        if (!content || content.trim() === "") {
          return res.status(400).json({ message: "메시지 내용이 필요합니다" });
        }

        const room = await db.query.chatRooms.findFirst({
          where: eq(chatRooms.id, roomId),
        });

        if (
          !room ||
          (room.senderId !== senderId && room.receiverId !== senderId)
        ) {
          return res.status(403).json({ message: "접근 권한이 없습니다" });
        }

        const [message] = await db
          .insert(chatMessages)
          .values({
            roomId,
            senderId,
            content: content.trim(),
            isRead: 0,
          })
          .returning();

        await db
          .update(chatRooms)
          .set({
            updatedAt: new Date(),
          })
          .where(eq(chatRooms.id, roomId));

        const receiverId =
          room.senderId === senderId ? room.receiverId : room.senderId;
        const [receiver, sender] = await Promise.all([
          db.query.users.findFirst({ where: eq(users.id, receiverId) }),
          db.query.users.findFirst({ where: eq(users.id, senderId) }),
        ]);
        if (receiver?.fcmToken) {
          const senderName = sender?.name ?? sender?.username ?? "누군가";
          void sendFcmNotification({
            fcmToken: receiver.fcmToken,
            title: `${senderName}님의 새 메시지`,
            body:
              content.trim().length > 50
                ? content.trim().slice(0, 50) + "..."
                : content.trim(),
            data: { roomId: String(roomId) },
          });
        }

        res.status(201).json(message);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: getErrorMessage(err) });
      }
    }
  );

  // --- Lost112 (경찰청 습득물) 수집 API ---
  app.post(api.lost112.sync.path, isAdmin, async (req, res) => {
    try {
      const apiKey = process.env.LOST112_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          message:
            "Lost112 API 키가 설정되지 않았습니다. .env에 LOST112_API_KEY를 추가해 주세요.",
        });
      }

      const input = api.lost112.sync.input.parse(req.body ?? {}) ?? {};
      const result = await runLost112Sync({
        apiKey,
        category: input.category,
        region: input.region,
        startDate: input.startDate,
        endDate: input.endDate,
        page: input.page,
        numOfRows: input.numOfRows,
        maxPages: input.maxPages,
      });

      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }

      console.error("[Lost112 Sync] 오류:", err);
      res.status(500).json({ message: getErrorMessage(err) });
    }
  });

  app.get(api.lost112.latestSyncRun.path, isAdmin, async (_req, res) => {
    try {
      const [latestRun] = await db
        .select()
        .from(lost112SyncRuns)
        .orderBy(desc(lost112SyncRuns.startedAt))
        .limit(1);

      res.json(latestRun ?? null);
    } catch (err) {
      console.error("[Lost112 Sync Latest] 오류:", err);
      res.status(500).json({ message: getErrorMessage(err) });
    }
  });

  app.get(api.lost112.activeSyncRuns.path, isAdmin, async (_req, res) => {
    try {
      res.json(getActiveLost112SyncRuns());
    } catch (err) {
      console.error("[Lost112 Sync Active] 오류:", err);
      res.status(500).json({ message: getErrorMessage(err) });
    }
  });

  app.post(api.lost112.reprocessExisting.path, isAdmin, async (req, res) => {
    try {
      const input =
        api.lost112.reprocessExisting.input.parse(req.body ?? {}) ?? {};

      if (input.onlyMissingLocation !== false && !KAKAO_REST_API_KEY) {
        return res.status(503).json({
          message:
            "Kakao REST API 키가 설정되지 않았습니다. .env에 KAKAO_REST_API_KEY를 추가해 주세요.",
        });
      }

      const result = await reprocessExistingLost112Items({
        limit: input.limit,
        offset: input.offset,
        onlyMissingLocation: input.onlyMissingLocation,
        onlyMissingEmbedding: input.onlyMissingEmbedding,
      });

      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }

      console.error("[Lost112 Reprocess Existing] 오류:", err);
      res.status(500).json({ message: getErrorMessage(err) });
    }
  });

  startLost112SyncScheduler();

  return httpServer;
}
