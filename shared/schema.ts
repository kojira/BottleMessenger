import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const botSettings = pgTable("bot_settings", {
  id: serial("id").primaryKey(),
  blueskyHandle: text("bluesky_handle").notNull(),
  blueskyPassword: text("bluesky_password").notNull(),
  nostrPrivateKey: text("nostr_private_key").notNull(),
  enabled: text("enabled").notNull().default("true"),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  sourcePlatform: text("source_platform").notNull(),
  sourceId: text("source_id").notNull(), // Original message ID 
  sourceUser: text("source_user").notNull(), // Original sender
  targetPlatform: text("target_platform").notNull(),
  targetId: text("target_id"), // ID after relay
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  status: text("status").notNull(), // 'pending' | 'sent' | 'failed'
  error: text("error"),
});

export const settingsSchema = createInsertSchema(botSettings).omit({ id: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });

export type Settings = typeof botSettings.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type InsertSettings = z.infer<typeof settingsSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export const platformSchema = z.enum(["bluesky", "nostr"]);
export const statusSchema = z.enum(["pending", "sent", "failed"]);