import { pgTable, text, serial, timestamp, jsonb, integer, vector } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  reportType: text("report_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),           // 대표 이미지 (하위호환)
  images: jsonb("images").$type<string[]>(), // 다중 이미지 배열
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

export const insertItemSchema = createInsertSchema(items).omit({
  id: true,
  date: true,
});

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

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
