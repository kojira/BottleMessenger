import { BskyAgent } from '@atproto/api';
import { commandHandler } from './command-handler';

interface BlueskyCredentials {
  identifier: string;
  password: string;
}

export class BlueskyBot {
  private agent: BskyAgent;
  private credentials: BlueskyCredentials;

  constructor(credentials: BlueskyCredentials) {
    this.credentials = credentials;
    this.agent = new BskyAgent({ service: 'https://bsky.social' });
  }

  async connect() {
    if (!this.agent.session) {
      await this.agent.login({
        identifier: this.credentials.identifier,
        password: this.credentials.password
      });
    }
  }

  async sendDM(recipient: string, content: string): Promise<string | null> {
    try {
      await this.connect();

      if (!this.agent.session?.did) {
        throw new Error('Not authenticated');
      }

      const response = await this.agent.api.app.bsky.feed.post.create(
        { repo: this.agent.session.did },
        {
          text: content,
          createdAt: new Date().toISOString(),
        }
      );
      return response.uri;
    } catch (error) {
      console.error('Failed to send Bluesky DM:', error);
      return null;
    }
  }

  async watchDMs() {
    try {
      await this.connect();
      console.log('Watching for Bluesky DMs...');

      // Here we would implement the actual DM watching logic
      // For now, this is a placeholder as the API is still evolving

      // When a DM is received, we would:
      // 1. Parse the command from the DM content
      // 2. Process it with the command handler
      // const response = await commandHandler.handleCommand(
      //   'bluesky',
      //   senderId,
      //   dmContent
      // );
      // 3. Send the response back to the user
    } catch (error) {
      console.error('Failed to watch Bluesky DMs:', error);
      throw error;
    }
  }
}