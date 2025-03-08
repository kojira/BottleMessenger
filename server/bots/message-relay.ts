import { InsertMessage, Settings } from '@shared/schema';
import { storage } from '../storage';
import { BlueskyBot } from './bluesky';
import { NostrBot } from './nostr';

export class MessageRelay {
  private blueskyBot: BlueskyBot | null = null;
  private nostrBot: NostrBot | null = null;

  async init() {
    try {
      console.log('Initializing message relay...');
      const settings = await storage.getSettings();

      if (!settings) {
        console.log('No settings found, waiting for configuration...');
        return;
      }

      console.log('Setting up bots with configured credentials...');
      await this.setupBots(settings);

      // Start watching for DMs
      if (this.blueskyBot) {
        console.log('Starting Bluesky DM watch...');
        this.blueskyBot.watchDMs().catch(console.error);
      }

      if (this.nostrBot) {
        console.log('Starting Nostr DM watch...');
        this.nostrBot.watchDMs().catch(console.error);
      }

      console.log('Message relay initialization completed');
    } catch (error) {
      console.error('Failed to initialize message relay:', error);
      throw error;
    }
  }

  private async setupBots(settings: Settings) {
    if (settings.blueskyHandle && settings.blueskyPassword) {
      console.log('Configuring Bluesky bot...');
      this.blueskyBot = new BlueskyBot({
        identifier: settings.blueskyHandle,
        password: settings.blueskyPassword
      });
    }

    if (settings.nostrPrivateKey) {
      console.log('Configuring Nostr bot...');
      this.nostrBot = new NostrBot({
        privateKey: settings.nostrPrivateKey
      });
    }
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