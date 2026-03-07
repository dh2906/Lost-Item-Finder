import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
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
  date: timestamp("date").defaultNow(),
  contactInfo: text("contact_info"),
});

export const insertItemSchema = createInsertSchema(items).omit({
  id: true,
  date: true,
});

export type Item = typeof items.$inferSelect;
export type InsertItem = z.infer<typeof insertItemSchema>;
