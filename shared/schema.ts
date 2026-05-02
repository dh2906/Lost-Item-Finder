import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { MAX_ITEM_IMAGE_COUNT } from "./item-images";

export const reportTypes = ["lost", "found"] as const;
export type ReportType = (typeof reportTypes)[number];

export const itemStatuses = ["active", "resolved"] as const;
export type ItemStatus = (typeof itemStatuses)[number];

export const items = pgTable(
  "items",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reportType: text("report_type").notNull(),
    status: text("status").notNull().default("active"),
    title: text("title").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    imageUrls: jsonb("image_urls")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    itemCategory: text("item_category"),
    color: text("color"),
    size: text("size"),
    tags: jsonb("tags").$type<string[]>(),
    location: text("location"),
    region1: text("region1"),
    region2: text("region2"),
    region3: text("region3"),
    address: text("address"),
    placeName: text("place_name"),
    latitude: text("latitude"),
    longitude: text("longitude"),
    date: timestamp("date").defaultNow(),
    contactInfo: text("contact_info"),
    // External fields are reserved for third-party source records such as
    // Lost112. User-created posts keep these null so source-specific behavior
    // stays explicit at the data boundary.
    externalSource: text("external_source"),
    externalId: text("external_id"),
    externalUrl: text("external_url"),
    externalPayload: jsonb("external_payload").$type<Record<string, unknown>>(),
    externalPayloadHash: text("external_payload_hash"),
  },
  (table) => ({
    externalSourceIdUnique: uniqueIndex("items_external_source_id_unique").on(
      table.externalSource,
      table.externalId
    ),
  })
);

export const itemEmbeddings = pgTable("item_embeddings", {
  itemId: integer("item_id")
    .primaryKey()
    .references(() => items.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 768 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const lost112SyncRuns = pgTable("lost112_sync_runs", {
  id: serial("id").primaryKey(),
  trigger: text("trigger").notNull(),
  status: text("status").notNull(),
  page: integer("page").notNull(),
  numOfRows: integer("num_of_rows").notNull(),
  maxPages: integer("max_pages").notNull(),
  fetchedCount: integer("fetched_count").notNull().default(0),
  createdCount: integer("created_count").notNull().default(0),
  updatedCount: integer("updated_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  embeddedCount: integer("embedded_count").notNull().default(0),
  embeddingFailedCount: integer("embedding_failed_count").notNull().default(0),
  automaticMatchCount: integer("automatic_match_count").notNull().default(0),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
});

export const itemMatches = pgTable(
  "item_matches",
  {
    id: serial("id").primaryKey(),
    lostItemId: integer("lost_item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    foundItemId: integer("found_item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    matchReason: text("match_reason").notNull(),
    status: text("status").notNull().default("new"),
    notifiedAt: timestamp("notified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    lostFoundUnique: uniqueIndex("item_matches_lost_found_unique").on(
      table.lostItemId,
      table.foundItemId
    ),
    lostItemIndex: index("item_matches_lost_item_idx").on(table.lostItemId),
    foundItemIndex: index("item_matches_found_item_idx").on(table.foundItemId),
    statusIndex: index("item_matches_status_idx").on(table.status),
  })
);

const itemBaseSchema = createInsertSchema(items, {
  reportType: z.enum(reportTypes),
  status: z.enum(itemStatuses),
  imageUrl: z.string().trim().min(1).optional(),
  imageUrls: z
    .array(z.string().trim().min(1))
    .max(MAX_ITEM_IMAGE_COUNT)
    .optional(),
}).omit({
  id: true,
  userId: true,
  date: true,
  externalSource: true,
  externalId: true,
  externalUrl: true,
  externalPayload: true,
});

export const insertItemSchema = itemBaseSchema.omit({
  status: true,
});

export const updateItemSchema = itemBaseSchema
  .omit({
    reportType: true,
  })
  .partial()
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    {
      message: "최소 한 개 이상의 필드를 입력해야 합니다",
    }
  );

export type Item = typeof items.$inferSelect;
export type InsertItem = z.infer<typeof insertItemSchema>;
export type UpdateItem = z.infer<typeof updateItemSchema>;
export type ItemEmbedding = typeof itemEmbeddings.$inferSelect;
export type ItemMatch = typeof itemMatches.$inferSelect;

export const itemMatchStatuses = [
  "new",
  "viewed",
  "dismissed",
  "confirmed",
] as const;
export type ItemMatchStatus = (typeof itemMatchStatuses)[number];

export const insertItemMatchSchema = createInsertSchema(itemMatches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateItemMatchStatusSchema = z.object({
  status: z.enum(itemMatchStatuses),
});

export type InsertItemMatch = z.infer<typeof insertItemMatchSchema>;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  fcmToken: text("fcm_token"),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const sessions = pgTable("sessions", {
  sid: text("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

export const matchNotifications = pgTable(
  "match_notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lostItemId: integer("lost_item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    foundItemId: integer("found_item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    score: real("score").notNull(),
    reasoning: text("reasoning").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    notifiedAt: timestamp("notified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userLostFoundUnique: uniqueIndex(
      "match_notifications_user_lost_found_unique"
    ).on(table.userId, table.lostItemId, table.foundItemId),
  })
);

export const chatRooms = pgTable("chat_rooms", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  senderId: integer("sender_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  receiverId: integer("receiver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id")
    .notNull()
    .references(() => chatRooms.id, { onDelete: "cascade" }),
  senderId: integer("sender_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isRead: integer("is_read").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertChatRoomSchema = createInsertSchema(chatRooms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type MatchNotification = typeof matchNotifications.$inferSelect;
export type ChatRoom = typeof chatRooms.$inferSelect;
export type InsertChatRoom = z.infer<typeof insertChatRoomSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

export const userRoles = ["member", "admin"] as const;
export type UserRole = (typeof userRoles)[number];

export const userStatuses = ["active", "suspended"] as const;
export type UserStatus = (typeof userStatuses)[number];

export const itemsRelations = relations(items, ({ one, many }) => ({
  owner: one(users, {
    fields: [items.userId],
    references: [users.id],
  }),
  chatRooms: many(chatRooms),
  lostMatches: many(itemMatches, { relationName: "lost_item_matches" }),
  foundMatches: many(itemMatches, { relationName: "found_item_matches" }),
}));

export const itemMatchesRelations = relations(itemMatches, ({ one }) => ({
  lostItem: one(items, {
    fields: [itemMatches.lostItemId],
    references: [items.id],
    relationName: "lost_item_matches",
  }),
  foundItem: one(items, {
    fields: [itemMatches.foundItemId],
    references: [items.id],
    relationName: "found_item_matches",
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  items: many(items),
  sentChatRooms: many(chatRooms, { relationName: "chat_room_sender" }),
  receivedChatRooms: many(chatRooms, { relationName: "chat_room_receiver" }),
  chatMessages: many(chatMessages),
}));

export const chatRoomsRelations = relations(chatRooms, ({ one, many }) => ({
  item: one(items, {
    fields: [chatRooms.itemId],
    references: [items.id],
  }),
  sender: one(users, {
    fields: [chatRooms.senderId],
    references: [users.id],
    relationName: "chat_room_sender",
  }),
  receiver: one(users, {
    fields: [chatRooms.receiverId],
    references: [users.id],
    relationName: "chat_room_receiver",
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  room: one(chatRooms, {
    fields: [chatMessages.roomId],
    references: [chatRooms.id],
  }),
  sender: one(users, {
    fields: [chatMessages.senderId],
    references: [users.id],
  }),
}));

export * from "./models/chat";
