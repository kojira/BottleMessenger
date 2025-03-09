import { SimplePool, getPublicKey, nip04, getEventHash, signEvent, type Filter } from 'nostr-tools';
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
  private isWatching = false;
  private lastProcessedAt: number | null = null;
  private statsInterval: NodeJS.Timeout | null = null;

  constructor(credentials: NostrCredentials, relays?: string[]) {
    console.log('Initializing NostrBot...');
    this.credentials = credentials;
    this.relayUrls = relays || ['wss://relay.damus.io', 'wss://nos.lol'];
    this.pool = new SimplePool();
  }

  // リレーURLの更新メソッドを追加
  updateRelays(relays: string[]) {
    console.log('Updating Nostr relays to:', relays);
    this.relayUrls = relays;

    // 既存の接続を閉じて再接続
    if (this.isWatching) {
      this.cleanup();
      this.watchDMs().catch(error => {
        console.error('Failed to restart Nostr bot after relay update:', error);
      });
    }
  }

  async sendDM(recipient: string, content: string): Promise<string | null> {
    try {
      const privateKey = this.credentials.privateKey;
      const pubkey = getPublicKey(privateKey);

      console.log(`Sending DM from ${pubkey} to ${recipient}`);
      console.log('DM content:', content);

      const encryptedContent = await nip04.encrypt(
        privateKey,
        recipient,
        content
      );

      const event: NostrEvent = {
        kind: 4,
        pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', recipient]],
        content: encryptedContent
      };

      event.id = getEventHash(event);
      event.sig = signEvent(event, privateKey);

      console.log('Attempting to publish event:', { ...event, content: '[encrypted]' });

      // Publish to relay
      try {
        await this.pool.publish(this.relayUrls, event);
        console.log('Successfully published DM');
        return event.id;
      } catch (error) {
        console.error('Failed to publish DM:', error);
        return null;
      }
    } catch (error) {
      console.error('Failed to send Nostr DM:', error);
      return null;
    }
  }

  private async initializeState(): Promise<void> {
    // 前回の処理時刻を取得
    try {
      const state = await storage.getBotState('nostr');
      if (state) {
        this.lastProcessedAt = Math.floor(state.lastProcessedAt.getTime() / 1000);
        console.log('Restored last processed time:', this.lastProcessedAt);
      } else {
        // 初回起動時は現在時刻を設定（新規メッセージのみを処理）
        this.lastProcessedAt = Math.floor(Date.now() / 1000);
        await storage.updateBotState('nostr', new Date(this.lastProcessedAt * 1000));
        console.log('Initialized last processed time (current):', this.lastProcessedAt);
      }
    } catch (error) {
      console.error('Error initializing bot state:', error);
      // エラー時は現在時刻を設定
      this.lastProcessedAt = Math.floor(Date.now() / 1000);
      try {
        await storage.updateBotState('nostr', new Date(this.lastProcessedAt * 1000));
      } catch (e) {
        console.error('Failed to save initial bot state:', e);
      }
    }
  }

  private async publishEvent(content: string, kind: number = 1): Promise<string | null> {
    try {
      const privateKey = this.credentials.privateKey;
      const pubkey = getPublicKey(privateKey);

      const event: NostrEvent = {
        kind,
        pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content
      };

      event.id = getEventHash(event);
      event.sig = signEvent(event, privateKey);

      console.log('Attempting to publish event:', { ...event, content });

      try {
        await this.pool.publish(this.relayUrls, event);
        console.log('Successfully published event');
        return event.id;
      } catch (error) {
        console.error('Failed to publish event:', error);
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

      const content = `📊 Nostrボットの状態
🌊 ボトル：${activeBottles}通が漂流中、${archivedBottles}通が受け取られました
💬 返信：${totalReplies}通の返信が届いています`;

      await this.publishEvent(content);
    } catch (error) {
      console.error('Failed to report stats:', error);
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

      // 初回の統計情報投稿
      await this.reportStats();
      console.log('Initial stats report posted');

      // 10分ごとに統計情報を投稿
      this.statsInterval = setInterval(async () => {
        try {
          await this.reportStats();
          console.log('Periodic stats report posted');
        } catch (error) {
          console.error('Error in periodic stats report:', error);
        }
      }, 10 * 60 * 1000); // 10分

      // 初期化時に状態を復元
      await this.initializeState();
      console.log('Bot state initialized');

      console.log('Watching for DMs to pubkey:', pubkey);
      console.log('Current lastProcessedAt:', this.lastProcessedAt);

      const filter: Filter = {
        kinds: [4],
        '#p': [pubkey],
        since: this.lastProcessedAt || Math.floor(Date.now() / 1000)  // 現在時刻（UTC）を使用, or last processed time if available
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
          const response = await commandHandler.handleCommand(
            'nostr',
            event.pubkey,
            content
          );

          if (response.content) {
            console.log('Sending response:', response.content);
            await this.sendDM(event.pubkey, response.content);
            console.log('Response sent successfully');
          }

          // メッセージを処理した後にlastProcessedAtを更新
          this.lastProcessedAt = event.created_at;
          await storage.updateBotState('nostr', new Date(event.created_at * 1000));
          console.log('Updated last processed time:', new Date(event.created_at * 1000));

        } catch (error) {
          console.error('Failed to process DM:', error);
        }
      });

      this.activeSubscriptions.push(sub);
      this.isWatching = true;
      console.log('Nostr DM watch started successfully');
    } catch (error) {
      console.error('Failed to watch Nostr DMs:', error);
      this.isWatching = false;
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up Nostr bot...');
    this.isWatching = false;
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    this.closeSubscriptions();
    await this.pool.close();
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
}