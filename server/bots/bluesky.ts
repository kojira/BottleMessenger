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
      console.log(`Sending DM to ${recipient}: ${content}`);

      // DMを送信
      const response = await this.agent.api.app.bsky.feed.threadgate.create({
        text: content,
        recipients: [recipient],
        createdAt: new Date().toISOString()
      });

      console.log('DM sent successfully:', response);
      return response?.uri || null;
    } catch (error) {
      console.error('Failed to send Bluesky DM:', error);
      return null;
    }
  }

  async checkNotifications() {
    try {
      await this.ensureSession();
      console.log('Checking Bluesky DMs...');

      // DMを取得
      const response = await this.agent.api.app.bsky.feed.getTimeline({
        algorithm: 'reverse-chronological',
        limit: 20,
      });

      console.log(`Found ${response.data.feed.length} timeline items`);

      // DMを処理
      for (const item of response.data.feed) {
        try {
          const post = item.post;
          console.log('Processing post:', {
            text: post.record.text,
            author: post.author.handle,
            type: post.record.$type,
            isThreaded: !!post.record.reply
          });

          // DMの場合のみ処理
          if (post.record.$type === 'app.bsky.feed.threadgate' && post.record.text.startsWith('/')) {
            console.log('Found DM with command:', {
              sender: post.author.handle,
              text: post.record.text
            });

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
        } catch (error) {
          console.error('Error processing message:', error);
        }
      }

      await storage.updateBotState('bluesky', new Date());
      console.log('Updated bot state timestamp');

    } catch (error) {
      console.error('Failed to check Bluesky DMs:', error);
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