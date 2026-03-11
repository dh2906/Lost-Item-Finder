import { pgTable, text, serial, timestamp, jsonb, integer, vector } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const items = pgTable("items", {
  id: serial("id").primaryKey(),
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

export const insertItemSchema = createInsertSchema(items).omit({
  id: true,
  date: true,
});

export type Item = typeof items.$inferSelect;
export type InsertItem = z.infer<typeof insertItemSchema>;
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
