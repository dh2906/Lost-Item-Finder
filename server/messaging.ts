/**
 * 앱 내 1:1 메시지 스토리지 레이어
 */
import { db } from "./db";
import { conversations, messages } from "@shared/schema";
import { eq, and, or, desc, sql } from "drizzle-orm";

export async function getOrCreateConversation(
  itemId: number,
  requesterId: number,
  ownerId: number
) {
  // 이미 존재하는 콘버세이션 찾기
  const [existing] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.itemId, itemId),
        or(
          and(eq(conversations.participantA, requesterId), eq(conversations.participantB, ownerId)),
          and(eq(conversations.participantA, ownerId), eq(conversations.participantB, requesterId))
        )
      )
    )
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(conversations)
    .values({ itemId, participantA: requesterId, participantB: ownerId })
    .returning();

  return created;
}

export async function getConversationsByUser(userId: number) {
  return await db
    .select()
    .from(conversations)
    .where(
      or(
        eq(conversations.participantA, userId),
        eq(conversations.participantB, userId)
      )
    )
    .orderBy(desc(conversations.lastMessageAt));
}

export async function getMessagesByConversation(conversationId: number) {
  return await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);
}

export async function sendMessage(
  conversationId: number,
  senderId: number,
  content: string
) {
  const [msg] = await db
    .insert(messages)
    .values({ conversationId, senderId, content })
    .returning();

  // lastMessageAt 구데이트
  await db
    .update(conversations)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversations.id, conversationId));

  return msg;
}

export async function markMessagesRead(conversationId: number, userId: number) {
  await db
    .update(messages)
    .set({ read: true })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        sql`${messages.senderId} != ${userId}`
      )
    );
}

export async function getUnreadCount(userId: number): Promise<number> {
  const rows = await db
    .select({ conversationId: messages.conversationId })
    .from(messages)
    .innerJoin(
      conversations,
      or(
        eq(conversations.participantA, userId),
        eq(conversations.participantB, userId)
      )
    )
    .where(and(eq(messages.read, false), sql`${messages.senderId} != ${userId}`));

  return rows.length;
}
