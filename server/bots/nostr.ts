import { Bot } from '@shared/schema';
import * as nostr from 'nostr-tools';

export class NostrBot {
  private bot: Bot;
  private relay: nostr.Relay;

  constructor(bot: Bot) {
    if (bot.platform !== 'nostr') {
      throw new Error('Invalid bot platform');
    }
    this.bot = bot;
  }

  async connect() {
    const creds = this.bot.credentials as { privateKey: string };
    this.relay = nostr.relayInit('wss://relay.damus.io');
    await this.relay.connect();
    
    // Validate connection
    if (!this.relay.connected) {
      throw new Error('Failed to connect to Nostr relay');
    }
  }

  async sendDM(recipient: string, content: string) {
    try {
      await this.connect();
      const creds = this.bot.credentials as { privateKey: string };
      
      const event = {
        kind: 4, // Encrypted Direct Message
        pubkey: nostr.getPublicKey(creds.privateKey),
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', recipient]],
        content: await nostr.nip04.encrypt(creds.privateKey, recipient, content)
      };

      const signedEvent = await nostr.signEvent(event, creds.privateKey);
      const pub = this.relay.publish(signedEvent);
      
      return new Promise((resolve, reject) => {
        pub.on('ok', () => resolve(signedEvent.id));
        pub.on('failed', reject);
      });
    } catch (error) {
      console.error('Failed to send Nostr DM:', error);
      throw error;
    }
  }

  async watchDMs() {
    try {
      await this.connect();
      const creds = this.bot.credentials as { privateKey: string };
      const pubkey = nostr.getPublicKey(creds.privateKey);
      
      const sub = this.relay.sub([
        {
          kinds: [4], // Encrypted Direct Messages
          '#p': [pubkey]
        }
      ]);

      sub.on('event', async (event) => {
        if (event.pubkey === pubkey) return; // Skip own messages
        
        const content = await nostr.nip04.decrypt(
          creds.privateKey,
          event.pubkey,
          event.content
        );

        // Handle incoming message
        console.log('Received DM:', content);
      });
    } catch (error) {
      console.error('Failed to watch Nostr DMs:', error);
      throw error;
    }
  }
}
