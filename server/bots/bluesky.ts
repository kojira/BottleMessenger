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

  constructor(credentials: BlueskyCredentials) {
    this.credentials = credentials;
    this.agent = new BskyAgent({ service: 'https://bsky.social' });
  }

  async connect() {
    if (!this.agent.session) {
      try {
        console.log('Connecting to Bluesky...', this.credentials.identifier);
        await this.agent.login({
          identifier: this.credentials.identifier,
          password: this.credentials.password
        });
        console.log('Successfully connected to Bluesky');
      } catch (error) {
        console.error('Failed to connect to Bluesky:', error);
        throw error;
      }
    }
  }

  async sendDM(recipient: string, content: string): Promise<string | null> {
    try {
      await this.connect();

      if (!this.agent.session?.did) {
        throw new Error('Not authenticated');
      }

      console.log(`Sending DM to ${recipient}: ${content}`);

      const response = await this.agent.api.app.bsky.feed.post.create(
        { repo: this.agent.session.did },
        {
          text: content,
          createdAt: new Date().toISOString(),
        }
      );

      console.log('DM sent successfully');
      return response.uri;
    } catch (error) {
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
      await this.connect();
      console.log('Starting Bluesky DM watch...');
      this.isWatching = true;

      // Poll for new notifications every 30 seconds
      this.watchInterval = setInterval(async () => {
        try {
          const notifications = await this.agent.api.app.bsky.notification.listNotifications();

          for (const notification of notifications.data.notifications) {
            // Check if it's a direct message
            if (notification.reason === 'mention' && !notification.isRead) {
              const post = notification.record as any;
              if (post.text && post.text.startsWith('/')) {
                console.log('Received command from:', notification.author.handle);

                const response = await commandHandler.handleCommand(
                  'bluesky',
                  notification.author.did,
                  post.text
                );

                if (response.content) {
                  await this.sendDM(notification.author.handle, response.content);
                }
              }
            }
          }

          // Mark notifications as read
          if (notifications.data.notifications.length > 0) {
            await this.agent.api.app.bsky.notification.updateSeen({
              seenAt: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Error checking Bluesky notifications:', error);
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