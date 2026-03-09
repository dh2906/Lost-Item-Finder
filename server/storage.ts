import { items, itemEmbeddings, type Item, type InsertItem } from "@shared/schema";
import { db } from "./db";
import { eq, desc, ilike, and, isNull, cosineDistance, sql } from "drizzle-orm";

export interface IStorage {
  getItems(type?: "lost" | "found", search?: string): Promise<Item[]>;
  getItem(id: number): Promise<Item | undefined>;
  createItem(item: InsertItem): Promise<Item>;
  upsertItemEmbedding(itemId: number, content: string, embedding: number[]): Promise<void>;
  getFoundItemsWithoutEmbeddings(): Promise<Item[]>;
  searchFoundItemsByEmbedding(embedding: number[], limit?: number): Promise<Array<{ item: Item; score: number }>>;
}

export class DatabaseStorage implements IStorage {
  async getItems(type?: "lost" | "found", search?: string): Promise<Item[]> {
    let conditions = [];
    if (type) conditions.push(eq(items.reportType, type));
    if (search) conditions.push(ilike(items.title, `%${search}%`));
    
    return await db.select().from(items)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(items.date));
  }

  async getItem(id: number): Promise<Item | undefined> {
    const [item] = await db.select().from(items).where(eq(items.id, id));
    return item;
  }

  async createItem(insertItem: InsertItem): Promise<Item> {
    const [item] = await db.insert(items).values(insertItem).returning();
    return item;
  }

  async upsertItemEmbedding(itemId: number, content: string, embedding: number[]): Promise<void> {
    await db
      .insert(itemEmbeddings)
      .values({ itemId, content, embedding, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: itemEmbeddings.itemId,
        set: {
          content,
          embedding,
          updatedAt: new Date(),
        },
      });
  }

  async getFoundItemsWithoutEmbeddings(): Promise<Item[]> {
    const rows = await db
      .select({ item: items })
      .from(items)
      .leftJoin(itemEmbeddings, eq(items.id, itemEmbeddings.itemId))
      .where(and(eq(items.reportType, "found"), isNull(itemEmbeddings.itemId)))
      .orderBy(desc(items.date));

    return rows.map((row) => row.item);
  }

  async searchFoundItemsByEmbedding(embedding: number[], limit = 12): Promise<Array<{ item: Item; score: number }>> {
    const distance = cosineDistance(itemEmbeddings.embedding, embedding);

    const rows = await db
      .select({
        item: items,
        distance,
      })
      .from(itemEmbeddings)
      .innerJoin(items, eq(itemEmbeddings.itemId, items.id))
      .where(eq(items.reportType, "found"))
      .orderBy(distance)
      .limit(limit);

    return rows.map((row) => ({
      item: row.item,
      score: Math.max(0, 1 - Number(row.distance ?? 1)),
    }));
  }
}

export const storage = new DatabaseStorage();
