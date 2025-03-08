import { BskyAgent } from '@atproto/api';
import { commandHandler } from './command-handler';
import { storage } from '../storage';

interface BlueskyCredentials {
  identifier: string;
  password: string;
}

export class BlueskyBot {
  private agent: BskyAgent;
  private credentials: BlueskyCredentials;
  private isWatching: boolean = false;
  private watchInterval: NodeJS.Timeout | null = null;
  private lastLoginAt: number = 0;
  private lastNotificationId: string | undefined;
  private readonly LOGIN_COOLDOWN = 5 * 60 * 1000; // 5分のクールダウン

  constructor(credentials: BlueskyCredentials) {
    console.log('Initializing BlueskyBot with handle:', credentials.identifier);
    this.credentials = credentials;
    this.agent = new BskyAgent({ service: 'https://bsky.social' });
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
      console.log('Successfully connected to Bluesky');
    } catch (error) {
      console.error('Failed to connect to Bluesky:', error);
      throw error;
    }
  }

  async sendDM(recipient: string, content: string): Promise<string | null> {
    try {
      await this.ensureSession();

      if (!this.agent.session?.did) {
        throw new Error('Not authenticated');
      }

      console.log(`Sending DM to ${recipient}: ${content}`);

      // メンションを含むDMを作成
      const response = await this.agent.post({
        text: `@${recipient} ${content}`,
        reply: undefined,
        embed: undefined,
        langs: ['ja']
      });

      console.log('DM sent successfully:', response.uri);
      return response.uri;
    } catch (error) {
      if (error instanceof Error && error.message.includes('rate limit')) {
        console.log('Hit rate limit, waiting before retry...');
        await new Promise(resolve => setTimeout(resolve, 60000)); // 1分待機
        return this.sendDM(recipient, content); // リトライ
      }
      console.error('Failed to send Bluesky DM:', error);
      return null;
    }
  }

  async watchDMs() {
    if (this.isWatching) {
      console.log('Already watching Bluesky DMs');
      return;
    }

    try {
      await this.ensureSession();
      console.log('Starting Bluesky DM watch...');
      this.isWatching = true;

      // 前回の処理時刻を取得
      try {
        const state = await storage.getBotState('bluesky');
        if (state) {
          const lastProcessed = new Date(state.lastProcessedAt);
          console.log('Restored last processed time:', lastProcessed.toISOString());
          // 最後の処理時刻の5分前から取得（念のため）
          lastProcessed.setMinutes(lastProcessed.getMinutes() - 5);
          this.lastNotificationId = lastProcessed.toISOString();
        } else {
          console.log('No previous state found, starting fresh');
        }
      } catch (error) {
        console.error('Error retrieving bot state:', error);
        // エラーが発生しても処理は継続
      }

      // Poll for new notifications every 30 seconds
      this.watchInterval = setInterval(async () => {
        try {
          await this.ensureSession();
          console.log('Checking for new Bluesky notifications...');

          // 通知を新しい順に取得
          const response = await this.agent.listNotifications({
            limit: 20,
            cursor: this.lastNotificationId
          });

          if (response.data.notifications.length > 0) {
            console.log(`Found ${response.data.notifications.length} new notifications`);

            // 通知を古い順に処理
            for (const notification of [...response.data.notifications].reverse()) {
              try {
                // メンションを含む投稿を検出
                if (notification.reason === 'mention') {
                  console.log('Processing notification:', {
                    type: notification.reason,
                    author: notification.author.handle,
                    record: notification.record
                  });

                  const post = notification.record as any;
                  if (post.text && post.text.startsWith('/')) {
                    console.log('Received command from:', notification.author.handle);
                    console.log('Command content:', post.text);

                    const response = await commandHandler.handleCommand(
                      'bluesky',
                      notification.author.did,
                      post.text
                    );

                    if (response.content) {
                      console.log('Sending response:', response.content);
                      await this.sendDM(notification.author.handle, response.content);
                    }
                  }
                }
              } catch (error) {
                console.error('Error processing notification:', error);
              }
            }

            // 最後の通知のIDを保存
            this.lastNotificationId = response.data.notifications[0].uri;

            // データベースに最終処理時刻を保存
            try {
              await storage.updateBotState('bluesky', new Date());
              console.log('Updated bot state timestamp');
            } catch (error) {
              console.error('Error updating bot state:', error);
            }
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes('rate limit')) {
            console.log('Hit rate limit, waiting before next check...');
            // エラーをスローせず、次のインターバルまで待機
          } else {
            console.error('Error checking Bluesky notifications:', error);
          }
        }
      }, 30000);

      console.log('Bluesky DM watch started');
    } catch (error) {
      console.error('Failed to start Bluesky DM watch:', error);
      this.isWatching = false;
      if (this.watchInterval) {
        clearInterval(this.watchInterval);
      }
      throw error;
    }
  }

  cleanup() {
    this.isWatching = false;
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
    }
  }
}