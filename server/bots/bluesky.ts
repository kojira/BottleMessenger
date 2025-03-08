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
  private lastLoginAt: number = 0;
  private lastNotificationId: string | undefined;
  private readonly LOGIN_COOLDOWN = 5 * 60 * 1000; // 5分

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

      const response = await this.agent.post({
        text: `@${recipient} ${content}`,
        reply: undefined,
        embed: undefined,
        langs: ['ja']
      });

      console.log('DM sent successfully:', response.uri);
      return response.uri;
    } catch (error) {
      console.error('Failed to send Bluesky DM:', error);
      return null;
    }
  }

  private async decryptDM(notification: any): Promise<string | null> {
    try {
      console.log('Checking notification record:', {
        type: notification.reason,
        uri: notification.uri,
        cid: notification.cid,
        author: notification.author.handle
      });

      if (!notification.record) {
        console.log('No record found in notification');
        return null;
      }

      console.log('Record details:', {
        type: notification.record.$type,
        text: notification.record.text,
        createdAt: notification.record.createdAt
      });

      // 投稿の詳細を取得
      if (notification.uri) {
        try {
          const postView = await this.agent.getPostThread({
            uri: notification.uri,
            depth: 0
          });

          if (postView.success) {
            const post = postView.data.thread.post;
            console.log('Post content:', {
              text: post.record.text,
              hasReply: !!post.record.reply,
              createdAt: post.record.createdAt
            });
            return post.record.text;
          }
        } catch (error) {
          console.error('Failed to fetch post details:', error);
        }
      }

      // 投稿の詳細が取得できない場合は、通知のレコードから直接取得を試みる
      if (notification.record.$type === 'app.bsky.feed.post') {
        return notification.record.text;
      }

      return null;
    } catch (error) {
      console.error('Failed to decrypt DM:', error);
      return null;
    }
  }

  async checkNotifications() {
    try {
      await this.ensureSession();
      console.log('Checking Bluesky notifications...');

      const params: any = {
        limit: 20
      };

      const response = await this.agent.listNotifications(params);

      if (response.data.notifications.length > 0) {
        console.log(`Found ${response.data.notifications.length} notifications`);

        // 通知を古い順に処理
        for (const notification of [...response.data.notifications].reverse()) {
          try {
            // DMとメンションの両方をチェック
            console.log('Processing notification:', {
              type: notification.reason,
              author: notification.author.handle,
              isRead: notification.isRead,
              indexedAt: notification.indexedAt
            });

            const message = await this.decryptDM(notification);
            if (message) {
              console.log('Successfully decoded message:', message);

              if (message.startsWith('/')) {
                console.log('Processing command from:', notification.author.handle);
                const response = await commandHandler.handleCommand(
                  'bluesky',
                  notification.author.did,
                  message
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
        await storage.updateBotState('bluesky', new Date());
        console.log('Updated bot state timestamp');
      }
    } catch (error) {
      console.error('Failed to check Bluesky notifications:', error);
      throw error;
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
          console.log('Restored last processed time:', state.lastProcessedAt.toISOString());
        } else {
          console.log('No previous state found, starting fresh');
        }
      } catch (error) {
        console.error('Error retrieving bot state:', error);
      }

      // 初回の通知チェック
      await this.checkNotifications();
      console.log('Bluesky DM watch started');
    } catch (error) {
      console.error('Failed to start Bluesky DM watch:', error);
      this.isWatching = false;
      throw error;
    }
  }

  cleanup() {
    console.log('Cleaning up Bluesky bot...');
    this.isWatching = false;
  }
}