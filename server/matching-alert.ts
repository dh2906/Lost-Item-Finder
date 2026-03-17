/**
 * 자동 매칭 알림 시스템
 *
 * 동작 원리:
 *  1. 해이  습득물이 등록되면 기존 분실물들과 벡터 유사도 일괄 비교
 *  2. 임계값(AUTO_MATCH_THRESHOLD) 이상이면 DB에 알림 기록을 저장
 *  3. 이메일 / 앱 내 알림(TODO: 성시데 연동)으로 분실자에게 알림
 *
 * 현재 상태: 제단에 DB 테이블 + 콘솔 로개만 구현 (이메일 연동은 TODO)
 */

import { db } from "./db";
import { pgTable, serial, integer, real, timestamp, text, boolean } from "drizzle-orm/pg-core";
import { eq, and, desc } from "drizzle-orm";
import { items } from "@shared/schema";
import type { Item } from "@shared/schema";

// ---------------------------------------------------------------------------
// Schema (alert_matches 테이블)
// ---------------------------------------------------------------------------
export const alertMatches = pgTable("alert_matches", {
  id: serial("id").primaryKey(),
  lostItemId: integer("lost_item_id").notNull(),
  foundItemId: integer("found_item_id").notNull(),
  score: real("score").notNull(),
  notified: boolean("notified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  notifiedAt: timestamp("notified_at"),
  notifyMethod: text("notify_method"),   // 'email' | 'in-app' | null
});

export const AUTO_MATCH_THRESHOLD = Number(
  process.env.AUTO_MATCH_THRESHOLD ?? 0.55
);

// ---------------------------------------------------------------------------
// Core: 습득물 등록 시 이 함수 실행
// ---------------------------------------------------------------------------
export async function runAutoMatchForFoundItem(
  foundItem: Item,
  queryEmbedding: number[],
  searchFoundItemsByEmbedding: (emb: number[], limit: number) => Promise<Array<{ item: Item; score: number }>>
): Promise<void> {
  try {
    // 분실물 목록 가져오기 (active 상태)
    const lostItems = await db
      .select()
      .from(items)
      .where(and(eq(items.reportType, "lost"), eq(items.status, "active")))
      .orderBy(desc(items.date))
      .limit(200);

    if (lostItems.length === 0) return;

    // 분실물의 임베딩은 없으므로 빠른 유사도는 습득물를 검색하여 역력으로 피드백
    // (vector: found -> lost 로 매칭)
    // 여기서는 score만 과기 임계값으로 필터 후 alert_matches에 저장
    // 실제 매칭은 found 임베딩 vs lost 임베딩 비교
    // 현재 분실물는 임베딩이 없으므로, 주제어 키워드 기반 유사도로 실헝
    for (const lostItem of lostItems) {
      // 이미 알림된 조합 스킵
      const existing = await db
        .select()
        .from(alertMatches)
        .where(
          and(
            eq(alertMatches.lostItemId, lostItem.id),
            eq(alertMatches.foundItemId, foundItem.id)
          )
        )
        .limit(1);

      if (existing.length > 0) continue;

      // 간단한 키워드 유사도 계산
      const score = computeKeywordSimilarity(lostItem, foundItem);

      if (score >= AUTO_MATCH_THRESHOLD) {
        await db.insert(alertMatches).values({
          lostItemId: lostItem.id,
          foundItemId: foundItem.id,
          score,
          notified: false,
        });

        console.log(
          `[AutoMatch] found(${foundItem.id}) <-> lost(${lostItem.id}) score=${score.toFixed(3)}`
        );

        // TODO: 이메일 / 앱 내 알림 발송
        // await sendMatchNotification(lostItem, foundItem, score);
      }
    }
  } catch (err) {
    console.error("[AutoMatch] Error:", err);
  }
}

// ---------------------------------------------------------------------------
// 임시 키워드 유사도 (pgvector 임베딩 없이 켈보)
// ---------------------------------------------------------------------------
function normalizeText(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\uac00-\ud7a3a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 2)
  );
}

function computeKeywordSimilarity(a: Item, b: Item): number {
  const textA = [a.title, a.description, a.itemCategory, a.color, a.tags?.join(" ")]
    .filter(Boolean)
    .join(" ");
  const textB = [b.title, b.description, b.itemCategory, b.color, b.tags?.join(" ")]
    .filter(Boolean)
    .join(" ");

  if (!textA || !textB) return 0;

  const setA = normalizeText(textA);
  const setB = normalizeText(textB);
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;

  return union === 0 ? 0 : intersection / union; // Jaccard
}

// ---------------------------------------------------------------------------
// 최근 매칭 알림 조회 (API 용)
// ---------------------------------------------------------------------------
export async function getRecentAlertMatches(lostItemId?: number) {
  const cond = lostItemId ? eq(alertMatches.lostItemId, lostItemId) : undefined;
  return await db
    .select()
    .from(alertMatches)
    .where(cond)
    .orderBy(desc(alertMatches.createdAt))
    .limit(50);
}
