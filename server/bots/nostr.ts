import { SimplePool, getPublicKey, nip04, getEventHash } from 'nostr-tools';
import { commandHandler } from './command-handler';

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

  constructor(credentials: NostrCredentials) {
    this.credentials = credentials;
    this.pool = new SimplePool();
  }

  private async connectToRelay(): Promise<void> {
    try {
      await this.pool.ensureRelay(this.relayUrls[0]);
    } catch (error) {
      console.error('Failed to connect to primary relay, trying backup');
      await this.pool.ensureRelay(this.relayUrls[1]);
    }
  }

  async sendDM(recipient: string, content: string): Promise<string | null> {
    try {
      await this.connectToRelay();

      // Convert privateKey from hex to Uint8Array
      const privateKeyBytes = this.hexToBytes(this.credentials.privateKey);
      const pubkey = getPublicKey(privateKeyBytes);

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

      // Add required fields for event ID
      const eventId = getEventHash(event);
      const signedEvent = { ...event, id: eventId };

      // Publish to relays
      try {
        await Promise.any(
          this.relayUrls.map(url => 
            this.pool.publish(url, signedEvent)
          )
        );
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
    try {
      await this.connectToRelay();

      // Convert privateKey from hex to Uint8Array
      const privateKeyBytes = this.hexToBytes(this.credentials.privateKey);
      const pubkey = getPublicKey(privateKeyBytes);

      this.pool.sub(
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
              const content = await nip04.decrypt(
                privateKeyBytes,
                event.pubkey,
                event.content
              );

              // Process command and send response
              const response = await commandHandler.handleCommand(
                'nostr',
                event.pubkey,
                content
              );

              if (response.content) {
                await this.sendDM(event.pubkey, response.content);
              }
            } catch (error) {
              console.error('Failed to process DM:', error);
            }
          }
        }
      );

    } catch (error) {
      console.error('Failed to watch Nostr DMs:', error);
      throw error;
    }
  }

  private hexToBytes(hex: string): Uint8Array {
    return new Uint8Array(
      hex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    );
  }
}