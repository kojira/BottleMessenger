import { SimplePool, getPublicKey, nip04, getEventHash } from 'nostr-tools';
import { commandHandler } from './command-handler';
import WebSocket from 'ws';
import { WebSocketImplementation } from 'nostr-tools';

// Set WebSocket implementation for nostr-tools
(globalThis as any).WebSocket = WebSocket as WebSocketImplementation;

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
  private reconnectInterval: NodeJS.Timeout | null = null;
  private isWatching = false;

  constructor(credentials: NostrCredentials) {
    this.credentials = credentials;
    this.pool = new SimplePool();
  }

  private async connectToRelay(): Promise<void> {
    try {
      // Try primary relay first
      await this.pool.ensureRelay(this.relayUrls[0], { timeout: 5000 });
      console.log('Connected to primary relay');
    } catch (error) {
      console.error('Failed to connect to primary relay, trying backup');
      try {
        await this.pool.ensureRelay(this.relayUrls[1], { timeout: 5000 });
        console.log('Connected to backup relay');
      } catch (error) {
        console.error('Failed to connect to backup relay');
        throw error;
      }
    }
  }

  async sendDM(recipient: string, content: string): Promise<string | null> {
    try {
      await this.connectToRelay();

      const privateKeyBytes = this.hexToBytes(this.credentials.privateKey);
      const pubkey = getPublicKey(privateKeyBytes);

      console.log(`Sending DM to ${recipient}: ${content}`);

      const encryptedContent = await nip04.encrypt(
        privateKeyBytes,
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

      try {
        await Promise.any(
          this.relayUrls.map(url =>
            this.pool.publish(url, signedEvent)
          )
        );
        console.log('DM sent successfully');
        return eventId;
      } catch (error) {
        console.error('Failed to publish to any relay:', error);
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

      const privateKeyBytes = this.hexToBytes(this.credentials.privateKey);
      const pubkey = getPublicKey(privateKeyBytes);

      // Close any existing subscriptions
      this.closeSubscriptions();

      // Create new subscription
      const sub = this.pool.sub(
        this.relayUrls,
        [
          {
            kinds: [4],
            '#p': [pubkey]
          }
        ],
        {
          onevent: async (event: NostrEvent) => {
            if (event.pubkey === pubkey) return; // Skip own messages

            try {
              console.log('Received encrypted DM from:', event.pubkey);

              const content = await nip04.decrypt(
                privateKeyBytes,
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
          },
          oneose: () => {
            console.log('Successfully subscribed to relay');
          },
          ondone: () => {
            console.log('Subscription closed');
            // Attempt to reconnect if still watching
            if (this.isWatching) {
              this.reconnect();
            }
          }
        }
      );

      this.activeSubscriptions.push(sub);
      this.isWatching = true;

      // Setup reconnection handler
      this.setupReconnect();

    } catch (error) {
      console.error('Failed to watch Nostr DMs:', error);
      this.isWatching = false;
      throw error;
    }
  }

  private setupReconnect(): void {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }

    this.reconnectInterval = setInterval(() => {
      this.reconnect();
    }, 60000); // Reconnect every minute if needed
  }

  private async reconnect(): Promise<void> {
    try {
      await this.connectToRelay();
      console.log('Reconnected to relay');
    } catch (error) {
      console.error('Failed to reconnect:', error);
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
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
    this.closeSubscriptions();
    await this.pool.close();
  }

  private hexToBytes(hex: string): Uint8Array {
    return new Uint8Array(
      hex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    );
  }
}