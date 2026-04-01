import {
  boolean,
  pgTable,
  text,
  serial,
  timestamp,
  jsonb,
  integer,
  real,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const reportTypes = ["lost", "found"] as const;
export type ReportType = (typeof reportTypes)[number];

export const itemStatuses = ["active", "resolved"] as const;
export type ItemStatus = (typeof itemStatuses)[number];

export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  reportType: text("report_type").notNull(),
  status: text("status").notNull().default("active"),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  itemCategory: text("item_category"),
  color: text("color"),
  size: text("size"),
  tags: jsonb("tags").$type<string[]>(),
  location: text("location"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  date: timestamp("date").defaultNow(),
  contactInfo: text("contact_info"),
});

export const itemEmbeddings = pgTable("item_embeddings", {
  itemId: integer("item_id")
    .primaryKey()
    .references(() => items.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

const itemBaseSchema = createInsertSchema(items, {
  reportType: z.enum(reportTypes),
  status: z.enum(itemStatuses),
}).omit({
  id: true,
  userId: true,
  date: true,
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
export type MatchNotification = typeof matchNotifications.$inferSelect;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const favorites = pgTable(
  "favorites",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userItemUnique: uniqueIndex("favorites_user_item_unique").on(
      table.userId,
      table.itemId
    ),
  })
);

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
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userLostFoundUnique: uniqueIndex("match_notifications_user_lost_found_unique").on(
      table.userId,
      table.lostItemId,
      table.foundItemId
    ),
  })
);

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Favorite = typeof favorites.$inferSelect;

export const userRoles = ["member", "admin"] as const;
export type UserRole = (typeof userRoles)[number];

export const userStatuses = ["active", "suspended"] as const;
export type UserStatus = (typeof userStatuses)[number];
