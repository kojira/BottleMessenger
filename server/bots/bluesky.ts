import { AtpAgent } from '@atproto/api';
import { commandHandler } from './command-handler';
import { storage } from '../storage';

interface BlueskyCredentials {
  identifier: string;
  password: string;
}

export class BlueskyBot {
  private agent: AtpAgent;
  private chatAgent: any;
  private credentials: BlueskyCredentials;
  private isWatching: boolean = false;
  private lastLoginAt: number = 0;
  private readonly LOGIN_COOLDOWN = 5 * 60 * 1000; // 5分
  private checkInterval: NodeJS.Timeout | null = null;
  private statsInterval: NodeJS.Timeout | null = null;
  private isCheckingNotifications: boolean = false; // 通知チェック中かどうかのフラグ

  constructor(credentials: BlueskyCredentials) {
    console.log('Initializing BlueskyBot with handle:', credentials.identifier);
    this.credentials = credentials;
    this.agent = new AtpAgent({ service: 'https://bsky.social' });
  }

  private async ensureSession() {
    if (!this.agent.session) {
      console.log('No active session, logging in...');
      await this.connect();
    } else if (Date.now() - this.lastLoginAt > this.LOGIN_COOLDOWN) {
      console.log('Session expired, refreshing...');
      await this.connect();
    }
  }

  async connect() {
    try {
      console.log('Connecting to Bluesky...', this.credentials.identifier);
      await this.agent.login({
        identifier: this.credentials.identifier,
        password: this.credentials.password
      });
      this.lastLoginAt = Date.now();

      // チャットサービスにプロキシを設定
      this.chatAgent = this.agent.withProxy('bsky_chat', 'did:web:api.bsky.chat');
      console.log('Successfully connected to Bluesky and chat service');
    } catch (error) {
      console.error('Failed to connect to Bluesky:', error);
      throw error;
    }
  }

  async sendDM(recipientDid: string, content: string): Promise<string | null> {
    try {
      await this.ensureSession();
      console.log(`Sending DM to ${recipientDid}: ${content}`);

      // 会話を取得または作成
      const convoResponse = await this.chatAgent.chat.bsky.convo.getConvoForMembers({
        members: [recipientDid]
      });
      const convoId = convoResponse.data.convo.id;
      console.log('Conversation ID:', convoId);

      // メッセージを送信
      const response = await this.chatAgent.chat.bsky.convo.sendMessage({
        convoId,
        message: { text: content }
      });

      console.log('DM sent successfully:', response);
      return response?.data?.messageId || null;
    } catch (error) {
      console.error('Failed to send Bluesky DM:', error);
      return null;
    }
  }

  private async processCommand(did: string, text: string) {
    try {
      console.log('Processing command from sender DID:', did);
      const response = await commandHandler.handleCommand(
        'bluesky',
        did,
        text
      );

      if (response.content) {
        console.log('Sending response:', response.content);
        await this.sendDM(did, response.content);
      }
    } catch (error) {
      console.error('Error processing command:', error);
    }
  }

  // 指定時刻より前のメッセージかどうかをチェック
  private isMessageBeforeIgnoreTime(messageTime: Date, ignoreBeforeTime: number | null): boolean {
    if (!ignoreBeforeTime) {
      return false; // 無視する時刻が設定されていない場合は無視しない
    }
    
    const messageTimestamp = messageTime.getTime();
    return messageTimestamp < ignoreBeforeTime;
  }

  private async postStatus(content: string) {
    try {
      await this.ensureSession();
      console.log('Posting status update:', content);

      await this.agent.post({
        text: content,
        createdAt: new Date().toISOString(),
      });

      console.log('Status posted successfully');
    } catch (error) {
      console.error('Failed to post status:', error);
    }
  }

  private async reportStats() {
    try {
      const stats = await storage.getGlobalStats();
      const platformStats = stats.platformStats.find(s => s.platform === 'bluesky');

      if (!platformStats) return;

      const activeBottles = stats.activeBottles;
      const archivedBottles = stats.totalBottles - activeBottles;
      const totalReplies = platformStats.replyCount;

      // 自動投稿用のメッセージテンプレートを取得
      let autoPostTemplate = await this.getAutoPostTemplate();
      
      // テンプレートが取得できなかった場合はデフォルトのメッセージを使用
      if (!autoPostTemplate) {
        autoPostTemplate = `📊 Blueskyボットの状態
🌊 ボトル：{activeBottles}通が漂流中、{archivedBottles}通が受け取られました
💬 返信：{totalReplies}通の返信が届いています`;
      }

      // テンプレート内の変数を置換
      const content = autoPostTemplate
        .replace(/{activeBottles}/g, activeBottles.toString())
        .replace(/{archivedBottles}/g, archivedBottles.toString())
        .replace(/{totalReplies}/g, totalReplies.toString())
        .replace(/{totalBottles}/g, stats.totalBottles.toString());

      await this.postStatus(content);
    } catch (error) {
      console.error('Failed to report stats:', error);
    }
  }

  private async getAutoPostTemplate(): Promise<string | null> {
    try {
      // データベースから自動投稿用のメッセージテンプレートを取得
      const responses = await storage.getBotResponses();
      const autoPostResponse = responses.find(
        r => r.platform === 'bluesky' && r.responseType === 'auto_post'
      );
      
      return autoPostResponse ? autoPostResponse.message : null;
    } catch (error) {
      console.error('Failed to get auto post template:', error);
      return null;
    }
  }

  // 単一の会話を処理するヘルパー関数
  private async processConversation(convo: any, state: any, ignoreBeforeTime: number | null = null) {
    try {
      console.log('Processing conversation:', {
        id: convo.id,
        participants: convo.participants
      });

      const messagesResponse = await this.chatAgent.chat.bsky.convo.getMessages({
        convoId: convo.id,
        limit: 10  // 最新の10件に制限
      });

      console.log(`Retrieved ${messagesResponse.data.messages.length} messages from conversation ${convo.id}`);

      // 最新のメッセージIDを保存（既読マーク用）
      let latestMessageId: string | null = null;
      if (messagesResponse.data.messages.length > 0) {
        latestMessageId = messagesResponse.data.messages[0].id;
      }

      for (const message of messagesResponse.data.messages) {
        // メッセージの詳細をログ出力
        console.log('Processing message:', {
          id: message.id,
          sender: message.sender?.did,
          text: message.text,
          sentAt: message.sentAt
        });

        // 送信者情報の存在確認
        if (!message.sender?.did) {
          console.log('Skipping message with invalid sender');
          continue;
        }

        // 前回の処理時刻以降のメッセージのみを処理
        const messageCreatedAt = new Date(message.sentAt);
        if (state && messageCreatedAt <= state.lastProcessedAt) {
          console.log('Skipping already processed message:', message.sentAt);
          continue;
        }

        // 指定時刻より前のメッセージは無視
        if (this.isMessageBeforeIgnoreTime(messageCreatedAt, ignoreBeforeTime)) {
          console.log(`Skipping message before ignore time: ${message.sentAt}`);
          continue;
        }

        // スラッシュの有無に関わらずすべてのメッセージをコマンドとして処理
        await this.processCommand(message.sender.did, message.text);
      }

      // 会話内のメッセージを処理した後、既読にマークする
      if (latestMessageId) {
        try {
          await this.chatAgent.chat.bsky.convo.updateRead({
            convoId: convo.id,
            messageId: latestMessageId
          });
          console.log(`Marked conversation ${convo.id} as read up to message ${latestMessageId}`);
        } catch (error) {
          console.error(`Failed to mark conversation ${convo.id} as read:`, error);
        }
      }
    } catch (error) {
      console.error('Error processing conversation:', error);
    }
  }

  // 会話を並列処理するためのヘルパー関数
  private async processConversationsInBatches(convos: any[], state: any, ignoreBeforeTime: number | null = null, batchSize: number = 3) {
    // 会話を指定されたバッチサイズで処理
    for (let i = 0; i < convos.length; i += batchSize) {
      const batch = convos.slice(i, i + batchSize);
      console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(convos.length / batchSize)}, size: ${batch.length}`);
      
      // バッチ内の会話を並列処理
      await Promise.all(
        batch.map(convo => this.processConversation(convo, state, ignoreBeforeTime))
      );
    }
  }

  async checkNotifications(ignoreBeforeTime: number | null = null) {
    // 既に通知チェック中の場合は処理をスキップ
    if (this.isCheckingNotifications) {
      console.log('Previous notification check still in progress, skipping this run');
      return;
    }

    this.isCheckingNotifications = true; // チェック開始フラグを設定
    
    try {
      await this.ensureSession();
      console.log('Checking Bluesky DMs...');

      // 前回の処理時刻を取得
      const state = await storage.getBotState('bluesky');
      if (state) {
        console.log('Last processed time:', state.lastProcessedAt.toISOString());
      } else {
        console.log('No previous state found, starting fresh');
      }

      // 全ての会話を取得するためのページネーション処理
      let allConvos: any[] = [];
      let cursor: string | undefined = undefined;
      
      do {
        // 未読の会話リストを取得
        const response: any = await this.chatAgent.chat.bsky.convo.listConvos({
          readState: "unread",
          cursor: cursor
        });
        
        console.log(`Found ${response.data.convos.length} unread conversations${cursor ? ' (pagination)' : ''}`);
        
        // 会話を配列に追加
        allConvos = [...allConvos, ...response.data.convos];
        
        // 次のページがあるかチェック
        cursor = response.data.cursor;
        console.log(`Pagination cursor: ${cursor || 'null'}`);
      } while (cursor);
      
      console.log(`Total unread conversations found: ${allConvos.length}`);

      // 会話を並列処理（3つずつ）
      await this.processConversationsInBatches(allConvos, state, ignoreBeforeTime, 3);

      // 最後の処理時刻を更新
      await storage.updateBotState('bluesky', new Date());
      console.log('Updated bot state timestamp');

    } catch (error) {
      console.error('Failed to check Bluesky DMs:', error);
      throw error;
    } finally {
      // 処理が完了したらフラグをリセット
      this.isCheckingNotifications = false;
      console.log('Notification check completed, ready for next run');
    }
  }

  async watchDMs(ignoreBeforeTime: number | null = null): Promise<void> {
    if (this.isWatching) {
      console.log('Already watching Bluesky DMs');
      return;
    }

    try {
      await this.ensureSession();
      console.log('Starting Bluesky DM watch...');
      
      if (ignoreBeforeTime) {
        console.log(`Will ignore messages before: ${new Date(ignoreBeforeTime).toISOString()}`);
      }

      // 設定を取得
      const settings = await storage.getSettings();
      const autoPostEnabled = settings?.blueskyAutoPostEnabled === 'true';
      const autoPostInterval = settings?.blueskyAutoPostInterval || 10;
      
      console.log(`Bluesky auto-posting: ${autoPostEnabled ? 'enabled' : 'disabled'}, interval: ${autoPostInterval} minutes`);

      // 自動投稿が有効な場合のみ初回の統計情報を投稿
      if (autoPostEnabled) {
        await this.reportStats();
        console.log('Initial stats report posted');

        // 設定された間隔で統計情報を投稿
        this.statsInterval = setInterval(async () => {
          try {
            await this.reportStats();
            console.log(`Periodic stats report posted (interval: ${autoPostInterval} minutes)`);
          } catch (error) {
            console.error('Error in periodic stats report:', error);
          }
        }, autoPostInterval * 60 * 1000); // 分をミリ秒に変換
      } else {
        console.log('Auto-posting is disabled, skipping stats reports');
      }

      // 前回の処理時刻を取得
      try {
        const state = await storage.getBotState('bluesky');
        if (state) {
          console.log('Restored last processed time:', state.lastProcessedAt.toISOString());
        } else {
          console.log('No previous state found, starting fresh');
        }
      } catch (error) {
        console.error('Error retrieving bot state:', error);
      }

      // 初回の通知チェック
      await this.checkNotifications(ignoreBeforeTime);
      console.log('Initial DM check completed');

      // 30秒ごとに通知をチェック
      this.checkInterval = setInterval(async () => {
        try {
          console.log('Running periodic DM check...');
          await this.checkNotifications(ignoreBeforeTime);
          console.log('Periodic DM check completed');
        } catch (error) {
          console.error('Error in periodic DM check:', error);
        }
      }, 30000); // 30秒

      this.isWatching = true;
      console.log('Bluesky DM watch started successfully');
    } catch (error) {
      console.error('Failed to start Bluesky DM watch:', error);
      this.isWatching = false;
      throw error;
    }
  }

  cleanup() {
    console.log('Cleaning up Bluesky bot...');
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    this.isWatching = false;
  }
}
