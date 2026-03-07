import { items, type Item, type InsertItem } from "@shared/schema";
import { db } from "./db";
import { eq, desc, ilike, and } from "drizzle-orm";

export interface IStorage {
  getItems(type?: "lost" | "found", search?: string): Promise<Item[]>;
  getItem(id: number): Promise<Item | undefined>;
  createItem(item: InsertItem): Promise<Item>;
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
}

export const storage = new DatabaseStorage();
