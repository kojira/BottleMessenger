import { SimplePool, getPublicKey, nip04, getEventHash, signEvent, type Filter, type Event, type UnsignedEvent } from 'nostr-tools';
import { commandHandler } from './command-handler';
import WebSocket from 'ws';
import { storage } from '../storage';

// Set WebSocket implementation for nostr-tools
(globalThis as any).WebSocket = WebSocket;

interface NostrCredentials {
  privateKey: string;
}

interface NostrEvent {
  kind: number;
  pubkey: string;
  created_at: number;
  tags: string[][];
  content: string;
  id?: string;
  sig?: string;
}

export class NostrBot {
  private credentials: NostrCredentials;
  private pool: SimplePool;
  private relayUrls: string[];
  private activeSubscriptions: ReturnType<SimplePool['sub']>[] = [];
  private isWatching: boolean = false;
  private statsInterval: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly RECONNECT_DELAY = 5000; // 5秒後に再接続
  private readonly MAX_RETRIES = 5; // 最大再試行回数
  private retryCount = 0;

  constructor(credentials: NostrCredentials, relays?: string[]) {
    console.log('Initializing NostrBot...');
    this.credentials = credentials;
    this.relayUrls = relays || ['wss://relay.damus.io', 'wss://nos.lol'];
    this.pool = new SimplePool();
  }

  private async reconnect() {
    if (this.retryCount >= this.MAX_RETRIES) {
      console.error('Max retry attempts reached. Stopping reconnection attempts.');
      return;
    }

    try {
      this.retryCount++;
      console.log(`Attempting to reconnect (attempt ${this.retryCount}/${this.MAX_RETRIES})...`);

      await this.cleanup();
      this.pool = new SimplePool();
      await this.watchDMs();

      this.retryCount = 0; // 成功したらリトライカウントをリセット
      console.log('Successfully reconnected to relays');
    } catch (error) {
      console.error('Reconnection attempt failed:', error);
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
      }
      this.reconnectTimer = setTimeout(() => {
        this.reconnect().catch(error => {
          console.error('Error during reconnect:', error);
        });
      }, this.RECONNECT_DELAY);
    }
  }

  async sendDM(recipientDid: string, content: string): Promise<string | null> {
    try {
      const privateKey = this.credentials.privateKey;
      const pubkey = getPublicKey(privateKey);

      console.log(`Sending DM from ${pubkey} to ${recipientDid}`);
      console.log('DM content:', content);

      const encryptedContent = await nip04.encrypt(
        privateKey,
        recipientDid,
        content
      );

      const unsignedEvent: UnsignedEvent = {
        kind: 4,
        pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', recipientDid]],
        content: encryptedContent
      };

      const event: Event = {
        ...unsignedEvent,
        id: getEventHash(unsignedEvent),
        sig: signEvent(unsignedEvent, privateKey)
      };

      console.log('Attempting to publish event:', { ...event, content: '[encrypted]' });

      try {
        await this.pool.publish(this.relayUrls, event);
        console.log('Successfully published DM');
        return event.id;
      } catch (error) {
        console.error('Failed to publish DM:', error);
        await this.reconnect();
        return null;
      }
    } catch (error) {
      console.error('Failed to send Nostr DM:', error);
      return null;
    }
  }

  private async publishEvent(content: string, kind: number = 1): Promise<string | null> {
    try {
      const privateKey = this.credentials.privateKey;
      const pubkey = getPublicKey(privateKey);

      const unsignedEvent: UnsignedEvent = {
        kind,
        pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content
      };

      const event: Event = {
        ...unsignedEvent,
        id: getEventHash(unsignedEvent),
        sig: signEvent(unsignedEvent, privateKey)
      };

      console.log('Attempting to publish event:', { ...event, content });

      try {
        await this.pool.publish(this.relayUrls, event);
        console.log('Successfully published event');
        return event.id;
      } catch (error) {
        console.error('Failed to publish event:', error);
        await this.reconnect();
        return null;
      }
    } catch (error) {
      console.error('Failed to create Nostr event:', error);
      return null;
    }
  }

  private async reportStats() {
    try {
      const stats = await storage.getGlobalStats();
      const platformStats = stats.platformStats.find(s => s.platform === 'nostr');

      if (!platformStats) return;

      const activeBottles = stats.activeBottles;
      const archivedBottles = stats.totalBottles - activeBottles;
      const totalReplies = platformStats.replyCount;

      // 自動投稿用のメッセージテンプレートを取得
      let autoPostTemplate = await this.getAutoPostTemplate();
      
      // テンプレートが取得できなかった場合はデフォルトのメッセージを使用
      if (!autoPostTemplate) {
        autoPostTemplate = `📊 Nostrボットの状態
🌊 ボトル：{activeBottles}通が漂流中、{archivedBottles}通が受け取られました
💬 返信：{totalReplies}通の返信が届いています`;
      }

      // テンプレート内の変数を置換
      const content = autoPostTemplate
        .replace(/{activeBottles}/g, activeBottles.toString())
        .replace(/{archivedBottles}/g, archivedBottles.toString())
        .replace(/{totalReplies}/g, totalReplies.toString())
        .replace(/{totalBottles}/g, stats.totalBottles.toString());

      await this.publishEvent(content);
    } catch (error) {
      console.error('Failed to report stats:', error);
    }
  }

  private async getAutoPostTemplate(): Promise<string | null> {
    try {
      // データベースから自動投稿用のメッセージテンプレートを取得
      const responses = await storage.getBotResponses();
      const autoPostResponse = responses.find(
        r => r.platform === 'nostr' && r.responseType === 'auto_post'
      );
      
      return autoPostResponse ? autoPostResponse.message : null;
    } catch (error) {
      console.error('Failed to get auto post template:', error);
      return null;
    }
  }

  async watchDMs(): Promise<void> {
    if (this.isWatching) {
      console.log('Already watching for DMs');
      return;
    }

    try {
      console.log('Starting to watch for Nostr DMs...');

      const privateKey = this.credentials.privateKey;
      const pubkey = getPublicKey(privateKey);

      // 設定を取得
      const settings = await storage.getSettings();
      const autoPostEnabled = settings?.nostrAutoPostEnabled === 'true';
      const autoPostInterval = settings?.nostrAutoPostInterval || 10;
      
      console.log(`Nostr auto-posting: ${autoPostEnabled ? 'enabled' : 'disabled'}, interval: ${autoPostInterval} minutes`);

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

      console.log('Watching for DMs to pubkey:', pubkey);

      const filter: Filter = {
        kinds: [4],
        '#p': [pubkey],
        since: Math.floor(Date.now() / 1000)  // 常に現在時刻以降のメッセージのみを取得
      };

      console.log('Using filter:', filter);

      // Create subscription
      console.log('Creating subscription with filter:', filter);
      const sub = this.pool.sub(this.relayUrls, [filter]);

      sub.on('event', async (event: NostrEvent) => {
        try {
          // Skip own messages
          if (event.pubkey === pubkey) {
            console.log('Skipping own message');
            return;
          }

          console.log('Received encrypted DM:', {
            from: event.pubkey,
            created_at: event.created_at
          });

          const content = await nip04.decrypt(
            privateKey,
            event.pubkey,
            event.content
          );

          console.log('Decrypted DM content:', content);

          // Process command and send response
          await storage.updateUserLastActivity("nostr", event.pubkey);
          const response = await commandHandler.handleCommand(
            'nostr',
            event.pubkey,
            content
          );

          if (response.content) {
            console.log('Sending response:', response.content);
            // Nostrでのコマンド実行を記録する（Active Usersカウント用）
            await storage.incrementUserStat("nostr", event.pubkey, "repliesSent");
            await this.sendDM(event.pubkey, response.content);
            console.log('Response sent successfully');
          }

        } catch (error) {
          console.error('Failed to process DM:', error);
        }
      });

      sub.on('eose', () => {
        console.log('End of stored events');
      });

      (sub as any).on('error', (error: any) => {
        console.error('Subscription error:', error);
        this.reconnect().catch(error => {
          console.error('Error during reconnect:', error);
        });
      });

      this.activeSubscriptions.push(sub);
      this.isWatching = true;
      console.log('Nostr DM watch started successfully');
    } catch (error) {
      console.error('Failed to watch Nostr DMs:', error);
      this.isWatching = false;
      throw error; // 上位のエラーハンドラーで処理される
    }
  }

  private closeSubscriptions(): void {
    this.activeSubscriptions.forEach(sub => {
      try {
        sub.unsub();
      } catch (error) {
        console.error('Error closing subscription:', error);
      }
    });
    this.activeSubscriptions = [];
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up Nostr bot...');
    this.isWatching = false;
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.closeSubscriptions();
    try {
      await this.pool.close(this.relayUrls);
    } catch (error) {
      console.error('Error closing pool:', error);
    }
  }
}
