import {
  items,
  itemEmbeddings,
  itemMatches,
  users,
  type Item,
  type InsertItem,
  type InsertItemMatch,
  type ItemMatch,
  type ItemMatchStatus,
  type User,
  type InsertUser,
} from "@shared/schema";
import { db } from "./db";
import {
  eq,
  desc,
  ilike,
  and,
  isNull,
  cosineDistance,
  inArray,
  gte,
  lte,
  ne,
  or,
} from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function verifyPassword(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export interface ItemMatchWithItems {
  match: ItemMatch;
  lostItem: Item;
  foundItem: Item;
}

export interface IStorage {
  // Items
  getItems(type?: "lost" | "found", search?: string): Promise<Item[]>;
  getItem(id: number): Promise<Item | undefined>;
  createItem(item: InsertItem): Promise<Item>;
  updateItem(itemId: number, item: Partial<InsertItem>): Promise<Item | undefined>;
  upsertItemEmbedding(itemId: number, content: string, embedding: number[]): Promise<void>;
  getItemsWithoutEmbeddings(type?: "lost" | "found"): Promise<Item[]>;
  searchFoundItemsByEmbedding(embedding: number[], limit?: number): Promise<Array<{ item: Item; score: number }>>;
  getCandidateItemsForAutoMatch(sourceItem: Item, limit?: number): Promise<Item[]>;
  getItemEmbeddings(itemIds: number[]): Promise<Map<number, number[]>>;
  upsertItemMatch(match: InsertItemMatch): Promise<ItemMatch>;
  getMatchesForUser(userId: number): Promise<ItemMatchWithItems[]>;
  getMatchesForItem(itemId: number, userId: number): Promise<ItemMatchWithItems[]>;
  updateItemMatchStatus(matchId: number, userId: number, status: ItemMatchStatus): Promise<ItemMatch | undefined>;
  
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  hashPassword(password: string): Promise<string>;
  verifyPassword(supplied: string, stored: string): Promise<boolean>;
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

  async updateItem(itemId: number, item: Partial<InsertItem>): Promise<Item | undefined> {
    const [updatedItem] = await db
      .update(items)
      .set(item)
      .where(eq(items.id, itemId))
      .returning();

    return updatedItem;
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

  async getItemsWithoutEmbeddings(type?: "lost" | "found"): Promise<Item[]> {
    const conditions = [isNull(itemEmbeddings.itemId)];
    if (type) {
      conditions.push(eq(items.reportType, type));
    }

    const rows = await db
      .select({ item: items })
      .from(items)
      .leftJoin(itemEmbeddings, eq(items.id, itemEmbeddings.itemId))
      .where(and(...conditions))
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

  async getCandidateItemsForAutoMatch(sourceItem: Item, limit = 80): Promise<Item[]> {
    const targetReportType = sourceItem.reportType === "found" ? "lost" : "found";
    const conditions = [eq(items.reportType, targetReportType)];

    if (sourceItem.userId) {
      conditions.push(or(ne(items.userId, sourceItem.userId), isNull(items.userId))!);
    }

    if (sourceItem.date) {
      const windowStart = new Date(sourceItem.date);
      windowStart.setDate(windowStart.getDate() - 120);
      const windowEnd = new Date(sourceItem.date);
      windowEnd.setDate(windowEnd.getDate() + 120);
      conditions.push(gte(items.date, windowStart));
      conditions.push(lte(items.date, windowEnd));
    }

    return await db
      .select()
      .from(items)
      .where(and(...conditions))
      .orderBy(desc(items.date))
      .limit(limit);
  }

  async getItemEmbeddings(itemIds: number[]): Promise<Map<number, number[]>> {
    if (itemIds.length === 0) {
      return new Map();
    }

    const rows = await db
      .select({ itemId: itemEmbeddings.itemId, embedding: itemEmbeddings.embedding })
      .from(itemEmbeddings)
      .where(inArray(itemEmbeddings.itemId, itemIds));

    return new Map(
      rows.map((row) => [row.itemId, Array.isArray(row.embedding) ? row.embedding : []])
    );
  }

  async upsertItemMatch(match: InsertItemMatch): Promise<ItemMatch> {
    const [savedMatch] = await db
      .insert(itemMatches)
      .values({
        ...match,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [itemMatches.lostItemId, itemMatches.foundItemId],
        set: {
          score: match.score,
          matchReason: match.matchReason,
          updatedAt: new Date(),
        },
      })
      .returning();

    return savedMatch;
  }

  async getMatchesForUser(userId: number): Promise<ItemMatchWithItems[]> {
    const ownedLostItems = await db
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.userId, userId), eq(items.reportType, "lost")));

    const lostItemIds = ownedLostItems.map((item) => item.id);
    if (lostItemIds.length === 0) {
      return [];
    }

    const matches = await db
      .select()
      .from(itemMatches)
      .where(inArray(itemMatches.lostItemId, lostItemIds))
      .orderBy(desc(itemMatches.createdAt));

    if (matches.length === 0) {
      return [];
    }

    const relatedItemIds = Array.from(
      new Set(matches.flatMap((match) => [match.lostItemId, match.foundItemId]))
    );
    const relatedItems = await db
      .select()
      .from(items)
      .where(inArray(items.id, relatedItemIds));
    const itemsById = new Map(relatedItems.map((item) => [item.id, item]));

    return matches
      .map((match) => {
        const lostItem = itemsById.get(match.lostItemId);
        const foundItem = itemsById.get(match.foundItemId);

        if (!lostItem || !foundItem) {
          return null;
        }

        return {
          match,
          lostItem,
          foundItem,
        };
      })
      .filter((entry): entry is ItemMatchWithItems => Boolean(entry));
  }

  async getMatchesForItem(itemId: number, userId: number): Promise<ItemMatchWithItems[]> {
    const allMatches = await this.getMatchesForUser(userId);
    return allMatches.filter(
      ({ match }) => match.lostItemId === itemId || match.foundItemId === itemId
    );
  }

  async updateItemMatchStatus(
    matchId: number,
    userId: number,
    status: ItemMatchStatus
  ): Promise<ItemMatch | undefined> {
    const userMatches = await this.getMatchesForUser(userId);
    const targetMatch = userMatches.find(({ match }) => match.id === matchId)?.match;
    if (!targetMatch) {
      return undefined;
    }

    const [updatedMatch] = await db
      .update(itemMatches)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(itemMatches.id, matchId))
      .returning();

    return updatedMatch;
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await hashPassword(insertUser.password);
    const [user] = await db
      .insert(users)
      .values({ ...insertUser, password: hashedPassword })
      .returning();
    return user;
  }

  hashPassword = hashPassword;
  verifyPassword = verifyPassword;
}

export const storage = new DatabaseStorage();
