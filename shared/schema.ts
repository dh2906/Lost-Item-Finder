import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  serial,
  timestamp,
  jsonb,
  integer,
  vector,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  reportType: text("report_type").notNull(), // 'lost' or 'found'
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"), // base64 data URI
  itemCategory: text("item_category"),
  color: text("color"),
  size: text("size"),
  tags: jsonb("tags").$type<string[]>(), 
  location: text("location"),
  latitude: text("latitude"), // 위도
  longitude: text("longitude"), // 경도
  date: timestamp("date").defaultNow(),
  contactInfo: text("contact_info"),
});

export const itemEmbeddings = pgTable("item_embeddings", {
  itemId: integer("item_id").primaryKey().references(() => items.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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

export const insertItemSchema = createInsertSchema(items).omit({
  id: true,
  date: true,
});

export type Item = typeof items.$inferSelect;
export type InsertItem = z.infer<typeof insertItemSchema>;
export type ItemEmbedding = typeof itemEmbeddings.$inferSelect;
export type ItemMatch = typeof itemMatches.$inferSelect;

export const itemMatchStatuses = ["new", "viewed", "dismissed", "confirmed"] as const;
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
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export const chatRooms = pgTable("chat_rooms", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  receiverId: integer("receiver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => chatRooms.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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

export type ChatRoom = typeof chatRooms.$inferSelect;
export type InsertChatRoom = z.infer<typeof insertChatRoomSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

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
