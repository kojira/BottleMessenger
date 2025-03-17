import { storage } from "../storage";
import { type InsertBottle, type InsertBottleReply, type BotResponse } from "@shared/schema";
import { messageRelay } from './message-relay';

interface CommandResponse {
  content: string;
  error?: boolean;
}

export class CommandHandler {
  // プラットフォームとレスポンスタイプに基づいてカスタム応答を取得
  private async getResponse(platform: string, responseType: string, defaultMessage: string): Promise<string> {
    try {
      const responses = await storage.getBotResponses();
      const response = responses.find(r => 
        r.platform === platform && 
        r.responseType === responseType
      );
      
      return response ? response.message : defaultMessage;
    } catch (error) {
      console.error(`Error getting custom response for ${platform}/${responseType}:`, error);
      return defaultMessage;
    }
  }
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

    // コマンドをログに記録
    try {
      await storage.logCommand(platform, userId, command);
    } catch (error) {
      console.error('Failed to log command:', error);
      // コマンドログの記録に失敗しても処理は続行
    }

    try {
      switch (cmd) {
        case "help":
        case "ヘルプ":
          return await this.handleHelp(platform);

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
          const errorMessage = await this.getResponse(platform, "error_invalid_command", "無効なコマンドです。helpで使用可能なコマンドを確認できます。");
          return { content: errorMessage, error: true };
      }
    } catch (error) {
      console.error("Command handling error:", error);
      const errorMessage = await this.getResponse(platform, "error", "コマンドの実行中にエラーが発生しました。");
      return { content: errorMessage, error: true };
    }
  }

  private async handleHelp(platform: string): Promise<CommandResponse> {
    const defaultHelpMessage = `使用可能なコマンド:
new [メッセージ] または 流す [メッセージ] - 新しいボトルメールを作成
check または 拾う - 未読のボトルメールを確認
reply [ID] [メッセージ] または 返信 [ID] [メッセージ] - ボトルメールに返信
list または リスト - 送信したボトルメールの一覧
stats - 統計情報を表示
help または ヘルプ - このヘルプを表示

※コマンドの先頭のスラッシュ (/) は省略可能です。`;

    const responseContent = await this.getResponse(platform, "help", defaultHelpMessage);
    return { content: responseContent };
  }

  private async handleNewBottle(platform: string, userId: string, content: string): Promise<CommandResponse> {
    if (!content) {
      const errorMessage = await this.getResponse(platform, "error_empty_message", "メッセージを入力してください。");
      return { content: errorMessage, error: true };
    }

    // メッセージの長さを140文字に制限
    if (content.length > 140) {
      const errorMessage = await this.getResponse(platform, "error_message_too_long", "メッセージは140文字以内にしてください。");
      return { content: errorMessage, error: true };
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
    const defaultMessage = "ボトルメールを放流しました！🌊";
    const responseContent = await this.getResponse(platform, "bottle_sent", defaultMessage);
    return { content: responseContent };
  }

  private async handleCheckBottle(platform: string, userId: string): Promise<CommandResponse> {
    console.log(`Checking bottle for ${platform}:${userId}`);

    const bottle = await storage.getRandomActiveBottle(platform, userId);
    if (!bottle) {
      console.log('No active bottles found');
      const errorMessage = await this.getResponse(platform, "error_no_bottles", "現在読めるボトルメールはありません。");
      return { content: errorMessage, error: true };
    }

    // ボトルを取得したら即座にアーカイブ
    await storage.archiveBottle(bottle.id);
    await storage.incrementUserStat(platform, userId, "bottlesReceived");

    // 返信を取得して返信状況を確認
    const replies = await storage.getBottleReplies(bottle.id);
    const repliesText = replies.length > 0
      ? `\n\n返信（${replies.length}件）:\n` + replies.map(r => `- ${r.content}\nfrom ${r.senderPlatform}`).join('\n')
      : '';

    console.log(`Found and archived bottle #${bottle.id}`);
    
    // ボトルの内容を含むテンプレートメッセージ
    const defaultMessage = `ボトルメール #${bottle.id}\n\n${bottle.content}\n\nfrom ${bottle.senderPlatform}${repliesText}`;
    
    // カスタム応答を取得
    const template = await this.getResponse(platform, "bottle_received", "ボトルメール #{id}\n\n{content}\n\nfrom {platform}{replies}");
    
    // テンプレート内の変数を置換
    const responseContent = template
      .replace('{id}', bottle.id.toString())
      .replace('{content}', bottle.content)
      .replace('{platform}', bottle.senderPlatform)
      .replace('{replies}', repliesText);
    
    return { content: responseContent };
  }

  private async handleReplyBottle(
    platform: string,
    userId: string,
    bottleId: string,
    content: string
  ): Promise<CommandResponse> {
    console.log(`Processing reply to bottle #${bottleId} from ${platform}:${userId}`);

    if (!bottleId || !content) {
      const errorMessage = await this.getResponse(platform, "error_missing_id_content", "ボトルメールIDと返信内容を入力してください。");
      return { content: errorMessage, error: true };
    }

    // メッセージの長さを140文字に制限
    if (content.length > 140) {
      const errorMessage = await this.getResponse(platform, "error_message_too_long", "メッセージは140文字以内にしてください。");
      return { content: errorMessage, error: true };
    }

    const id = parseInt(bottleId);
    if (isNaN(id)) {
      const errorMessage = await this.getResponse(platform, "error_invalid_id", "無効なボトルメールIDです。");
      return { content: errorMessage, error: true };
    }

    const bottle = await storage.getBottle(id);
    if (!bottle) {
      console.log(`Bottle #${id} not found`);
      const errorMessage = await this.getResponse(platform, "error_bottle_not_found", "指定されたボトルメールは存在しません。");
      return { content: errorMessage, error: true };
    }

    // 既存の返信を取得
    const existingReplies = await storage.getBottleReplies(id);

    // このボトルに返信しているユーザーを確認
    const replier = existingReplies.find(reply => reply.senderPlatform !== bottle.senderPlatform || reply.senderId !== bottle.senderId);

    // 返信権限チェック：
    // 1. ボトルを拾ったユーザーの場合は常に返信可能
    // 2. ボトルの作成者は、他のユーザーから返信があった場合のみ返信可能
    const isOriginalSender = platform === bottle.senderPlatform && userId === bottle.senderId;
    const canReply = isOriginalSender ? replier !== undefined : !replier || (replier.senderPlatform === platform && replier.senderId === userId);

    if (!canReply) {
      const errorMessage = await this.getResponse(platform, "error_no_reply_permission", "このボトルメールへの返信権限がありません。");
      return { content: errorMessage, error: true };
    }

    const reply: InsertBottleReply = {
      bottleId: id,
      content,
      senderPlatform: platform,
      senderId: userId
    };

    await storage.createBottleReply(reply);
    await storage.incrementUserStat(platform, userId, "repliesSent");

    try {
      // 通知メッセージのテンプレート
      let notificationTemplate;
      let targetUser;
      let targetPlatform;
      
      if (isOriginalSender && replier) {
        // ボトルの作成者からの返信の場合、返信者に通知
        notificationTemplate = await this.getResponse(
          replier.senderPlatform, 
          "reply_notification", 
          `あなたの返信に対して、ボトルメール #{id} の作成者から返信がありました:\n\n{content}\n\nfrom {platform}`
        );
        targetUser = replier.senderId;
        targetPlatform = replier.senderPlatform;
      } else {
        // 返信者からの返信の場合、ボトルの作成者に通知
        notificationTemplate = await this.getResponse(
          bottle.senderPlatform, 
          "reply_notification", 
          `ボトルメール #{id} に返信がありました:\n\n{content}\n\nfrom {platform}`
        );
        targetUser = bottle.senderId;
        targetPlatform = bottle.senderPlatform;
      }
      
      // テンプレート内の変数を置換
      const notificationContent = notificationTemplate
        .replace('{id}', id.toString())
        .replace('{content}', content)
        .replace('{platform}', platform);
      
      // 通知を送信
      await messageRelay.relayMessage({
        sourcePlatform: platform,
        sourceId: userId,
        sourceUser: targetUser,
        targetPlatform: targetPlatform,
        content: notificationContent,
        status: "pending"
      });
    } catch (error) {
      console.error('Failed to notify:', error);
    }

    console.log(`Reply created for bottle #${id}`);
    const defaultMessage = "返信を送信しました！";
    const responseContent = await this.getResponse(platform, "reply_sent", defaultMessage);
    return { content: responseContent };
  }

  private async handleListBottles(platform: string, userId: string): Promise<CommandResponse> {
    console.log(`Listing bottles for ${platform}:${userId}`);

    const bottles = await storage.getUserBottles(platform, userId);
    if (bottles.length === 0) {
      const errorMessage = await this.getResponse(platform, "error_no_bottles_sent", "まだボトルメールを送信していません。");
      return { content: errorMessage, error: true };
    }

    const bottleList = bottles.map(b => {
      const replies = b.replyCount || 0;
      return `#${b.id}: ${b.content.substring(0, 30)}... (返信: ${replies}件)`;
    }).join("\n");

    console.log(`Found ${bottles.length} bottles`);
    
    // デフォルトのリストメッセージ
    const defaultMessage = `あなたのボトルメール一覧:\n${bottleList}`;
    
    // カスタム応答を取得
    const template = await this.getResponse(platform, "list", `あなたのボトルメール一覧:\n{bottleList}`);
    
    // テンプレート内の変数を置換
    const responseContent = template.replace('{bottleList}', bottleList);
    
    return { content: responseContent };
  }

  private async handleStats(platform: string, userId: string): Promise<CommandResponse> {
    console.log(`Getting stats for ${platform}:${userId}`);

    const stats = await storage.getUserStats(platform, userId);
    if (!stats) {
      const errorMessage = await this.getResponse(platform, "error_no_stats", "統計情報がありません。");
      return { content: errorMessage, error: true };
    }

    console.log(`Stats retrieved: sent=${stats.bottlesSent}, received=${stats.bottlesReceived}, replies=${stats.repliesSent}`);
    
    // デフォルトの統計情報メッセージ
    const defaultMessage = `📊 あなたの統計情報
送信したボトルメール: ${stats.bottlesSent}通
受信したボトルメール: ${stats.bottlesReceived}通
送信した返信: ${stats.repliesSent}通
最終アクティビティ: ${stats.lastActivity.toLocaleString()}`;
    
    // カスタム応答を取得
    const template = await this.getResponse(platform, "stats", "📊 あなたの統計情報\n送信したボトルメール: {sent}通\n受信したボトルメール: {received}通\n送信した返信: {replies}通\n最終アクティビティ: {activity}");
    
    // テンプレート内の変数を置換
    const responseContent = template
      .replace('{sent}', stats.bottlesSent.toString())
      .replace('{received}', stats.bottlesReceived.toString())
      .replace('{replies}', stats.repliesSent.toString())
      .replace('{activity}', stats.lastActivity.toLocaleString());
    
    return { content: responseContent };
  }
}

export const commandHandler = new CommandHandler();
