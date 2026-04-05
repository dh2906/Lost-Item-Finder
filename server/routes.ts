import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { isAdmin, isAuthenticated } from "./auth";
import { maskSensitiveInfo } from "./lib/masking";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { normalizeItemImageUrls } from "@shared/item-images";
import { z } from "zod";
import OpenAI from "openai";
import { db } from "./db";
import { and, eq, ne, or, desc, asc, isNull } from "drizzle-orm";
import {
  chatRooms,
  chatMessages,
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
const OPENAI_EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
const VECTOR_CANDIDATE_COUNT = Number(process.env.VECTOR_CANDIDATE_COUNT ?? 20);
const FINAL_RESULT_COUNT = Number(process.env.FINAL_RESULT_COUNT ?? 12);
const AUTO_MATCH_RESULT_COUNT = Number(process.env.AUTO_MATCH_RESULT_COUNT ?? 5);
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
const AUTO_MATCH_MIN_VECTOR_SCORE = Number(process.env.AUTO_MATCH_MIN_VECTOR_SCORE ?? 0.3);
const AUTO_MATCH_MIN_KEYWORD_SCORE = Number(process.env.AUTO_MATCH_MIN_KEYWORD_SCORE ?? 0.12);
const AUTO_MATCH_MIN_CATEGORY_SCORE = Number(process.env.AUTO_MATCH_MIN_CATEGORY_SCORE ?? 0.2);
const AUTO_MATCH_MAX_RESULTS = Number(process.env.AUTO_MATCH_MAX_RESULTS ?? 12);

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
  response: { choices?: Array<{ message?: { content?: unknown; refusal?: unknown } }> },
  emptyContentErrorMessage: string
): string {
  const message = response.choices?.[0]?.message;
  const content = extractCompletionMessageContent(message?.content);
  if (content) {
    return content;
  }

  if (typeof message?.refusal === "string" && message.refusal.trim().length > 0) {
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

function formatCoordinateForEmbedding(value?: string | null): string | null {
  const parsed = parseCoordinate(value);
  if (parsed === null) {
    return null;
  }

  return parsed.toFixed(3);
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
  latitude?: string | null;
  longitude?: string | null;
}): string {
  const normalizedItem = normalizeItemMetadata(item);
  const coordinateSummary = [
    formatCoordinateForEmbedding(item.latitude),
    formatCoordinateForEmbedding(item.longitude),
  ].filter((value): value is string => Boolean(value));

  const sections = [
    normalizedItem.title ? `제목: ${normalizedItem.title}` : null,
    normalizedItem.itemCategory ? `카테고리: ${normalizedItem.itemCategory}` : null,
    normalizedItem.color ? `색상: ${normalizedItem.color}` : null,
    normalizedItem.size ? `크기: ${normalizedItem.size}` : null,
    normalizedItem.description ? `설명: ${normalizedItem.description}` : null,
    normalizedItem.location ? `위치: ${normalizedItem.location}` : null,
    coordinateSummary.length === 2
      ? `위치 좌표(근사): ${coordinateSummary.join(", ")}`
      : null,
    normalizedItem.tags?.length ? `태그: ${normalizedItem.tags.join(", ")}` : null,
  ].filter((value): value is string => Boolean(value));

  return sections.join("\n");
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
  ["핸드폰", "휴대폰", "스마트폰", "폰", "phone", "smartphone", "iphone", "galaxy"],
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
    group.some((token) => normalizedValue.includes(normalizeComparableText(token)))
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
    normalizedItem.location = normalizePlainText(item.location) as T["location"];
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

function hasTokenContainment(left?: string | null, right?: string | null): boolean {
  const normalizedLeft = normalizeComparableText(left);
  const normalizedRight = normalizeComparableText(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft);
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
    const matchedLeft = group.some((token) => normalizedLeft.includes(normalizeComparableText(token)));
    const matchedRight = group.some((token) => normalizedRight.includes(normalizeComparableText(token)));
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

  const scoreDirection = (sourceTokens: string[], candidateTokens: string[]) => {
    const total = sourceTokens.reduce((sum, sourceToken) => {
      const bestMatch = candidateTokens.reduce((best, candidateToken) => {
        return Math.max(best, calculateTokenSimilarity(sourceToken, candidateToken, groups));
      }, 0);
      return sum + bestMatch;
    }, 0);

    return total / sourceTokens.length;
  };

  return Number(
    ((scoreDirection(leftTokens, rightTokens) + scoreDirection(rightTokens, leftTokens)) / 2).toFixed(4)
  );
}

function calculateKeywordOverlapScore(source: Item, candidate: Item): number {
  const sourceKeywords = Array.from(new Set(
    extractQueryKeywords(getItemEvidenceText(source)).concat(
      (source.tags ?? []).map((tag) => normalizeComparableText(tag)).filter(Boolean)
    )
  ));
  const candidateKeywords = Array.from(new Set(
    extractQueryKeywords(getItemEvidenceText(candidate)).concat(
      (candidate.tags ?? [])
        .map((tag) => normalizeComparableText(tag))
        .filter(Boolean)
    )
  ));

  if (sourceKeywords.length === 0 || candidateKeywords.length === 0) {
    return 0;
  }

  return calculateTokenSetSimilarity(sourceKeywords, candidateKeywords, KEYWORD_SYNONYM_GROUPS);
}

function calculateLocationTextSimilarity(source: Item, candidate: Item): number {
  const normalizedSource = normalizeItemMetadata(source);
  const normalizedCandidate = normalizeItemMetadata(candidate);
  const sourceTokens = extractQueryKeywords(normalizedSource.location ?? "");
  const candidateTokens = extractQueryKeywords(normalizedCandidate.location ?? "");
  return calculateTokenSetSimilarity(sourceTokens, candidateTokens, LOCATION_SYNONYM_GROUPS);
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

function calculateMatchDistanceKm(source: Item, candidate: Item): number | null {
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
  const vectorScore = calculateCosineSimilarity(sourceEmbedding, candidateEmbedding);
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
type NormalizedAnalyzeImageResult = z.infer<typeof normalizedAnalyzeImageSchema>;

function buildLocalAnalyzeImageResult(
  rawResult: RawAnalyzeImageResult
): NormalizedAnalyzeImageResult {
  return normalizeItemMetadata({
    title: buildAnalyzedTitle(rawResult),
    itemCategory: rawResult.itemCategory?.trim() || "알 수 없음",
    color: rawResult.color?.trim() || "알 수 없음",
    size: rawResult.size?.trim() || "알 수 없음",
    tags: Array.isArray(rawResult.tags)
      ? rawResult.tags
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)
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
    .replace(/[()\[\]{}]/g, " ")
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

async function createEmbedding(
  text: string,
  signal?: AbortSignal
): Promise<number[]> {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    throw new Error("임베딩할 검색 텍스트가 없습니다");
  }

  abortIfNeeded(signal);

  const response = await openai.embeddings.create({
    model: OPENAI_EMBEDDING_MODEL,
    input: normalized,
  }, {
    signal,
  });

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

  const response = await getQwenClient().chat.completions.create({
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
  }, {
    signal,
  });

  const content = getCompletionText(response, "이미지 검색 텍스트 생성에 실패했습니다");

  const parsed = normalizeItemMetadata(JSON.parse(content));
  return buildItemSearchText({
    itemCategory: parsed.itemCategory,
    color: parsed.color,
    size: parsed.size,
    description: parsed.description,
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
  });
}

async function ensureItemEmbedding(item: {
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
}, signal?: AbortSignal): Promise<number[]> {
  const normalizedItem = normalizeItemMetadata(item);
  const content = buildItemSearchText(normalizedItem);
  const embedding = await createEmbedding(content, signal);
  await storage.upsertItemEmbedding(item.id, content, embedding);
  return embedding;
}

async function backfillItemEmbeddings(
  reportType: "lost" | "found",
  limit?: number,
  signal?: AbortSignal
): Promise<void> {
  const missingItems = await storage.getItemsWithoutEmbeddings(reportType, limit);

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

async function findAutomaticMatchesForFoundItem(foundItem: Item): Promise<number> {
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

  await Promise.all(matchesToPersist.map((match) => storage.upsertItemMatch(match)));

  return matchesToPersist.length;
}

async function findAutomaticMatchesForLostItem(lostItem: Item): Promise<number> {
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

  await Promise.all(matchesToPersist.map((match) => storage.upsertItemMatch(match)));

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
    imageUrl: qwen && foundItem.imageUrl ? foundItem.imageUrl : undefined,
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

      if (!vectorMatch.item.userId || vectorMatch.item.userId === foundItem.userId) {
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

  const response = await aiClient.chat.completions.create({
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
  }, {
    signal,
  });

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
        role: typeof req.query.role === "string" ? (req.query.role as "member" | "admin") : undefined,
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
        type: typeof req.query.type === "string" ? (req.query.type as "lost" | "found") : undefined,
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
      const type = req.query.type as "lost" | "found" | undefined;
      const search = req.query.search as string | undefined;
      const itemsList = await storage.getItems(type, search);
      res.json(itemsList);
    } catch (err) {
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
    try {
      const input = api.items.create.input.parse(req.body);
      const normalizedInput = normalizeItemMetadata(input);
      const item = await storage.createItem({
        ...normalizedInput,
        userId: req.user?.id ?? null,
      });

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
        queueAutomaticMatchNotificationsForFoundItem(item, itemEmbedding);
        try {
          automaticMatchCount = await findAutomaticMatchesForFoundItem(item);
        } catch (matchError) {
          console.error("Failed to create automatic matches for found item:", matchError);
        }
      } else if (item.reportType === "lost" && item.status === "active") {
        try {
          automaticMatchCount = await findAutomaticMatchesForLostItem(item);
        } catch (matchError) {
          console.error("Failed to create automatic matches for lost item:", matchError);
        }
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
        ) || normalizedInput.status === "active");

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

  app.patch(api.matches.updateStatus.path, isAuthenticated, async (req, res) => {
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
      const hydratedMatch = matches.find(({ match }) => match.id === updatedMatch.id);
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
  });

  app.get(api.notifications.list.path, isAuthenticated, async (req, res) => {
    try {
      const notifications = await storage.getMatchNotifications(req.user!.id);
      res.json(notifications);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: getErrorMessage(err) });
    }
  });

  app.post(api.notifications.markRead.path, isAuthenticated, async (req, res) => {
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
  });

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

      const content = getCompletionText(response, "Failed to get response from AI");

      const rawResult = rawAnalyzeImageSchema.parse(JSON.parse(content));
      const normalizedResult = await normalizeAnalyzeImageMetadata(rawResult).catch(
        (normalizationError) => {
          console.error(
            "Failed to normalize image metadata:",
            normalizationError
          );
          return buildLocalAnalyzeImageResult(rawResult);
        }
      );

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
      await db.update(users).set({ fcmToken: token }).where(eq(users.id, req.user!.id));
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
        return res.status(400).json({ message: "itemId와 receiverId가 필요합니다" });
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

      const [room] = await db.insert(chatRooms).values({
        itemId,
        senderId,
        receiverId,
      }).returning();

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
          item: true,
          sender: {
            columns: { id: true, username: true, name: true }
          },
          receiver: {
            columns: { id: true, username: true, name: true }
          }
        },
        orderBy: desc(chatRooms.updatedAt),
      });

      const roomsWithUnread = await Promise.all(
        rooms.map(async (room) => {
          const unreadMessage = await db.query.chatMessages.findFirst({
            where: and(
              eq(chatMessages.roomId, room.id),
              ne(chatMessages.senderId, userId),
              or(
                eq(chatMessages.isRead, 0),
                isNull(chatMessages.isRead)
              )
            ),
          });

          const latestMessage = await db.query.chatMessages.findFirst({
            columns: {
              content: true,
              senderId: true,
              createdAt: true,
            },
            where: eq(chatMessages.roomId, room.id),
            orderBy: (_messages, { desc }) => [desc(chatMessages.createdAt), desc(chatMessages.id)],
          });

          return {
            ...room,
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
      const roomId = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      const userId = req.user!.id;

      const room = await db.query.chatRooms.findFirst({
        where: eq(chatRooms.id, roomId),
      });

      if (!room || (room.senderId !== userId && room.receiverId !== userId)) {
        return res.status(403).json({ message: "접근 권한이 없습니다" });
      }

      await db.update(chatMessages)
        .set({ isRead: 1 })
        .where(
          and(
            eq(chatMessages.roomId, roomId),
            ne(chatMessages.senderId, userId),
            or(
              eq(chatMessages.isRead, 0),
              isNull(chatMessages.isRead)
            )
          )
        );

      const messages = await db.query.chatMessages.findMany({
        where: eq(chatMessages.roomId, roomId),
        with: {
          sender: {
            columns: { id: true, username: true, name: true }
          }
        },
        orderBy: asc(chatMessages.createdAt),
      });

      res.json(messages);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: getErrorMessage(err) });
    }
  });

  app.post("/api/chat/rooms/:id/messages", isAuthenticated, async (req, res) => {
    try {
      const roomId = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      const { content } = req.body;
      const senderId = req.user!.id;

      if (!content || content.trim() === "") {
        return res.status(400).json({ message: "메시지 내용이 필요합니다" });
      }

      const room = await db.query.chatRooms.findFirst({
        where: eq(chatRooms.id, roomId),
      });

      if (!room || (room.senderId !== senderId && room.receiverId !== senderId)) {
        return res.status(403).json({ message: "접근 권한이 없습니다" });
      }

      const [message] = await db.insert(chatMessages).values({
        roomId,
        senderId,
        content: content.trim(),
        isRead: 0,
      }).returning();

      await db.update(chatRooms).set({
        updatedAt: new Date(),
      }).where(eq(chatRooms.id, roomId));

      // 수신자에게 FCM 알림 발송 (실패해도 메시지 전송은 성공 처리)
      const receiverId = room.senderId === senderId ? room.receiverId : room.senderId;
      const [receiver, sender] = await Promise.all([
        db.query.users.findFirst({ where: eq(users.id, receiverId) }),
        db.query.users.findFirst({ where: eq(users.id, senderId) }),
      ]);
      if (receiver?.fcmToken) {
        const senderName = sender?.name ?? sender?.username ?? "누군가";
        // sendFcmNotification은 내부적으로 에러를 처리하므로 void로 fire-and-forget
        void sendFcmNotification({
          fcmToken: receiver.fcmToken,
          title: `${senderName}님의 새 메시지`,
          body: content.trim().length > 50
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
  });

  return httpServer;
}
