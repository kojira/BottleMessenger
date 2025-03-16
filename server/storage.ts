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
  getMessagesAndBottles(limit?: number): Promise<Message[]>;
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
  updateBotResponse(id: number, response: InsertBotResponse): Promise<BotResponse>;
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

  async getMessagesAndBottles(limit = 100): Promise<Message[]> {
    // Get messages
    const recentMessages = await this.getMessages(Math.floor(limit / 2));
    console.log('Recent messages:', recentMessages);
    
    // Get bottles
    const recentBottles = await db
      .select()
      .from(bottles)
      .orderBy(sql`${bottles.createdAt} DESC`)
      .limit(Math.floor(limit / 2));
    console.log('Recent bottles:', recentBottles);
    
    // Convert bottles to message format
    const bottlesAsMessages: Message[] = recentBottles.map(bottle => ({
      id: bottle.id + 1000000, // Add offset to avoid ID conflicts
      sourcePlatform: bottle.senderPlatform,
      sourceId: bottle.senderId,
      sourceUser: bottle.senderId,
      targetPlatform: "bottle",
      targetId: null,
      content: bottle.content,
      createdAt: bottle.createdAt,
      status: "sent", // Bottles are always "sent"
      error: null,
      // Add a flag to identify this as a bottle
      isBottle: true
    } as Message & { isBottle: boolean }));
    console.log('Bottles as messages:', bottlesAsMessages);
    
    // Combine and sort by creation date
    const combined = [...recentMessages, ...bottlesAsMessages]
      .sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : Number(a.createdAt);
        const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : Number(b.createdAt);
        return dateB - dateA;
      })
      .slice(0, limit);
    console.log('Combined messages and bottles:', combined);
    
    return combined;
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
    // ボトルとその返信情報を取得
    const bottleResults = await db
      .select()
      .from(bottles)
      .where(
        and(
          eq(bottles.senderPlatform, platform),
          eq(bottles.senderId, userId)
        )
      );
    
    // 各ボトルの返信数と最新の返信日時を取得
    const result: (Bottle & { replyCount: number; latestReplyDate?: Date })[] = [];
    
    for (const bottle of bottleResults) {
      // 返信数を取得
      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(bottleReplies)
        .where(eq(bottleReplies.bottleId, bottle.id));
      
      // 最新の返信日時を取得
      const latestReplies = await db
        .select()
        .from(bottleReplies)
        .where(eq(bottleReplies.bottleId, bottle.id))
        .orderBy(sql`${bottleReplies.createdAt} DESC`)
        .limit(1);
      
      const latestReplyDate = latestReplies.length > 0 
        ? new Date(latestReplies[0].createdAt) 
        : undefined;
      
      result.push({
        ...bottle,
        replyCount: Number(count),
        latestReplyDate
      });
    }
    
    // 最新の返信があるものを優先的に、なければボトル作成日でソート
    result.sort((a, b) => {
      const dateA = a.latestReplyDate || new Date(a.createdAt);
      const dateB = b.latestReplyDate || new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime(); // 降順（最新順）
    });
    
    // 最大10件に制限
    return result.slice(0, 10);
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

    // SQLiteでの日付計算 - 24時間前のタイムスタンプを計算
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // アクティブなユーザー数を取得（過去24時間以内にアクティビティのあるユーザー）
    const [{ activeUsers }] = await db
      .select({ activeUsers: sql<number>`COUNT(DISTINCT "user_id")` })
      .from(userStats)
      .where(
        sql`${userStats.lastActivity} > ${twentyFourHoursAgo.getTime()}`
      );

    // アクティブなボトルの数を取得
    const [{ activeBottles }] = await db
      .select({ activeBottles: sql<number>`COUNT(*)` })
      .from(bottles)
      .where(eq(bottles.status, "active"));

    // SQLiteでの日付計算 - 30日前のタイムスタンプを計算
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // プラットフォーム別の統計を取得
    const platformStats = await db
      .select({
        platform: userStats.platform,
        userCount: sql<number>`COUNT(DISTINCT "user_id")`,
        bottleCount: sql<number>`SUM(${userStats.bottlesSent})`,
        replyCount: sql<number>`SUM(${userStats.repliesSent})`,
        mau: sql<number>`COUNT(DISTINCT CASE 
          WHEN ${userStats.lastActivity} > ${thirtyDaysAgo.getTime()} 
          THEN "user_id" 
          END)`
      })
      .from(userStats)
      .groupBy(userStats.platform);

    // SQLiteでの日付計算 - 7日前のタイムスタンプを計算
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 過去7日間の日別統計を取得
    // SQLiteでは日付関数が異なるため、日付の切り捨てを独自に実装
    const dailyStats = await db
      .select({
        date: sql<string>`date(${bottles.createdAt}/1000, 'unixepoch')`,
        bottleCount: sql<number>`COUNT(*)`,
      })
      .from(bottles)
      .where(sql`${bottles.createdAt} > ${sevenDaysAgo.getTime()}`)
      .groupBy(sql`date(${bottles.createdAt}/1000, 'unixepoch')`)
      .orderBy(sql`date(${bottles.createdAt}/1000, 'unixepoch')`);

    const dailyReplies = await db
      .select({
        date: sql<string>`date(${bottleReplies.createdAt}/1000, 'unixepoch')`,
        replyCount: sql<number>`COUNT(*)`,
      })
      .from(bottleReplies)
      .where(sql`${bottleReplies.createdAt} > ${sevenDaysAgo.getTime()}`)
      .groupBy(sql`date(${bottleReplies.createdAt}/1000, 'unixepoch')`)
      .orderBy(sql`date(${bottleReplies.createdAt}/1000, 'unixepoch')`);

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
      .values({
        ...response,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return created;
  }

  async updateBotResponse(id: number, response: InsertBotResponse): Promise<BotResponse> {
    console.log("Updating bot response:", { id, response });
    
    try {
      const [updated] = await db
        .update(botResponses)
        .set({
          platform: response.platform,
          responseType: response.responseType,
          message: response.message,
          updatedAt: new Date()
        })
        .where(eq(botResponses.id, id))
        .returning();
      
      console.log("Updated bot response:", updated);
      return updated;
    } catch (error) {
      console.error("Error updating bot response:", error);
      throw error;
    }
  }

  async deleteBotResponse(id: number): Promise<void> {
    await db
      .delete(botResponses)
      .where(eq(botResponses.id, id));
  }

  async exportData() {
    try {
      console.log('Starting data export...');

      const results = await Promise.all([
        db.select().from(botSettings),
        db.select().from(bottles),
        db.select().from(bottleReplies),
        db.select().from(userStats),
        db.select().from(messages),
        db.select().from(botState),
        db.select().from(botResponses)
      ]);

      console.log('Export results:', {
        settings: results[0].length,
        bottles: results[1].length,
        bottleReplies: results[2].length,
        userStats: results[3].length,
        messages: results[4].length,
        botState: results[5].length,
        botResponses: results[6].length
      });

      const exportData = {
        settings: results[0],
        bottles: results[1],
        bottleReplies: results[2],
        userStats: results[3],
        messages: results[4],
        botState: results[5],
        botResponses: results[6]
      };

      if (Object.values(exportData).every(arr => !arr?.length)) {
        console.warn('Warning: All exported data arrays are empty');
        throw new Error("データベースにエクスポートできるデータが見つかりませんでした。");
      }

      return exportData;
    } catch (error) {
      console.error('Error in exportData:', error);
      throw error;
    }
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
