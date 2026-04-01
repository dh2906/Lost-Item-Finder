import {
  favorites,
  items,
  itemEmbeddings,
  users,
  type Item,
  type InsertItem,
  type InsertUser,
  type User,
  type UserRole,
  type UserStatus,
} from "@shared/schema";
import { db } from "./db";
import { and, cosineDistance, desc, eq, ilike, isNull, sql } from "drizzle-orm";
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
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

export interface AdminUserRecord extends Omit<User, "password"> {
  itemCount: number;
}

export interface AdminItemRecord extends Item {
  ownerName: string | null;
  ownerUsername: string | null;
  statusLabel: string;
}

export interface AdminDashboardStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  adminUsers: number;
  totalItems: number;
  lostItems: number;
  foundItems: number;
  recentItems: number;
}

export interface AdminDashboardData {
  stats: AdminDashboardStats;
  recentUsers: AdminUserRecord[];
  recentItems: AdminItemRecord[];
}

function getConfiguredAdminUsernames(): string[] {
  return (process.env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function isConfiguredAdminUsername(username?: string | null): boolean {
  if (!username) {
    return false;
  }

  return getConfiguredAdminUsernames().includes(username.trim().toLowerCase());
}

function applyConfiguredAdminRole<T extends User>(user: T): T {
  if (isConfiguredAdminUsername(user.username)) {
    return {
      ...user,
      role: "admin",
    };
  }

  return user;
}

async function syncConfiguredAdminRoles(): Promise<void> {
  const configuredAdminUsernames = getConfiguredAdminUsernames();

  for (const username of configuredAdminUsernames) {
    await db
      .update(users)
      .set({ role: "admin" })
      .where(
        sql`lower(${users.username}) = ${username} and ${users.role} <> 'admin'`
      );
  }
}

async function ensureConfiguredAdminRole(user: User): Promise<User> {
  if (!isConfiguredAdminUsername(user.username) || user.role === "admin") {
    return user;
  }

  const [updatedUser] = await db
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.id, user.id))
    .returning();

  return updatedUser ?? user;
}

function sanitizeAdminUserRecord(user: User, itemCount: number): AdminUserRecord {
  const { password: _password, ...safeUser } = applyConfiguredAdminRole(user);
  return {
    ...safeUser,
    itemCount,
  };
}

export interface IStorage {
  getItems(type?: "lost" | "found", search?: string): Promise<Item[]>;
  getItem(id: number): Promise<Item | undefined>;
  createItem(item: InsertItem & { userId?: number | null }): Promise<Item>;
  upsertItemEmbedding(itemId: number, content: string, embedding: number[]): Promise<void>;
  getFoundItemsWithoutEmbeddings(): Promise<Item[]>;
  searchFoundItemsByEmbedding(
    embedding: number[],
    limit?: number
  ): Promise<Array<{ item: Item; score: number }>>;

  getFavoriteItems(userId: number): Promise<Array<{ item: Item; createdAt: Date }>>;
  addFavorite(userId: number, itemId: number): Promise<void>;
  removeFavorite(userId: number, itemId: number): Promise<boolean>;

  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  hashPassword(password: string): Promise<string>;
  verifyPassword(supplied: string, stored: string): Promise<boolean>;

  getAdminDashboardData(): Promise<AdminDashboardData>;
  getAdminUsers(filters?: {
    search?: string;
    role?: UserRole;
    status?: UserStatus;
    limit?: number;
  }): Promise<AdminUserRecord[]>;
  updateUserByAdmin(
    userId: number,
    updates: {
      role?: UserRole;
      status?: UserStatus;
    }
  ): Promise<User | undefined>;
  getAdminItems(filters?: {
    search?: string;
    type?: "lost" | "found";
    limit?: number;
  }): Promise<AdminItemRecord[]>;
  deleteItemByAdmin(itemId: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getItems(type?: "lost" | "found", search?: string): Promise<Item[]> {
    const conditions = [];
    if (type) conditions.push(eq(items.reportType, type));
    if (search) conditions.push(ilike(items.title, `%${search}%`));

    return await db
      .select()
      .from(items)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(items.date));
  }

  async getItem(id: number): Promise<Item | undefined> {
    const [item] = await db.select().from(items).where(eq(items.id, id));
    return item;
  }

  async createItem(insertItem: InsertItem & { userId?: number | null }): Promise<Item> {
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

  async searchFoundItemsByEmbedding(
    embedding: number[],
    limit = 12
  ): Promise<Array<{ item: Item; score: number }>> {
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

  async getFavoriteItems(userId: number): Promise<Array<{ item: Item; createdAt: Date }>> {
    const rows = await db
      .select({
        item: items,
        createdAt: favorites.createdAt,
      })
      .from(favorites)
      .innerJoin(items, eq(favorites.itemId, items.id))
      .where(eq(favorites.userId, userId))
      .orderBy(desc(favorites.createdAt));

    return rows.map((row) => ({
      item: row.item,
      createdAt: row.createdAt,
    }));
  }

  async addFavorite(userId: number, itemId: number): Promise<void> {
    await db.insert(favorites).values({ userId, itemId }).onConflictDoNothing();
  }

  async removeFavorite(userId: number, itemId: number): Promise<boolean> {
    const deletedRows = await db
      .delete(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.itemId, itemId)))
      .returning({ id: favorites.id });

    return deletedRows.length > 0;
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (!user) {
      return undefined;
    }

    const syncedUser = await ensureConfiguredAdminRole(user);
    return applyConfiguredAdminRole(syncedUser);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    if (!user) {
      return undefined;
    }

    const syncedUser = await ensureConfiguredAdminRole(user);
    return applyConfiguredAdminRole(syncedUser);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await hashPassword(insertUser.password);
    const role: UserRole = isConfiguredAdminUsername(insertUser.username)
      ? "admin"
      : "member";

    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        password: hashedPassword,
        role,
        status: "active",
      })
      .returning();

    return applyConfiguredAdminRole(user);
  }

  async getAdminDashboardData(): Promise<AdminDashboardData> {
    await syncConfiguredAdminRoles();

    const [userStats, itemStats, recentUsers, recentItems] = await Promise.all([
      db
        .select({
          totalUsers: sql<number>`cast(count(*) as int)`,
          activeUsers: sql<number>`cast(count(*) filter (where ${users.status} = 'active') as int)`,
          suspendedUsers: sql<number>`cast(count(*) filter (where ${users.status} = 'suspended') as int)`,
          adminUsers: sql<number>`cast(count(*) filter (where ${users.role} = 'admin') as int)`,
        })
        .from(users),
      db
        .select({
          totalItems: sql<number>`cast(count(*) as int)`,
          lostItems: sql<number>`cast(count(*) filter (where ${items.reportType} = 'lost') as int)`,
          foundItems: sql<number>`cast(count(*) filter (where ${items.reportType} = 'found') as int)`,
          recentItems: sql<number>`cast(count(*) filter (where ${items.date} >= now() - interval '7 days') as int)`,
        })
        .from(items),
      this.getAdminUsers({ limit: 6 }),
      this.getAdminItems({ limit: 6 }),
    ]);

    return {
      stats: {
        totalUsers: userStats[0]?.totalUsers ?? 0,
        activeUsers: userStats[0]?.activeUsers ?? 0,
        suspendedUsers: userStats[0]?.suspendedUsers ?? 0,
        adminUsers: userStats[0]?.adminUsers ?? 0,
        totalItems: itemStats[0]?.totalItems ?? 0,
        lostItems: itemStats[0]?.lostItems ?? 0,
        foundItems: itemStats[0]?.foundItems ?? 0,
        recentItems: itemStats[0]?.recentItems ?? 0,
      },
      recentUsers,
      recentItems,
    };
  }

  async getAdminUsers(filters?: {
    search?: string;
    role?: UserRole;
    status?: UserStatus;
    limit?: number;
  }): Promise<AdminUserRecord[]> {
    await syncConfiguredAdminRoles();

    const conditions = [];

    if (filters?.search?.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      conditions.push(
        sql<boolean>`(${users.username} ilike ${searchTerm} or ${users.name} ilike ${searchTerm})`
      );
    }

    if (filters?.role) {
      conditions.push(eq(users.role, filters.role));
    }

    if (filters?.status) {
      conditions.push(eq(users.status, filters.status));
    }

    const baseQuery = db
      .select({
        user: users,
        itemCount: sql<number>`cast(count(${items.id}) as int)`,
      })
      .from(users)
      .leftJoin(items, eq(items.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(users.id)
      .orderBy(desc(users.createdAt));

    const rows =
      typeof filters?.limit === "number"
        ? await baseQuery.limit(filters.limit)
        : await baseQuery;

    return rows.map((row) =>
      sanitizeAdminUserRecord(row.user, Number(row.itemCount))
    );
  }

  async updateUserByAdmin(
    userId: number,
    updates: {
      role?: UserRole;
      status?: UserStatus;
    }
  ): Promise<User | undefined> {
    const [existingUser] = await db.select().from(users).where(eq(users.id, userId));

    if (!existingUser) {
      return undefined;
    }

    if (
      updates.role === "member" &&
      isConfiguredAdminUsername(existingUser.username)
    ) {
      throw new Error("Configured admin accounts cannot be demoted.");
    }

    const [updatedUser] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();

    return updatedUser ? applyConfiguredAdminRole(updatedUser) : undefined;
  }

  async getAdminItems(filters?: {
    search?: string;
    type?: "lost" | "found";
    limit?: number;
  }): Promise<AdminItemRecord[]> {
    const conditions = [];

    if (filters?.type) {
      conditions.push(eq(items.reportType, filters.type));
    }

    if (filters?.search?.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      conditions.push(
        sql<boolean>`(${items.title} ilike ${searchTerm} or ${items.description} ilike ${searchTerm} or ${items.location} ilike ${searchTerm})`
      );
    }

    const baseQuery = db
      .select({
        item: items,
        ownerName: users.name,
        ownerUsername: users.username,
      })
      .from(items)
      .leftJoin(users, eq(items.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(items.date));

    const rows =
      typeof filters?.limit === "number"
        ? await baseQuery.limit(filters.limit)
        : await baseQuery;

    return rows.map((row) => ({
      ...row.item,
      ownerName: row.ownerName ?? null,
      ownerUsername: row.ownerUsername ?? null,
      statusLabel: row.item.reportType === "lost" ? "분실 접수" : "습득 접수",
    }));
  }

  async deleteItemByAdmin(itemId: number): Promise<boolean> {
    const deletedRows = await db
      .delete(items)
      .where(eq(items.id, itemId))
      .returning({ id: items.id });

    return deletedRows.length > 0;
  }

  hashPassword = hashPassword;
  verifyPassword = verifyPassword;
}

export const storage = new DatabaseStorage();
