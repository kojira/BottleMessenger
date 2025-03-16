import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const botSettings = sqliteTable("bot_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  blueskyHandle: text("bluesky_handle").notNull(),
  blueskyPassword: text("bluesky_password").notNull(),
  nostrPrivateKey: text("nostr_private_key").notNull(),
  nostrRelays: text("nostr_relays").notNull().default('["wss://relay.damus.io", "wss://nos.lol"]'),
  enabled: text("enabled").notNull().default("true"),
  autoStart: text("auto_start").notNull().default("false"),
  blueskyIgnoreBeforeTime: integer("bluesky_ignore_before_time"),
  botStatus: text("bot_status").notNull().default("stopped"),
});

export const bottles = sqliteTable("bottles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  content: text("content").notNull(),
  senderPlatform: text("sender_platform").notNull(),
  senderId: text("sender_id").notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().defaultNow(),
  status: text("status").notNull().default("active"),
});

export const bottleReplies = sqliteTable("bottle_replies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bottleId: integer("bottle_id")
    .notNull()
    .references(() => bottles.id),
  content: text("content").notNull(),
  senderPlatform: text("sender_platform").notNull(),
  senderId: text("sender_id").notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().defaultNow(),
});

export const userStats = sqliteTable("user_stats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  platform: text("platform").notNull(),
  userId: text("user_id").notNull(),
  bottlesSent: integer("bottles_sent").notNull().default(0),
  bottlesReceived: integer("bottles_received").notNull().default(0),
  repliesSent: integer("replies_sent").notNull().default(0),
  lastActivity: integer("last_activity", { mode: 'timestamp' }).notNull().defaultNow(),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourcePlatform: text("source_platform").notNull(),
  sourceId: text("source_id").notNull(),
  sourceUser: text("source_user").notNull(),
  targetPlatform: text("target_platform").notNull(),
  targetId: text("target_id"),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().defaultNow(),
  status: text("status").notNull(),
  error: text("error"),
});

export const botState = sqliteTable("bot_state", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  platform: text("platform").notNull().unique(),
  lastProcessedAt: integer("last_processed_at", { mode: 'timestamp' }).notNull(),
});

export const botResponses = sqliteTable("bot_responses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  platform: text("platform").notNull(),
  responseType: text("response_type").notNull(),
  message: text("message").notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().defaultNow(),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().defaultNow(),
});

// Insert schemas
export const settingsSchema = createInsertSchema(botSettings).omit({ id: true });
export const insertBottleSchema = createInsertSchema(bottles).omit({ id: true, createdAt: true });
export const insertReplySchema = createInsertSchema(bottleReplies).omit({ id: true, createdAt: true });
export const insertUserStatsSchema = createInsertSchema(userStats).omit({ id: true, lastActivity: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const botStateSchema = createInsertSchema(botState).omit({ id: true });
export const insertBotResponseSchema = createInsertSchema(botResponses).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true
});

// Types
export type Settings = typeof botSettings.$inferSelect;
export type Bottle = typeof bottles.$inferSelect;
export type BottleReply = typeof bottleReplies.$inferSelect;
export type UserStats = typeof userStats.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type BotState = typeof botState.$inferSelect;
export type BotResponse = typeof botResponses.$inferSelect;
export type InsertBotResponse = z.infer<typeof insertBotResponseSchema>;


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
export const responseTypeSchema = z.enum([
  "welcome",
  "help",
  "bottle_sent",
  "bottle_received",
  "reply_sent",
  "error",
  "stats"
]);

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
