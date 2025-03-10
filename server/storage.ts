import { Settings, Message, InsertSettings, InsertMessage } from "@shared/schema";
import { Bottle, BottleReply, UserStats } from "@shared/schema";
import { InsertBottle, InsertBottleReply, InsertUserStats } from "@shared/schema";
import { db } from "./db";
import { and, eq, ne, sql } from "drizzle-orm";
import { bottles, bottleReplies, userStats, botSettings, messages, botResponses } from "@shared/schema";
import { botState, type BotState, type InsertBotState } from "@shared/schema";
import { type BotResponse, type InsertBotResponse } from "@shared/schema";

export interface IStorage {
  // Settings operations
  getSettings(): Promise<Settings | null>;
  updateSettings(settings: InsertSettings): Promise<Settings>;

  // Message operations
  getMessages(limit?: number): Promise<Message[]>;
  getMessage(id: number): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: number, message: Partial<Message>): Promise<Message>;

  // Bottle operations
  createBottle(bottle: InsertBottle): Promise<Bottle>;
  getBottle(id: number): Promise<Bottle | null>;
  getRandomActiveBottle(platform: string, userId: string): Promise<Bottle | null>;
  getUserBottles(platform: string, userId: string): Promise<(Bottle & { replyCount: number })[]>;
  archiveBottle(id: number): Promise<void>;

  // Bottle Reply operations
  createBottleReply(reply: InsertBottleReply): Promise<BottleReply>;
  getBottleReplies(bottleId: number): Promise<BottleReply[]>;

  // User Stats operations
  getUserStats(platform: string, userId: string): Promise<UserStats | null>;
  incrementUserStat(platform: string, userId: string, stat: "bottlesSent" | "bottlesReceived" | "repliesSent"): Promise<void>;
  updateUserLastActivity(platform: string, userId: string): Promise<void>;

  // Bot state operations
  getBotState(platform: string): Promise<BotState | null>;
  updateBotState(platform: string, lastProcessedAt: Date): Promise<BotState>;

  // 全体の統計情報を取得
  getGlobalStats(): Promise<{
    totalBottles: number;
    totalReplies: number;
    activeUsers: number;
    activeBottles: number;
    platformStats: { platform: string; userCount: number; bottleCount: number; replyCount: number; mau: number }[];
    dailyStats: { date: string; bottleCount: number }[];
    dailyReplies: { date: string; replyCount: number }[];
  }>;

  // Bot response operations
  getBotResponses(): Promise<BotResponse[]>;
  createBotResponse(response: InsertBotResponse): Promise<BotResponse>;
  deleteBotResponse(id: number): Promise<void>;

  // Add new methods for import/export
  exportData(): Promise<{
    settings: Settings[];
    bottles: Bottle[];
    bottleReplies: BottleReply[];
    userStats: UserStats[];
    messages: Message[];
    botState: BotState[];
    botResponses: BotResponse[];
  }>;

  importData(data: {
    settings?: Settings[];
    bottles?: Bottle[];
    bottleReplies?: BottleReply[];
    userStats?: UserStats[];
    messages?: Message[];
    botState?: BotState[];
    botResponses?: BotResponse[];
  }): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private settings: Settings | null = null;

  // Settings operations
  async getSettings(): Promise<Settings | null> {
    const [settings] = await db.select().from(botSettings);
    return settings || null;
  }

  async updateSettings(settings: InsertSettings): Promise<Settings> {
    const enabled = settings.enabled ?? 'true';
    const [updated] = await db
      .insert(botSettings)
      .values({ id: 1, ...settings, enabled })
      .onConflictDoUpdate({
        target: botSettings.id,
        set: { ...settings, enabled }
      })
      .returning();
    return updated;
  }

  // Message operations
  async getMessages(limit = 100): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .orderBy(sql`${messages.createdAt} DESC`)
      .limit(limit);
  }

  async getMessage(id: number): Promise<Message | undefined> {
    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, id));
    return message;
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [created] = await db
      .insert(messages)
      .values({
        ...message,
        targetId: message.targetId ?? null,
        error: message.error ?? null
      })
      .returning();
    return created;
  }

  async updateMessage(id: number, update: Partial<Message>): Promise<Message> {
    const [updated] = await db
      .update(messages)
      .set(update)
      .where(eq(messages.id, id))
      .returning();
    return updated;
  }

  // Bottle operations
  async createBottle(bottle: InsertBottle): Promise<Bottle> {
    const [created] = await db
      .insert(bottles)
      .values(bottle)
      .returning();
    return created;
  }

  async getBottle(id: number): Promise<Bottle | null> {
    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, id));
    return bottle || null;
  }

  async getRandomActiveBottle(platform: string, userId: string): Promise<Bottle | null> {
    const [bottle] = await db
      .select()
      .from(bottles)
      .where(
        and(
          eq(bottles.status, "active"),
          ne(bottles.senderId, userId)
        )
      )
      .orderBy(sql`RANDOM()`)
      .limit(1);
    return bottle || null;
  }

  async getUserBottles(
    platform: string,
    userId: string
  ): Promise<(Bottle & { replyCount: number })[]> {
    return await db
      .select({
        ...bottles,
        replyCount: sql<number>`COUNT(${bottleReplies.id})`
      })
      .from(bottles)
      .leftJoin(bottleReplies, eq(bottles.id, bottleReplies.bottleId))
      .where(
        and(
          eq(bottles.senderPlatform, platform),
          eq(bottles.senderId, userId)
        )
      )
      .groupBy(bottles.id)
      .orderBy(bottles.createdAt);
  }

  async archiveBottle(id: number): Promise<void> {
    await db
      .update(bottles)
      .set({ status: "archived" })
      .where(eq(bottles.id, id));
  }

  // Bottle Reply operations
  async createBottleReply(reply: InsertBottleReply): Promise<BottleReply> {
    const [created] = await db
      .insert(bottleReplies)
      .values(reply)
      .returning();
    return created;
  }

  async getBottleReplies(bottleId: number): Promise<BottleReply[]> {
    return await db
      .select()
      .from(bottleReplies)
      .where(eq(bottleReplies.bottleId, bottleId))
      .orderBy(bottleReplies.createdAt);
  }

  // User Stats operations
  async getUserStats(platform: string, userId: string): Promise<UserStats | null> {
    const [stats] = await db
      .select()
      .from(userStats)
      .where(
        and(
          eq(userStats.platform, platform),
          eq(userStats.userId, userId)
        )
      );
    return stats || null;
  }

  async incrementUserStat(
    platform: string,
    userId: string,
    stat: "bottlesSent" | "bottlesReceived" | "repliesSent"
  ): Promise<void> {
    const existingStats = await this.getUserStats(platform, userId);

    if (existingStats) {
      await db
        .update(userStats)
        .set({
          [stat]: sql`${userStats[stat]} + 1`,
          lastActivity: new Date()
        })
        .where(
          and(
            eq(userStats.platform, platform),
            eq(userStats.userId, userId)
          )
        );
    } else {
      await db
        .insert(userStats)
        .values({
          platform,
          userId,
          [stat]: 1,
          bottlesSent: stat === "bottlesSent" ? 1 : 0,
          bottlesReceived: stat === "bottlesReceived" ? 1 : 0,
          repliesSent: stat === "repliesSent" ? 1 : 0
        });
    }
  }

  async updateUserLastActivity(platform: string, userId: string): Promise<void> {
    const existingStats = await this.getUserStats(platform, userId);

    if (existingStats) {
      await db
        .update(userStats)
        .set({ lastActivity: new Date() })
        .where(
          and(
            eq(userStats.platform, platform),
            eq(userStats.userId, userId)
          )
        );
    } else {
      await db
        .insert(userStats)
        .values({
          platform,
          userId,
          bottlesSent: 0,
          bottlesReceived: 0,
          repliesSent: 0
        });
    }
  }

  // Bot state operations
  async getBotState(platform: string): Promise<BotState | null> {
    const [state] = await db
      .select()
      .from(botState)
      .where(eq(botState.platform, platform));
    return state || null;
  }

  async updateBotState(platform: string, lastProcessedAt: Date): Promise<BotState> {
    const [state] = await db
      .insert(botState)
      .values({ platform, lastProcessedAt })
      .onConflictDoUpdate({
        target: [botState.platform],
        set: { lastProcessedAt }
      })
      .returning();
    return state;
  }

  async getGlobalStats() {
    // ボトルメールの総数を取得
    const [{ totalBottles }] = await db
      .select({ totalBottles: sql<number>`COUNT(*)` })
      .from(bottles);

    // 返信の総数を取得
    const [{ totalReplies }] = await db
      .select({ totalReplies: sql<number>`COUNT(*)` })
      .from(bottleReplies);

    // アクティブなユーザー数を取得（過去24時間以内にアクティビティのあるユーザー）
    const [{ activeUsers }] = await db
      .select({ activeUsers: sql<number>`COUNT(DISTINCT "user_id")` })
      .from(userStats)
      .where(
        sql`${userStats.lastActivity} > NOW() - INTERVAL '24 hours'`
      );

    // アクティブなボトルの数を取得
    const [{ activeBottles }] = await db
      .select({ activeBottles: sql<number>`COUNT(*)` })
      .from(bottles)
      .where(eq(bottles.status, "active"));

    // プラットフォーム別の統計を取得
    const platformStats = await db
      .select({
        platform: userStats.platform,
        userCount: sql<number>`COUNT(DISTINCT "user_id")`,
        bottleCount: sql<number>`SUM(${userStats.bottlesSent})`,
        replyCount: sql<number>`SUM(${userStats.repliesSent})`,
        mau: sql<number>`COUNT(DISTINCT CASE 
          WHEN ${userStats.lastActivity} > NOW() - INTERVAL '30 days' 
          THEN "user_id" 
          END)`
      })
      .from(userStats)
      .groupBy(userStats.platform);

    // 過去7日間の日別統計を取得
    const dailyStats = await db
      .select({
        date: sql<string>`DATE_TRUNC('day', ${bottles.createdAt})`,
        bottleCount: sql<number>`COUNT(*)`,
      })
      .from(bottles)
      .where(sql`${bottles.createdAt} > NOW() - INTERVAL '7 days'`)
      .groupBy(sql`DATE_TRUNC('day', ${bottles.createdAt})`)
      .orderBy(sql`DATE_TRUNC('day', ${bottles.createdAt})`);

    const dailyReplies = await db
      .select({
        date: sql<string>`DATE_TRUNC('day', ${bottleReplies.createdAt})`,
        replyCount: sql<number>`COUNT(*)`,
      })
      .from(bottleReplies)
      .where(sql`${bottleReplies.createdAt} > NOW() - INTERVAL '7 days'`)
      .groupBy(sql`DATE_TRUNC('day', ${bottleReplies.createdAt})`)
      .orderBy(sql`DATE_TRUNC('day', ${bottleReplies.createdAt})`);

    return {
      totalBottles,
      totalReplies,
      activeUsers,
      activeBottles,
      platformStats,
      dailyStats,
      dailyReplies
    };
  }


  // Bot応答メッセージの操作を追加
  async getBotResponses(): Promise<BotResponse[]> {
    return await db
      .select()
      .from(botResponses)
      .orderBy(botResponses.platform, botResponses.responseType);
  }

  async createBotResponse(response: InsertBotResponse): Promise<BotResponse> {
    const [created] = await db
      .insert(botResponses)
      .values(response)
      .returning();
    return created;
  }

  async deleteBotResponse(id: number): Promise<void> {
    await db
      .delete(botResponses)
      .where(eq(botResponses.id, id));
  }

  async exportData() {
    const [settings, bottles, bottleReplies, userStats, messages, botState, botResponses] = await Promise.all([
      db.select().from(botSettings),
      db.select().from(bottles),
      db.select().from(bottleReplies),
      db.select().from(userStats),
      db.select().from(messages),
      db.select().from(botState),
      db.select().from(botResponses)
    ]);

    return {
      settings,
      bottles,
      bottleReplies,
      userStats,
      messages,
      botState,
      botResponses
    };
  }

  async importData(data: {
    settings?: Settings[];
    bottles?: Bottle[];
    bottleReplies?: BottleReply[];
    userStats?: UserStats[];
    messages?: Message[];
    botState?: BotState[];
    botResponses?: BotResponse[];
  }) {
    const transaction = async () => {
      if (data.settings?.length) {
        await db.insert(botSettings).values(data.settings)
          .onConflictDoUpdate({ target: botSettings.id, set: {} });
      }

      if (data.bottles?.length) {
        await db.insert(bottles).values(data.bottles)
          .onConflictDoUpdate({ target: bottles.id, set: {} });
      }

      if (data.bottleReplies?.length) {
        await db.insert(bottleReplies).values(data.bottleReplies)
          .onConflictDoUpdate({ target: bottleReplies.id, set: {} });
      }

      if (data.userStats?.length) {
        await db.insert(userStats).values(data.userStats)
          .onConflictDoUpdate({ target: [userStats.platform, userStats.userId], set: {} });
      }

      if (data.messages?.length) {
        await db.insert(messages).values(data.messages)
          .onConflictDoUpdate({ target: messages.id, set: {} });
      }

      if (data.botState?.length) {
        await db.insert(botState).values(data.botState)
          .onConflictDoUpdate({ target: botState.platform, set: {} });
      }

      if (data.botResponses?.length) {
        await db.insert(botResponses).values(data.botResponses)
          .onConflictDoUpdate({ target: botResponses.id, set: {} });
      }
    };

    await transaction();
  }
}

export const storage = new DatabaseStorage();