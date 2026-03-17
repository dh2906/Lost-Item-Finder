import { pgTable, text, serial, timestamp, jsonb, integer, vector, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  reportType: text("report_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  images: jsonb("images").$type<string[]>(),
  itemCategory: text("item_category"),
  color: text("color"),
  size: text("size"),
  tags: jsonb("tags").$type<string[]>(),
  location: text("location"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  date: timestamp("date").defaultNow(),
  contactInfo: text("contact_info"),
  status: text("status").default("active"),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
});

export const itemEmbeddings = pgTable("item_embeddings", {
  itemId: integer("item_id").primaryKey().references(() => items.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 콘버세이션 (1:1 대화스레드)
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").references(() => items.id, { onDelete: "cascade" }),
  participantA: integer("participant_a").notNull().references(() => users.id, { onDelete: "cascade" }),
  participantB: integer("participant_b").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
});

// 메시지
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  read: boolean("read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertItemSchema = createInsertSchema(items).omit({ id: true, date: true });
export const updateItemSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  contactInfo: z.string().optional(),
  status: z.enum(["active", "resolved"]).optional(),
});

export type Item = typeof items.$inferSelect;
export type InsertItem = z.infer<typeof insertItemSchema>;
export type UpdateItem = z.infer<typeof updateItemSchema>;
export type ItemEmbedding = typeof itemEmbeddings.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull().default(""),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow(),
  provider: text("provider").default("local"),
  providerId: text("provider_id"),
  avatarUrl: text("avatar_url"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
