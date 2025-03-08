import { storage } from "../storage";
import { type InsertBottle, type InsertBottleReply, type InsertUserStats, bottleStatusSchema } from "@shared/schema";

interface CommandResponse {
  content: string;
  error?: boolean;
}

export class CommandHandler {
  async handleCommand(platform: string, userId: string, command: string): Promise<CommandResponse> {
    const parts = command.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();

    console.log(`Handling command: ${cmd} from ${platform}:${userId}`);

    try {
      switch (cmd) {
        case "/help":
          return this.handleHelp();
        case "/bottle":
          if (parts.length < 2) {
            return { content: "使用方法: /bottle [new|check|reply|list|stats]", error: true };
          }
          const subCmd = parts[1].toLowerCase();
          switch (subCmd) {
            case "new":
              return await this.handleNewBottle(platform, userId, parts.slice(2).join(" "));
            case "check":
              return await this.handleCheckBottle(platform, userId);
            case "reply":
              return await this.handleReplyBottle(platform, userId, parts[2], parts.slice(3).join(" "));
            case "list":
              return await this.handleListBottles(platform, userId);
            case "stats":
              return await this.handleStats(platform, userId);
            default:
              return { content: "無効なサブコマンドです。/help で使用可能なコマンドを確認できます。", error: true };
          }
        default:
          return { content: "無効なコマンドです。/help で使用可能なコマンドを確認できます。", error: true };
      }
    } catch (error) {
      console.error("Command handling error:", error);
      return { content: "コマンドの実行中にエラーが発生しました。", error: true };
    }
  }

  private handleHelp(): CommandResponse {
    return {
      content: `使用可能なコマンド:
/bottle new [メッセージ] - 新しいボトルメールを作成
/bottle check - 未読のボトルメールを確認
/bottle reply [ID] [メッセージ] - ボトルメールに返信
/bottle list - 送信したボトルメールの一覧
/bottle stats - 統計情報を表示
/help - このヘルプを表示`
    };
  }

  private async handleNewBottle(platform: string, userId: string, content: string): Promise<CommandResponse> {
    if (!content) {
      return { content: "メッセージを入力してください。", error: true };
    }

    console.log(`Creating new bottle from ${platform}:${userId} with content: ${content}`);

    const bottle: InsertBottle = {
      content,
      senderPlatform: platform,
      senderId: userId,
      status: "active"
    };

    await storage.createBottle(bottle);
    await storage.incrementUserStat(platform, userId, "bottlesSent");

    console.log('Bottle created successfully');
    return { content: "ボトルメールを放流しました！🌊" };
  }

  private async handleCheckBottle(platform: string, userId: string): Promise<CommandResponse> {
    console.log(`Checking bottle for ${platform}:${userId}`);

    const bottle = await storage.getRandomActiveBottle(platform, userId);
    if (!bottle) {
      console.log('No active bottles found');
      return { content: "現在読めるボトルメールはありません。" };
    }

    await storage.incrementUserStat(platform, userId, "bottlesReceived");
    console.log(`Found bottle #${bottle.id}`);
    return { content: `ボトルメール #${bottle.id}\n\n${bottle.content}` };
  }

  private async handleReplyBottle(
    platform: string, 
    userId: string, 
    bottleId: string, 
    content: string
  ): Promise<CommandResponse> {
    console.log(`Processing reply to bottle #${bottleId} from ${platform}:${userId}`);

    if (!bottleId || !content) {
      return { content: "ボトルメールIDと返信内容を入力してください。", error: true };
    }

    const id = parseInt(bottleId);
    if (isNaN(id)) {
      return { content: "無効なボトルメールIDです。", error: true };
    }

    const bottle = await storage.getBottle(id);
    if (!bottle) {
      console.log(`Bottle #${id} not found`);
      return { content: "指定されたボトルメールは存在しません。", error: true };
    }

    const reply: InsertBottleReply = {
      bottleId: id,
      content,
      senderPlatform: platform,
      senderId: userId
    };

    await storage.createBottleReply(reply);
    await storage.incrementUserStat(platform, userId, "repliesSent");

    console.log(`Reply created for bottle #${id}`);
    return { content: "返信を送信しました！" };
  }

  private async handleListBottles(platform: string, userId: string): Promise<CommandResponse> {
    console.log(`Listing bottles for ${platform}:${userId}`);

    const bottles = await storage.getUserBottles(platform, userId);
    if (bottles.length === 0) {
      return { content: "まだボトルメールを送信していません。" };
    }

    const bottleList = bottles.map(b => {
      const replies = b.replyCount || 0;
      return `#${b.id}: ${b.content.substring(0, 30)}... (返信: ${replies}件)`;
    }).join("\n");

    console.log(`Found ${bottles.length} bottles`);
    return { content: `あなたのボトルメール一覧:\n${bottleList}` };
  }

  private async handleStats(platform: string, userId: string): Promise<CommandResponse> {
    console.log(`Getting stats for ${platform}:${userId}`);

    const stats = await storage.getUserStats(platform, userId);
    if (!stats) {
      return { content: "統計情報がありません。" };
    }

    console.log(`Stats retrieved: sent=${stats.bottlesSent}, received=${stats.bottlesReceived}, replies=${stats.repliesSent}`);
    return {
      content: `📊 統計情報
送信したボトルメール: ${stats.bottlesSent}通
受信したボトルメール: ${stats.bottlesReceived}通
送信した返信: ${stats.repliesSent}通
最終アクティビティ: ${stats.lastActivity.toLocaleString()}`
    };
  }
}

export const commandHandler = new CommandHandler();