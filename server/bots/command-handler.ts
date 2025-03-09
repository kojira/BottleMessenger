import { storage } from "../storage";
import { type InsertBottle, type InsertBottleReply, type InsertUserStats, bottleStatusSchema } from "@shared/schema";
import { messageRelay } from './message-relay';

interface CommandResponse {
  content: string;
  error?: boolean;
}

export class CommandHandler {
  async handleCommand(platform: string, userId: string, command: string): Promise<CommandResponse> {
    const parts = command.trim().split(/\s+/);
    let cmd = parts[0].toLowerCase();

    // スラッシュがある場合は削除
    if (cmd.startsWith('/')) {
      cmd = cmd.substring(1);
    }

    // bottle コマンドの場合は第2引数を取得
    if (cmd === 'bottle' && parts.length > 1) {
      cmd = parts[1].toLowerCase();
      parts.splice(1, 1); // 第2引数を削除
    }

    console.log(`Handling command: ${cmd} from ${platform}:${userId}`);

    try {
      switch (cmd) {
        case "help":
          return this.handleHelp();

        // newコマンドとそのエイリアス
        case "new":
        case "流す":
          return await this.handleNewBottle(platform, userId, parts.slice(1).join(" "));

        // checkコマンドとそのエイリアス
        case "check":
        case "拾う":
          return await this.handleCheckBottle(platform, userId);

        // replyコマンドとそのエイリアス
        case "reply":
        case "返信":
          return await this.handleReplyBottle(platform, userId, parts[1], parts.slice(2).join(" "));

        // listコマンドとそのエイリアス
        case "list":
        case "リスト":
          return await this.handleListBottles(platform, userId);

        case "stats":
          return await this.handleStats(platform, userId);

        default:
          return { content: "無効なコマンドです。helpで使用可能なコマンドを確認できます。", error: true };
      }
    } catch (error) {
      console.error("Command handling error:", error);
      return { content: "コマンドの実行中にエラーが発生しました。", error: true };
    }
  }

  private handleHelp(): CommandResponse {
    return {
      content: `使用可能なコマンド:
new [メッセージ] または 流す [メッセージ] - 新しいボトルメールを作成
check または 拾う - 未読のボトルメールを確認
reply [ID] [メッセージ] または 返信 [ID] [メッセージ] - ボトルメールに返信
list または リスト - 送信したボトルメールの一覧
stats - 統計情報を表示
help - このヘルプを表示

※コマンドの先頭のスラッシュ (/) は省略可能です。`
    };
  }

  // 他のメソッドは変更なし
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

    // ボトルを取得したら即座にアーカイブ
    await storage.archiveBottle(bottle.id);
    await storage.incrementUserStat(platform, userId, "bottlesReceived");

    console.log(`Found and archived bottle #${bottle.id}`);
    return { content: `ボトルメール #${bottle.id}\n\n${bottle.content}\n\nfrom ${bottle.senderPlatform}` };
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

    // 元の送信者に返信があったことを通知
    console.log('Notifying original sender:', {
      platform: bottle.senderPlatform,
      userId: bottle.senderId
    });

    try {
      // プラットフォーム特有の送信者識別子を使用
      const sourceUser = bottle.senderPlatform === 'bluesky' ? bottle.senderId : 
        bottle.senderPlatform === 'nostr' ? bottle.senderId : 
        bottle.senderId;  // デフォルトは元の送信者ID

      await messageRelay.relayMessage({
        sourcePlatform: platform,
        sourceId: userId,
        sourceUser,  // プラットフォームに応じた送信者識別子を使用
        targetPlatform: bottle.senderPlatform,
        content: `あなたのボトルメール #${id} に返信がありました:\n\n${content}\n\nfrom ${platform}`,
        status: "pending"
      });
      console.log('Notification sent to original sender');
    } catch (error) {
      console.error('Failed to notify original sender:', error);
    }

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