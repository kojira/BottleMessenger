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
        try {
          await this.blueskyBot.watchDMs();
        } catch (error) {
          console.error('Error in Bluesky DM watch:', error);
          // エラーをスローせず、ログに記録するだけ
        }
      }

      if (this.nostrBot) {
        console.log('Starting Nostr DM watch...');
        try {
          await this.nostrBot.watchDMs();
        } catch (error) {
          console.error('Error in Nostr DM watch:', error);
          // エラーをスローせず、ログに記録するだけ
        }
      }

      console.log('Message relay initialization completed');
    } catch (error) {
      console.error('Failed to initialize message relay:', error);
      // エラーをスローせず、ログに記録するだけ
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
      const nostrRelays = JSON.parse(settings.nostrRelays);
      this.nostrBot = new NostrBot({
        privateKey: settings.nostrPrivateKey
      }, nostrRelays);
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