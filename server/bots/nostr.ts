import { SimplePool, getPublicKey, nip04, getEventHash } from 'nostr-tools';
import { commandHandler } from './command-handler';
import WebSocket from 'ws';
import { type Filter } from 'nostr-tools';

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
      console.log('Connected to primary relay');
    } catch (error) {
      console.error('Failed to connect to primary relay, trying backup');
      try {
        await this.pool.ensureRelay(this.relayUrls[1]);
        console.log('Connected to backup relay');
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

      console.log(`Sending DM from ${pubkey} to ${recipient}: ${content}`);

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

      const eventId = getEventHash(event);
      const signedEvent = { ...event, id: eventId };

      // Publish to each relay individually
      for (const url of this.relayUrls) {
        try {
          console.log(`Publishing to relay: ${url}`);
          await this.pool.publish(url, signedEvent);
          console.log(`Successfully published to ${url}`);
          return eventId;
        } catch (error) {
          console.error(`Failed to publish to ${url}:`, error);
        }
      }

      throw new Error('Failed to publish to any relay');
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

      // Create subscription filter
      const filter: Filter = {
        kinds: [4],
        '#p': [pubkey]
      };

      // Create new subscription
      const sub = this.pool.sub(
        this.relayUrls,
        [filter],
        {
          onEvent: async (event: NostrEvent) => {
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
          }
        }
      );

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

  private hexToBytes(hex: string): Uint8Array {
    return new Uint8Array(
      hex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    );
  }
}