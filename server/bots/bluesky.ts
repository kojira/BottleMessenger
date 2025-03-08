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

  async checkNotifications() {
    try {
      await this.ensureSession();
      console.log('Checking Bluesky notifications...');

      const myHandle = this.credentials.identifier;

      // 通知を取得
      console.log('Fetching notifications...');
      const notifications = await this.agent.listNotifications({
        limit: 20
      });

      console.log(`Found ${notifications.data.notifications.length} notifications`);

      // 通知を古い順に処理
      for (const notification of [...notifications.data.notifications].reverse()) {
        try {
          console.log('Processing notification:', {
            reason: notification.reason,
            author: notification.author.handle,
            uri: notification.uri
          });

          // 投稿の詳細を取得
          const postView = await this.agent.getPostThread({
            uri: notification.uri,
            depth: 0
          });

          if (!postView.success || !postView.data.thread.post) {
            console.log('Failed to get post details');
            continue;
          }

          const post = postView.data.thread.post;
          console.log('Post details:', {
            text: post.record.text,
            author: post.author.handle,
            replyTo: post.record.reply
          });

          // メンションを含むポストのみを処理
          if (post.record.text.includes(`@${myHandle}`)) {
            console.log('Found mention:', post.record.text);

            if (post.record.text.includes('/')) {
              console.log('Processing command from:', post.author.handle);
              const response = await commandHandler.handleCommand(
                'bluesky',
                post.author.did,
                post.record.text
              );

              if (response.content) {
                console.log('Sending response:', response.content);
                await this.sendDM(post.author.handle, response.content);
              }
            }
          }
        } catch (error) {
          console.error('Error processing notification:', error);
        }
      }

      // 処理時刻を更新
      await storage.updateBotState('bluesky', new Date());
      console.log('Updated bot state timestamp');

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