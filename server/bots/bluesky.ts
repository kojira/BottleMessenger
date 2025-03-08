import { BskyAgent } from '@atproto/api';
import { commandHandler } from './command-handler';

interface BlueskyCredentials {
  identifier: string;
  password: string;
}

export class BlueskyBot {
  private agent: BskyAgent;
  private credentials: BlueskyCredentials;
  private isWatching: boolean = false;
  private watchInterval: NodeJS.Timeout | null = null;
  private lastSeenAt: string | undefined;
  private lastLoginAt: number = 0;
  private readonly LOGIN_COOLDOWN = 5 * 60 * 1000; // 5分のクールダウン

  constructor(credentials: BlueskyCredentials) {
    this.credentials = credentials;
    this.agent = new BskyAgent({ service: 'https://bsky.social' });
  }

  private async ensureSession() {
    if (!this.agent.session) {
      // 初回ログインまたはセッション切れの場合
      console.log('No active session, logging in...');
      await this.connect();
    } else if (Date.now() - this.lastLoginAt > this.LOGIN_COOLDOWN) {
      // セッションは存在するが、クールダウン時間を超えている場合は再ログイン
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

      // DMを送信
      const response = await this.agent.com.atproto.repo.createRecord({
        repo: this.agent.session.did,
        collection: 'app.bsky.feed.post',
        record: {
          text: content,
          createdAt: new Date().toISOString(),
          facets: [],
          langs: ['ja'],
          reply: undefined,
          embed: undefined,
          labels: undefined
        }
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

      // Poll for new notifications every 30 seconds
      this.watchInterval = setInterval(async () => {
        try {
          await this.ensureSession();
          console.log('Checking for new Bluesky notifications...');
          const response = await this.agent.listNotifications({
            limit: 20,
            seenAt: this.lastSeenAt
          });

          if (response.data.notifications.length > 0) {
            console.log(`Found ${response.data.notifications.length} new notifications`);
          }

          for (const notification of response.data.notifications) {
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

          // Update seen marker
          if (response.data.notifications.length > 0) {
            this.lastSeenAt = new Date().toISOString();
            await this.agent.updateSeenNotifications();
            console.log('Updated seen notifications timestamp');
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