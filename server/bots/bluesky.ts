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

      // 送信先のプロファイルを取得してDIDを取得
      const profile = await this.agent.getProfile({ actor: recipient });
      if (!profile.success) {
        throw new Error('Failed to get recipient profile');
      }

      // DMとして送信
      const response = await this.agent.com.atproto.repo.createRecord({
        repo: this.agent.session?.did,
        collection: 'app.bsky.feed.post',
        record: {
          $type: 'app.bsky.feed.post',
          text: content,
          createdAt: new Date().toISOString(),
          reply: undefined,
          embed: undefined,
          facets: undefined,
          labels: undefined,
        }
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
      console.log('Checking Bluesky messages...');

      // DMを取得
      const response = await this.agent.api.app.bsky.feed.getAuthorFeed({
        actor: this.agent.session?.did,
        limit: 20,
      });

      console.log(`Found ${response.data.feed.length} messages`);

      for (const item of response.data.feed) {
        try {
          const post = item.post;
          console.log('Processing message:', {
            text: post.record.text,
            author: post.author.handle,
            type: post.record.$type
          });

          if (post.record.text.startsWith('/')) {
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
        } catch (error) {
          console.error('Error processing message:', error);
        }
      }

      await storage.updateBotState('bluesky', new Date());
      console.log('Updated bot state timestamp');

    } catch (error) {
      console.error('Failed to check Bluesky messages:', error);
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