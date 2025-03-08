import { Bot, Message, InsertMessage } from '@shared/schema';
import { storage } from '../storage';
import { BlueskyBot } from './bluesky';
import { NostrBot } from './nostr';

export class MessageRelay {
  private bots: Map<number, BlueskyBot | NostrBot> = new Map();

  async init() {
    const bots = await storage.getBots();
    bots.forEach(bot => {
      if (bot.active === 'true') {
        this.addBot(bot);
      }
    });
  }

  private addBot(bot: Bot) {
    const botInstance = bot.platform === 'bluesky' 
      ? new BlueskyBot(bot)
      : new NostrBot(bot);
    
    this.bots.set(bot.id, botInstance);
    botInstance.watchDMs().catch(console.error);
  }

  async relayMessage(message: InsertMessage) {
    try {
      // Find active bot for target platform
      const targetBot = Array.from(this.bots.values()).find(
        bot => bot instanceof (message.targetPlatform === 'bluesky' ? BlueskyBot : NostrBot)
      );

      if (!targetBot) {
        throw new Error(`No active bot found for platform ${message.targetPlatform}`);
      }

      // Create message record
      const savedMessage = await storage.createMessage({
        ...message,
        status: 'pending'
      });

      // Send message
      const targetId = await targetBot.sendDM(message.sourceUser, message.content);

      // Update message status
      await storage.updateMessage(savedMessage.id, {
        status: 'sent',
        targetId
      });

      return savedMessage;
    } catch (error) {
      console.error('Failed to relay message:', error);
      throw error;
    }
  }
}

export const messageRelay = new MessageRelay();
