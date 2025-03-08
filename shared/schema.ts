import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const botAccounts = pgTable("bot_accounts", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull(), // 'bluesky' | 'nostr'
  identifier: text("identifier").notNull(), // Bluesky handle or Nostr pubkey
  credentials: jsonb("credentials").notNull(), // {identifier, password} for Bluesky or {privateKey} for Nostr
  active: text("active").notNull().default("true"),
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

export const insertBotSchema = createInsertSchema(botAccounts).omit({ id: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });

export type Bot = typeof botAccounts.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type InsertBot = z.infer<typeof insertBotSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export const platformSchema = z.enum(["bluesky", "nostr"]);
export const statusSchema = z.enum(["pending", "sent", "failed"]);
