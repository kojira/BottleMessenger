import { InsertMessage, Settings } from '@shared/schema';
import { storage } from '../storage';
import { BlueskyBot } from './bluesky';
import { NostrBot } from './nostr';

export class MessageRelay {
  private blueskyBot: BlueskyBot | null = null;
  private nostrBot: NostrBot | null = null;

  async init() {
    const settings = await storage.getSettings();
    if (settings && settings.enabled === 'true') {
      this.setupBots(settings);
    }
  }

  private setupBots(settings: Settings) {
    this.blueskyBot = new BlueskyBot({
      identifier: settings.blueskyHandle,
      password: settings.blueskyPassword
    });

    this.nostrBot = new NostrBot({
      privateKey: settings.nostrPrivateKey
    });

    // Start watching for DMs
    if (this.blueskyBot) this.blueskyBot.watchDMs().catch(console.error);
    if (this.nostrBot) this.nostrBot.watchDMs().catch(console.error);
  }

  async relayMessage(message: InsertMessage) {
    try {
      // Create message record
      const savedMessage = await storage.createMessage({
        ...message,
        status: 'pending',
        targetId: null // Initialize as null
      });

      // Get the appropriate bot based on target platform
      const targetBot = message.targetPlatform === 'bluesky' 
        ? this.blueskyBot 
        : this.nostrBot;

      if (!targetBot) {
        throw new Error(`No bot available for platform ${message.targetPlatform}`);
      }

      // Send message and ensure targetId is string | null
      const targetId = await targetBot.sendDM(message.sourceUser, message.content);

      // Update message status
      await storage.updateMessage(savedMessage.id, {
        status: 'sent',
        targetId: targetId || null
      });

      return savedMessage;
    } catch (error) {
      console.error('Failed to relay message:', error);
      throw error;
    }
  }
}

export const messageRelay = new MessageRelay();