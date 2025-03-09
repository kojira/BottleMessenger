import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const botSettings = pgTable("bot_settings", {
  id: serial("id").primaryKey(),
  blueskyHandle: text("bluesky_handle").notNull(),
  blueskyPassword: text("bluesky_password").notNull(),
  nostrPrivateKey: text("nostr_private_key").notNull(),
  nostrRelays: text("nostr_relays").notNull().default('["wss://relay.damus.io", "wss://nos.lol"]'),
  enabled: text("enabled").notNull().default("true"),
});

export const bottles = pgTable("bottles", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  senderPlatform: text("sender_platform").notNull(),
  senderId: text("sender_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  status: text("status").notNull().default("active"),
});

export const bottleReplies = pgTable("bottle_replies", {
  id: serial("id").primaryKey(),
  bottleId: integer("bottle_id")
    .notNull()
    .references(() => bottles.id),
  content: text("content").notNull(),
  senderPlatform: text("sender_platform").notNull(),
  senderId: text("sender_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userStats = pgTable("user_stats", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull(),
  userId: text("user_id").notNull(),
  bottlesSent: integer("bottles_sent").notNull().default(0),
  bottlesReceived: integer("bottles_received").notNull().default(0),
  repliesSent: integer("replies_sent").notNull().default(0),
  lastActivity: timestamp("last_activity").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  sourcePlatform: text("source_platform").notNull(),
  sourceId: text("source_id").notNull(),
  sourceUser: text("source_user").notNull(),
  targetPlatform: text("target_platform").notNull(),
  targetId: text("target_id"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  status: text("status").notNull(),
  error: text("error"),
});

export const botState = pgTable("bot_state", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull().unique(),
  lastProcessedAt: timestamp("last_processed_at").notNull(),
});

// Insert schemas
export const settingsSchema = createInsertSchema(botSettings).omit({ id: true });
export const insertBottleSchema = createInsertSchema(bottles).omit({ id: true, createdAt: true });
export const insertReplySchema = createInsertSchema(bottleReplies).omit({ id: true, createdAt: true });
export const insertUserStatsSchema = createInsertSchema(userStats).omit({ id: true, lastActivity: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const botStateSchema = createInsertSchema(botState).omit({ id: true });

// Types
export type Settings = typeof botSettings.$inferSelect;
export type Bottle = typeof bottles.$inferSelect;
export type BottleReply = typeof bottleReplies.$inferSelect;
export type UserStats = typeof userStats.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type BotState = typeof botState.$inferSelect;

// Validation schemas
export type InsertSettings = z.infer<typeof settingsSchema>;
export type InsertBottle = z.infer<typeof insertBottleSchema>;
export type InsertBottleReply = z.infer<typeof insertReplySchema>;
export type InsertUserStats = z.infer<typeof insertUserStatsSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertBotState = z.infer<typeof botStateSchema>;

export const platformSchema = z.enum(["bluesky", "nostr"]);
export const statusSchema = z.enum(["pending", "sent", "failed"]);
export const bottleStatusSchema = z.enum(["active", "archived"]);

// 既存のエクスポートの後に追加
export interface PlatformStats {
  platform: string;
  userCount: number;
  bottleCount: number;
  replyCount: number;
  mau: number; // 追加：月間アクティブユーザー数
}

export interface DailyStats {
  date: string;
  bottleCount: number;
}

export interface DailyReplies {
  date: string;
  replyCount: number;
}

export interface GlobalStats {
  totalBottles: number;
  totalReplies: number;
  activeUsers: number;
  activeBottles: number;
  platformStats: PlatformStats[];
  dailyStats: DailyStats[];
  dailyReplies: DailyReplies[];
}