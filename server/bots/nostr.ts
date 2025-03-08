import { SimplePool, getPublicKey, nip04, getEventHash, signEvent, type Filter } from 'nostr-tools';
import { commandHandler } from './command-handler';
import WebSocket from 'ws';

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
  private relayUrls = ['wss://relay.damus.io', 'wss://nos.lol'];
  private activeSubscriptions: ReturnType<SimplePool['sub']>[] = [];
  private isWatching = false;

  constructor(credentials: NostrCredentials) {
    this.credentials = credentials;
    this.pool = new SimplePool();
  }

  private async connectToRelay(): Promise<void> {
    try {
      await this.pool.ensureRelay(this.relayUrls[0]);
      console.log('Connected to primary relay:', this.relayUrls[0]);
    } catch (error) {
      console.error('Failed to connect to primary relay, trying backup');
      try {
        await this.pool.ensureRelay(this.relayUrls[1]);
        console.log('Connected to backup relay:', this.relayUrls[1]);
      } catch (error) {
        console.error('Failed to connect to backup relay');
        throw error;
      }
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

  async watchDMs(): Promise<void> {
    if (this.isWatching) {
      console.log('Already watching for DMs');
      return;
    }

    try {
      await this.connectToRelay();
      console.log('Starting to watch for Nostr DMs...');

      const privateKey = this.credentials.privateKey;
      const pubkey = getPublicKey(privateKey);

      console.log('Watching for DMs to pubkey:', pubkey);

      const filter: Filter = {
        kinds: [4],
        '#p': [pubkey]
      };

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

          console.log('Received encrypted DM from:', event.pubkey);

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

  async cleanup(): Promise<void> {
    this.isWatching = false;
    this.closeSubscriptions();
    await this.pool.close();
  }
}