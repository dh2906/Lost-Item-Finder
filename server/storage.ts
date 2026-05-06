import {
  items,
  itemEmbeddings,
  itemClaimReports,
  itemMatches,
  matchNotifications,
  users,
  type Item,
  type ItemMatch,
  type ItemMatchStatus,
  type ItemStatus,
  type InsertItem,
  type InsertItemClaimReport,
  type InsertItemMatch,
  type InsertUser,
  type UpdateItem,
  type UpdateItemClaimReportStatus,
  type User,
  type UserRole,
  type UserStatus,
  type OAuthProvider,
  type ClaimReportStatus,
} from "@shared/schema";
import { db } from "./db";
import {
  and,
  asc,
  cosineDistance,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const DEFAULT_LOCATION_RADIUS_KM = 5;
const AUTO_MATCH_DATE_WINDOW_DAYS = Number(
  process.env.AUTO_MATCH_DATE_WINDOW_DAYS ?? 90
);

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

export interface AdminUserRecord extends Omit<User, "password"> {
  itemCount: number;
}

export interface AdminItemRecord extends Item {
  ownerName: string | null;
  ownerUsername: string | null;
  statusLabel: string;
}

export interface OAuthUserInput {
  provider: OAuthProvider;
  providerId: string;
  email?: string | null;
  name?: string | null;
  profileImageUrl?: string | null;
}

export interface AdminClaimReportRecord {
  id: number;
  reporterId: number;
  itemId: number | null;
  suspectedUserInfo: string | null;
  incidentSummary: string;
  evidence: string | null;
  contactInfo: string | null;
  status: ClaimReportStatus;
  adminNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  reporterName: string | null;
  reporterUsername: string | null;
  itemTitle: string | null;
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

export interface MatchNotificationRecord {
  id: number;
  userId: number;
  lostItemId: number;
  foundItemId: number;
  score: number;
  reasoning: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
  lostItem: Item;
  foundItem: Item;
}

export interface ExternalFoundItemInput {
  externalSource: string;
  externalId: string;
  externalUrl?: string | null;
  externalPayload?: Record<string, unknown> | null;
  externalPayloadHash?: string | null;
  title: string;
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
  latitude?: string | null;
  longitude?: string | null;
  date?: Date | null;
  contactInfo?: string | null;
}

function getConfiguredAdminUsernames(): string[] {
  return (process.env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function isConfiguredAdminIdentity(
  username?: string | null,
  email?: string | null
): boolean {
  const identities = [username, email]
    .map((value) => value?.trim().toLowerCase())
    .filter(Boolean);

  if (identities.length === 0) {
    return false;
  }

  const configuredAdmins = getConfiguredAdminUsernames();
  return identities.some((identity) => configuredAdmins.includes(identity!));
}

function applyConfiguredAdminRole<T extends User>(user: T): T {
  if (isConfiguredAdminIdentity(user.username, user.email)) {
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
        sql`(lower(${users.username}) = ${username} or lower(${users.email}) = ${username}) and ${users.role} <> 'admin'`
      );
  }
}

async function ensureConfiguredAdminRole(user: User): Promise<User> {
  if (!isConfiguredAdminIdentity(user.username, user.email) || user.role === "admin") {
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
  getItems(filters?: {
    type?: "lost" | "found";
    search?: string;
    category?: string;
    color?: string;
    location?: string;
    source?: "all" | "user" | "lost112";
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    dateRange?: "all" | "7d" | "30d" | "90d";
    sort?: "latest" | "oldest";
    page?: number;
    limit?: number;
  }): Promise<{
    items: Item[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  getMyItems(
    userId: number,
    filters?: { type?: "lost" | "found"; status?: ItemStatus }
  ): Promise<Item[]>;
  getItem(id: number): Promise<Item | undefined>;
  findRecentDuplicateUserItem(
    item: InsertItem & { userId?: number | null },
    since: Date
  ): Promise<Item | undefined>;
  createItem(item: InsertItem & { userId?: number | null }): Promise<Item>;
  upsertExternalFoundItem(item: ExternalFoundItemInput): Promise<{
    item: Item;
    created: boolean;
  }>;
  updateItem(itemId: number, item: Partial<InsertItem>): Promise<Item | undefined>;
  updateOwnedItem(
    userId: number,
    itemId: number,
    updates: UpdateItem
  ): Promise<Item | undefined>;
  deleteOwnedItem(userId: number, itemId: number): Promise<boolean>;
  upsertItemEmbedding(itemId: number, content: string, embedding: number[]): Promise<void>;
  getItemEmbedding(
    itemId: number
  ): Promise<{ content: string; embedding: number[] } | undefined>;
  getItemsWithoutEmbeddings(
    reportType?: "lost" | "found",
    limit?: number
  ): Promise<Item[]>;
  searchItemsByEmbedding(
    reportType: "lost" | "found",
    embedding: number[],
    limit?: number
  ): Promise<Array<{ item: Item; score: number }>>;
  searchItemsByEmbeddingWithinItemIds(
    reportType: "lost" | "found",
    embedding: number[],
    itemIds: number[],
    limit?: number
  ): Promise<Array<{ item: Item; score: number }>>;
  getItemsWithinRadius(
    reportType: "lost" | "found",
    latitude: number,
    longitude: number,
    radiusKm: number,
    limit?: number
  ): Promise<Array<{ item: Item; distanceKm: number }>>;
  searchFoundItemsByEmbedding(
    embedding: number[],
    limit?: number
  ): Promise<Array<{ item: Item; score: number }>>;
  getCandidateItemsForAutoMatch(sourceItem: Item, limit?: number): Promise<Item[]>;
  getItemEmbeddings(itemIds: number[]): Promise<Map<number, number[]>>;
  upsertItemMatch(match: InsertItemMatch): Promise<ItemMatch>;
  getMatchesForUser(userId: number): Promise<ItemMatchWithItems[]>;
  getMatchesForItem(itemId: number, userId: number): Promise<ItemMatchWithItems[]>;
  updateItemMatchStatus(
    matchId: number,
    userId: number,
    status: ItemMatchStatus
  ): Promise<ItemMatch | undefined>;
  upsertMatchNotification(input: {
    userId: number;
    lostItemId: number;
    foundItemId: number;
    score: number;
    reasoning: string;
  }): Promise<void>;
  getMatchNotifications(userId: number): Promise<MatchNotificationRecord[]>;
  markMatchNotificationAsRead(
    userId: number,
    notificationId: number
  ): Promise<MatchNotificationRecord | undefined>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByOAuth(provider: OAuthProvider, providerId: string): Promise<User | undefined>;
  upsertOAuthUser(input: OAuthUserInput): Promise<User>;
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
    page?: number;
    limit?: number;
  }): Promise<{
    items: AdminItemRecord[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  deleteItemByAdmin(itemId: number): Promise<boolean>;
  createClaimReport(
    reporterId: number,
    report: InsertItemClaimReport
  ): Promise<AdminClaimReportRecord>;
  getAdminClaimReports(filters?: {
    status?: ClaimReportStatus;
  }): Promise<AdminClaimReportRecord[]>;
  updateClaimReportByAdmin(
    reportId: number,
    updates: UpdateItemClaimReportStatus
  ): Promise<AdminClaimReportRecord | undefined>;
}

export class DatabaseStorage implements IStorage {
  private async hydrateMatchNotifications(
    rows: Array<typeof matchNotifications.$inferSelect>
  ): Promise<MatchNotificationRecord[]> {
    if (rows.length === 0) {
      return [];
    }

    const itemIds = Array.from(
      new Set(rows.flatMap((row) => [row.lostItemId, row.foundItemId]))
    );
    const matchedItems = await db
      .select()
      .from(items)
      .where(inArray(items.id, itemIds));
    const itemById = new Map(matchedItems.map((item) => [item.id, item]));

    return rows.flatMap((row) => {
      const lostItem = itemById.get(row.lostItemId);
      const foundItem = itemById.get(row.foundItemId);

      if (!lostItem || !foundItem) {
        return [];
      }

      return [
        {
          ...row,
          score: Number(row.score),
          lostItem,
          foundItem,
        },
      ];
    });
  }

  async getItems(filters?: {
    type?: "lost" | "found";
    search?: string;
    category?: string;
    color?: string;
    location?: string;
    source?: "all" | "user" | "lost112";
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    dateRange?: "all" | "7d" | "30d" | "90d";
    sort?: "latest" | "oldest";
    page?: number;
    limit?: number;
  }): Promise<{
    items: Item[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const conditions = [eq(items.status, "active" as const)];
    const search = filters?.search?.trim();
    const category = filters?.category?.trim();
    const color = filters?.color?.trim();
    const location = filters?.location?.trim();
    const source = filters?.source ?? "all";
    const sort = filters?.sort ?? "latest";
    const page = Math.max(1, filters?.page ?? 1);
    const limit = Math.min(Math.max(1, filters?.limit ?? 24), 60);
    const hasCoordinates =
      typeof filters?.latitude === "number" && typeof filters?.longitude === "number";
    const radiusKm = filters?.radiusKm ?? DEFAULT_LOCATION_RADIUS_KM;
    const latitudeValue = sql<number | null>`
      case
        when ${items.latitude} ~ '^-?[0-9]+(\.[0-9]+)?$'
          then ${items.latitude}::double precision
        else null
      end
    `;
    const longitudeValue = sql<number | null>`
      case
        when ${items.longitude} ~ '^-?[0-9]+(\.[0-9]+)?$'
          then ${items.longitude}::double precision
        else null
      end
    `;
    const distanceKm = hasCoordinates
      ? sql<number>`
          6371 * acos(
            least(
              1,
              greatest(
                -1,
                cos(radians(${filters.latitude})) *
                cos(radians(${latitudeValue})) *
                cos(radians(${longitudeValue}) - radians(${filters.longitude})) +
                sin(radians(${filters.latitude})) *
                sin(radians(${latitudeValue}))
              )
            )
          )
        `
      : null;

    if (filters?.type) {
      conditions.push(eq(items.reportType, filters.type));
    }

    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          ilike(items.title, searchPattern),
          ilike(items.description, searchPattern),
          ilike(items.itemCategory, searchPattern),
          ilike(items.color, searchPattern),
          ilike(items.location, searchPattern),
          ilike(items.region1, searchPattern),
          ilike(items.region2, searchPattern),
          ilike(items.region3, searchPattern),
          ilike(items.address, searchPattern),
          ilike(items.placeName, searchPattern)
        )!
      );
    }

    if (category) {
      conditions.push(ilike(items.itemCategory, `%${category}%`));
    }

    if (color) {
      conditions.push(ilike(items.color, `%${color}%`));
    }

    if (location) {
      const locationPattern = `%${location}%`;
      conditions.push(
        or(
          ilike(items.location, locationPattern),
          ilike(items.region1, locationPattern),
          ilike(items.region2, locationPattern),
          ilike(items.region3, locationPattern),
          ilike(items.address, locationPattern),
          ilike(items.placeName, locationPattern)
        )!
      );
    }

    if (source === "lost112") {
      conditions.push(eq(items.externalSource, "lost112"));
    }

    if (source === "user") {
      conditions.push(isNull(items.externalSource));
    }

    if (distanceKm) {
      conditions.push(sql<boolean>`${latitudeValue} is not null`);
      conditions.push(sql<boolean>`${longitudeValue} is not null`);
      conditions.push(sql<boolean>`${distanceKm} <= ${radiusKm}`);
    }

    if (filters?.dateRange && filters.dateRange !== "all") {
      const daysByRange = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
      } as const;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysByRange[filters.dateRange]);
      conditions.push(gte(items.date, startDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const [{ totalCount }] = await db
      .select({ totalCount: sql<number>`count(*)::int` })
      .from(items)
      .where(whereClause);
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const currentPage = Math.min(page, totalPages);
    const currentOffset = (currentPage - 1) * limit;
    const pageItems = await db
      .select()
      .from(items)
      .where(whereClause)
      .orderBy(
        ...(distanceKm ? [asc(distanceKm)] : []),
        sort === "oldest" ? asc(items.date) : desc(items.date),
        sort === "oldest" ? asc(items.id) : desc(items.id)
      )
      .limit(limit)
      .offset(currentOffset);

    return {
      items: pageItems,
      totalCount,
      page: currentPage,
      limit,
      totalPages,
    };
  }

  async getMyItems(
    userId: number,
    filters?: { type?: "lost" | "found"; status?: ItemStatus }
  ): Promise<Item[]> {
    const conditions = [eq(items.userId, userId)];

    if (filters?.type) {
      conditions.push(eq(items.reportType, filters.type));
    }

    if (filters?.status) {
      conditions.push(eq(items.status, filters.status));
    }

    return await db
      .select()
      .from(items)
      .where(and(...conditions))
      .orderBy(desc(items.date));
  }

  async getItem(id: number): Promise<Item | undefined> {
    const [item] = await db.select().from(items).where(eq(items.id, id));
    return item;
  }

  async findRecentDuplicateUserItem(
    item: InsertItem & { userId?: number | null },
    since: Date
  ): Promise<Item | undefined> {
    const conditions = [
      eq(items.reportType, item.reportType),
      eq(items.title, item.title),
      gte(items.date, since),
    ];

    if (item.userId) {
      conditions.push(eq(items.userId, item.userId));
    } else {
      conditions.push(isNull(items.userId));
    }

    if (item.description) {
      conditions.push(eq(items.description, item.description));
    } else {
      conditions.push(isNull(items.description));
    }

    if (item.imageUrl) {
      conditions.push(eq(items.imageUrl, item.imageUrl));
    } else {
      conditions.push(isNull(items.imageUrl));
    }

    const [duplicateItem] = await db
      .select()
      .from(items)
      .where(and(...conditions))
      .orderBy(desc(items.id))
      .limit(1);

    return duplicateItem;
  }

  async createItem(insertItem: InsertItem & { userId?: number | null }): Promise<Item> {
    const [item] = await db.insert(items).values(insertItem).returning();
    return item;
  }

  async upsertExternalFoundItem(input: ExternalFoundItemInput): Promise<{
    item: Item;
    created: boolean;
  }> {
    const values = {
      userId: null,
      reportType: "found",
      status: "active",
      title: input.title,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      imageUrls: input.imageUrls ?? [],
      itemCategory: input.itemCategory ?? null,
      color: input.color ?? null,
      size: input.size ?? null,
      tags: input.tags ?? [],
      location: input.location ?? null,
      region1: input.region1 ?? null,
      region2: input.region2 ?? null,
      region3: input.region3 ?? null,
      address: input.address ?? null,
      placeName: input.placeName ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      // date가 없으면 null로 저장 — 현재 시각으로 대체하면 실제 습득일을 왜곡함
      date: input.date ?? null,
      contactInfo: input.contactInfo ?? null,
      externalSource: input.externalSource,
      externalId: input.externalId,
      externalUrl: input.externalUrl ?? null,
      externalPayload: input.externalPayload ?? null,
      externalPayloadHash: input.externalPayloadHash ?? null,
    } satisfies typeof items.$inferInsert;

    const [savedItem] = await db
      .insert(items)
      .values(values)
      .onConflictDoUpdate({
        target: [items.externalSource, items.externalId],
        set: values,
      })
      .returning({
        id: items.id,
        userId: items.userId,
        reportType: items.reportType,
        status: items.status,
        title: items.title,
        description: items.description,
        imageUrl: items.imageUrl,
        imageUrls: items.imageUrls,
        itemCategory: items.itemCategory,
        color: items.color,
        size: items.size,
        tags: items.tags,
        location: items.location,
        region1: items.region1,
        region2: items.region2,
        region3: items.region3,
        address: items.address,
        placeName: items.placeName,
        latitude: items.latitude,
        longitude: items.longitude,
        date: items.date,
        contactInfo: items.contactInfo,
        externalSource: items.externalSource,
        externalId: items.externalId,
        externalUrl: items.externalUrl,
        externalPayload: items.externalPayload,
        externalPayloadHash: items.externalPayloadHash,
        created: sql<boolean>`xmax = 0`,
      });

    const { created, ...item } = savedItem;

    return {
      item,
      created: Boolean(created),
    };
  }

  async updateItem(
    itemId: number,
    item: Partial<InsertItem>
  ): Promise<Item | undefined> {
    const [updatedItem] = await db
      .update(items)
      .set(item)
      .where(eq(items.id, itemId))
      .returning();

    return updatedItem;
  }

  async updateOwnedItem(
    userId: number,
    itemId: number,
    updates: UpdateItem
  ): Promise<Item | undefined> {
    const [updatedItem] = await db
      .update(items)
      .set(updates)
      .where(and(eq(items.id, itemId), eq(items.userId, userId)))
      .returning();

    return updatedItem;
  }

  async deleteOwnedItem(userId: number, itemId: number): Promise<boolean> {
    const deletedRows = await db
      .delete(items)
      .where(and(eq(items.id, itemId), eq(items.userId, userId)))
      .returning({ id: items.id });

    return deletedRows.length > 0;
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

  async getItemEmbedding(
    itemId: number
  ): Promise<{ content: string; embedding: number[] } | undefined> {
    const [row] = await db
      .select({
        content: itemEmbeddings.content,
        embedding: itemEmbeddings.embedding,
      })
      .from(itemEmbeddings)
      .where(eq(itemEmbeddings.itemId, itemId));

    return row;
  }

  async getItemsWithoutEmbeddings(
    reportType?: "lost" | "found",
    limit?: number
  ): Promise<Item[]> {
    const conditions = [eq(items.status, "active"), isNull(itemEmbeddings.itemId)];
    if (reportType) {
      conditions.push(eq(items.reportType, reportType));
    }

    const baseQuery = db
      .select({ item: items })
      .from(items)
      .leftJoin(itemEmbeddings, eq(items.id, itemEmbeddings.itemId))
      .where(and(...conditions))
      .orderBy(desc(items.date));

    const rows =
      typeof limit === "number" ? await baseQuery.limit(limit) : await baseQuery;

    return rows.map((row) => row.item);
  }

  async searchItemsByEmbedding(
    reportType: "lost" | "found",
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
      .where(and(eq(items.reportType, reportType), eq(items.status, "active")))
      .orderBy(distance)
      .limit(limit);

    return rows.map((row) => ({
      item: row.item,
      score: Math.max(0, 1 - Number(row.distance ?? 1)),
    }));
  }

  async searchItemsByEmbeddingWithinItemIds(
    reportType: "lost" | "found",
    embedding: number[],
    itemIds: number[],
    limit = 12
  ): Promise<Array<{ item: Item; score: number }>> {
    if (itemIds.length === 0) {
      return [];
    }

    const distance = cosineDistance(itemEmbeddings.embedding, embedding);
    const rows = await db
      .select({
        item: items,
        distance,
      })
      .from(itemEmbeddings)
      .innerJoin(items, eq(itemEmbeddings.itemId, items.id))
      .where(
        and(
          eq(items.reportType, reportType),
          eq(items.status, "active"),
          inArray(items.id, itemIds)
        )
      )
      .orderBy(distance)
      .limit(limit);

    return rows.map((row) => ({
      item: row.item,
      score: Math.max(0, 1 - Number(row.distance ?? 1)),
    }));
  }

  async getItemsWithinRadius(
    reportType: "lost" | "found",
    latitude: number,
    longitude: number,
    radiusKm: number,
    limit = 500
  ): Promise<Array<{ item: Item; distanceKm: number }>> {
    const latitudeValue = sql<number | null>`
      case
        when ${items.latitude} ~ '^-?[0-9]+(\.[0-9]+)?$'
          then ${items.latitude}::double precision
        else null
      end
    `;
    const longitudeValue = sql<number | null>`
      case
        when ${items.longitude} ~ '^-?[0-9]+(\.[0-9]+)?$'
          then ${items.longitude}::double precision
        else null
      end
    `;
    const distanceKm = sql<number>`
      6371 * acos(
        least(
          1,
          greatest(
            -1,
            cos(radians(${latitude})) *
            cos(radians(${latitudeValue})) *
            cos(radians(${longitudeValue}) - radians(${longitude})) +
            sin(radians(${latitude})) *
            sin(radians(${latitudeValue}))
          )
        )
      )
    `;

    const rows = await db
      .select({
        item: items,
        distanceKm,
      })
      .from(items)
      .where(
        and(
          eq(items.reportType, reportType),
          eq(items.status, "active"),
          sql<boolean>`${latitudeValue} is not null`,
          sql<boolean>`${longitudeValue} is not null`,
          sql<boolean>`${distanceKm} <= ${radiusKm}`
        )
      )
      .orderBy(distanceKm, desc(items.date))
      .limit(limit);

    return rows.map((row) => ({
      item: row.item,
      distanceKm: Number(row.distanceKm),
    }));
  }

  async searchFoundItemsByEmbedding(
    embedding: number[],
    limit = 12
  ): Promise<Array<{ item: Item; score: number }>> {
    return this.searchItemsByEmbedding("found", embedding, limit);
  }

  async getCandidateItemsForAutoMatch(sourceItem: Item, limit = 80): Promise<Item[]> {
    const targetReportType = sourceItem.reportType === "found" ? "lost" : "found";
    const conditions = [
      eq(items.reportType, targetReportType),
      eq(items.status, "active"),
    ];
    const sourceLatitude = Number.parseFloat(sourceItem.latitude ?? "");
    const sourceLongitude = Number.parseFloat(sourceItem.longitude ?? "");
    const hasSourceCoordinates =
      Number.isFinite(sourceLatitude) && Number.isFinite(sourceLongitude);
    const latitudeValue = sql<number | null>`
      case
        when ${items.latitude} ~ '^-?[0-9]+(\.[0-9]+)?$'
          then ${items.latitude}::double precision
        else null
      end
    `;
    const longitudeValue = sql<number | null>`
      case
        when ${items.longitude} ~ '^-?[0-9]+(\.[0-9]+)?$'
          then ${items.longitude}::double precision
        else null
      end
    `;
    const distanceKm = hasSourceCoordinates
      ? sql<number>`
          6371 * acos(
            least(
              1,
              greatest(
                -1,
                cos(radians(${sourceLatitude})) *
                cos(radians(${latitudeValue})) *
                cos(radians(${longitudeValue}) - radians(${sourceLongitude})) +
                sin(radians(${sourceLatitude})) *
                sin(radians(${latitudeValue}))
              )
            )
          )
        `
      : null;

    if (sourceItem.userId) {
      conditions.push(or(ne(items.userId, sourceItem.userId), isNull(items.userId))!);
    }

    if (sourceItem.date) {
      const sourceDate = new Date(sourceItem.date);

      if (targetReportType === "found") {
        const windowEnd = new Date(sourceDate);
        windowEnd.setDate(windowEnd.getDate() + AUTO_MATCH_DATE_WINDOW_DAYS);
        conditions.push(gte(items.date, sourceDate));
        conditions.push(lte(items.date, windowEnd));
      } else {
        const windowStart = new Date(sourceDate);
        windowStart.setDate(windowStart.getDate() - AUTO_MATCH_DATE_WINDOW_DAYS);
        conditions.push(gte(items.date, windowStart));
        conditions.push(lte(items.date, sourceDate));
      }
    }

    return await db
      .select()
      .from(items)
      .where(and(...conditions))
      .orderBy(distanceKm ?? desc(items.date), desc(items.date))
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
      .orderBy(desc(itemMatches.score), desc(itemMatches.updatedAt), desc(itemMatches.createdAt));

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

  async upsertMatchNotification(input: {
    userId: number;
    lostItemId: number;
    foundItemId: number;
    score: number;
    reasoning: string;
  }): Promise<void> {
    await db
      .insert(matchNotifications)
      .values({
        ...input,
        isRead: false,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          matchNotifications.userId,
          matchNotifications.lostItemId,
          matchNotifications.foundItemId,
        ],
        set: {
          score: input.score,
          reasoning: input.reasoning,
          isRead: false,
          updatedAt: new Date(),
        },
      });
  }

  async getMatchNotifications(userId: number): Promise<MatchNotificationRecord[]> {
    const rows = await db
      .select()
      .from(matchNotifications)
      .where(eq(matchNotifications.userId, userId))
      .orderBy(desc(matchNotifications.updatedAt));

    return this.hydrateMatchNotifications(rows);
  }

  async markMatchNotificationAsRead(
    userId: number,
    notificationId: number
  ): Promise<MatchNotificationRecord | undefined> {
    const [row] = await db
      .update(matchNotifications)
      .set({
        isRead: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(matchNotifications.id, notificationId),
          eq(matchNotifications.userId, userId)
        )
      )
      .returning();

    if (!row) {
      return undefined;
    }

    const [hydrated] = await this.hydrateMatchNotifications([row]);
    return hydrated;
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

  async getUserByOAuth(
    provider: OAuthProvider,
    providerId: string
  ): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.authProvider, provider),
          eq(users.authProviderId, providerId)
        )
      );

    if (!user) {
      return undefined;
    }

    const syncedUser = await ensureConfiguredAdminRole(user);
    return applyConfiguredAdminRole(syncedUser);
  }

  async upsertOAuthUser(input: OAuthUserInput): Promise<User> {
    const username = `${input.provider}_${input.providerId}`;
    const role: UserRole = isConfiguredAdminIdentity(username, input.email)
      ? "admin"
      : "member";
    const values = {
      username,
      password: null,
      name: input.name ?? input.email ?? `${input.provider} user`,
      email: input.email ?? null,
      profileImageUrl: input.profileImageUrl ?? null,
      authProvider: input.provider,
      authProviderId: input.providerId,
      role,
      status: "active",
    } satisfies typeof users.$inferInsert;

    const [user] = await db
      .insert(users)
      .values(values)
      .onConflictDoUpdate({
        target: [users.authProvider, users.authProviderId],
        set: {
          name: values.name,
          email: values.email,
          profileImageUrl: values.profileImageUrl,
          role,
        },
      })
      .returning();

    return applyConfiguredAdminRole(user);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    if (!insertUser.password) {
      throw new Error("Password is required for local accounts.");
    }
    const hashedPassword = await hashPassword(insertUser.password);
    const role: UserRole = isConfiguredAdminIdentity(
      insertUser.username,
      insertUser.email
    )
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
      recentItems: recentItems.items,
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
      isConfiguredAdminIdentity(existingUser.username, existingUser.email)
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
    page?: number;
    limit?: number;
  }): Promise<{
    items: AdminItemRecord[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const conditions = [];
    const page = Math.max(1, filters?.page ?? 1);
    const limit = Math.min(Math.max(1, filters?.limit ?? 30), 100);

    if (filters?.type) {
      conditions.push(eq(items.reportType, filters.type));
    }

    if (filters?.search?.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      conditions.push(
        sql<boolean>`(${items.title} ilike ${searchTerm} or ${items.description} ilike ${searchTerm} or ${items.location} ilike ${searchTerm})`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const [{ totalCount }] = await db
      .select({ totalCount: sql<number>`count(*)::int` })
      .from(items)
      .leftJoin(users, eq(items.userId, users.id))
      .where(whereClause);
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const currentPage = Math.min(page, totalPages);
    const currentOffset = (currentPage - 1) * limit;

    const rows = await db
      .select({
        item: items,
        ownerName: users.name,
        ownerUsername: users.username,
      })
      .from(items)
      .leftJoin(users, eq(items.userId, users.id))
      .where(whereClause)
      .orderBy(desc(items.date), desc(items.id))
      .limit(limit)
      .offset(currentOffset);

    return {
      items: rows.map((row) => ({
        ...row.item,
        ownerName: row.ownerName ?? null,
        ownerUsername: row.ownerUsername ?? null,
        statusLabel:
          row.item.status === "resolved"
            ? "해결됨"
            : row.item.reportType === "lost"
            ? "분실 접수"
            : "습득 접수",
      })),
      totalCount,
      page: currentPage,
      limit,
      totalPages,
    };
  }

  async deleteItemByAdmin(itemId: number): Promise<boolean> {
    const deletedRows = await db
      .delete(items)
      .where(eq(items.id, itemId))
      .returning({ id: items.id });

    return deletedRows.length > 0;
  }

  async createClaimReport(
    reporterId: number,
    report: InsertItemClaimReport
  ): Promise<AdminClaimReportRecord> {
    const [savedReport] = await db
      .insert(itemClaimReports)
      .values({
        ...report,
        reporterId,
        itemId: report.itemId ?? null,
        suspectedUserInfo: report.suspectedUserInfo ?? null,
        evidence: report.evidence ?? null,
        contactInfo: report.contactInfo ?? null,
        updatedAt: new Date(),
      })
      .returning();

    return (
      (await this.getAdminClaimReportById(savedReport.id)) ??
      {
        ...savedReport,
        status: savedReport.status as ClaimReportStatus,
        reporterName: null,
        reporterUsername: null,
        itemTitle: null,
      }
    );
  }

  private async getAdminClaimReportById(
    reportId: number
  ): Promise<AdminClaimReportRecord | undefined> {
    const rows = await db
      .select({
        report: itemClaimReports,
        reporterName: users.name,
        reporterUsername: users.username,
        itemTitle: items.title,
      })
      .from(itemClaimReports)
      .leftJoin(users, eq(itemClaimReports.reporterId, users.id))
      .leftJoin(items, eq(itemClaimReports.itemId, items.id))
      .where(eq(itemClaimReports.id, reportId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return undefined;
    }

    return {
      ...row.report,
      status: row.report.status as ClaimReportStatus,
      reporterName: row.reporterName ?? null,
      reporterUsername: row.reporterUsername ?? null,
      itemTitle: row.itemTitle ?? null,
    };
  }

  async getAdminClaimReports(filters?: {
    status?: ClaimReportStatus;
  }): Promise<AdminClaimReportRecord[]> {
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(itemClaimReports.status, filters.status));
    }

    const rows = await db
      .select({
        report: itemClaimReports,
        reporterName: users.name,
        reporterUsername: users.username,
        itemTitle: items.title,
      })
      .from(itemClaimReports)
      .leftJoin(users, eq(itemClaimReports.reporterId, users.id))
      .leftJoin(items, eq(itemClaimReports.itemId, items.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(itemClaimReports.createdAt), desc(itemClaimReports.id));

    return rows.map((row) => ({
      ...row.report,
      status: row.report.status as ClaimReportStatus,
      reporterName: row.reporterName ?? null,
      reporterUsername: row.reporterUsername ?? null,
      itemTitle: row.itemTitle ?? null,
    }));
  }

  async updateClaimReportByAdmin(
    reportId: number,
    updates: UpdateItemClaimReportStatus
  ): Promise<AdminClaimReportRecord | undefined> {
    const [updatedReport] = await db
      .update(itemClaimReports)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(itemClaimReports.id, reportId))
      .returning();

    if (!updatedReport) {
      return undefined;
    }

    return this.getAdminClaimReportById(reportId);
  }

  hashPassword = hashPassword;
  verifyPassword = verifyPassword;
}

export const storage = new DatabaseStorage();
