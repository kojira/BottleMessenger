import { InsertMessage, Settings } from '@shared/schema';
import { storage } from '../storage';
import { BlueskyBot } from './bluesky';
import { NostrBot } from './nostr';

export class MessageRelay {
  blueskyBot: BlueskyBot | null = null;
  nostrBot: NostrBot | null = null;

  async init() {
    console.log('Initializing message relay...');
    const settings = await storage.getSettings();

    if (!settings) {
      console.log('No settings found, waiting for configuration...');
      return;
    }

    console.log('Setting up bots with configured credentials...');
    await this.setupBots(settings);

    // 自動起動が有効な場合のみボットを起動
    if (settings.autoStart === 'true') {
      console.log('Auto-start is enabled, starting bots...');
      await this.startBots(settings);
    } else {
      console.log('Auto-start is disabled, waiting for manual start...');
      // ボットのステータスを停止中に設定
      await storage.updateSettings({
        ...settings,
        botStatus: 'stopped',
        autoStart: 'false' // 明示的に自動起動を無効に設定
      });
    }

    console.log('Message relay initialization completed');
  }

  async startBots(settings: Settings) {
    try {
      // ボットのステータスを起動中に設定
      await storage.updateSettings({
        ...settings,
        botStatus: 'running'
      });

      // 最新の設定を取得（自動投稿設定を含む）
      const latestSettings = await storage.getSettings();
      if (!latestSettings) {
        throw new Error('Failed to get latest settings');
      }

      if (this.blueskyBot) {
        console.log('Starting Bluesky DM watch...');
        // 自動投稿設定が変更された場合に備えて、一度クリーンアップしてから再起動
        this.blueskyBot.cleanup();
        await this.blueskyBot.watchDMs(latestSettings.blueskyIgnoreBeforeTime || null);
      }

      if (this.nostrBot) {
        console.log('Starting Nostr DM watch...');
        // 自動投稿設定が変更された場合に備えて、一度クリーンアップしてから再起動
        await this.nostrBot.cleanup();
        await this.nostrBot.watchDMs();
      }

      console.log('Bots started successfully');
    } catch (error) {
      console.error('Failed to start bots:', error);
      // ボットのステータスをエラーに設定
      await storage.updateSettings({
        ...settings,
        botStatus: 'error'
      });
      throw error;
    }
  }

  async stopBots() {
    console.log('Stopping bots...');
    const settings = await storage.getSettings();
    
    if (!settings) {
      console.log('No settings found');
      return;
    }

    if (this.blueskyBot) {
      console.log('Stopping Bluesky bot...');
      this.blueskyBot.cleanup();
    }

    if (this.nostrBot) {
      console.log('Stopping Nostr bot...');
      await this.nostrBot.cleanup();
    }

    // ボットのステータスを停止中に設定
    await storage.updateSettings({
      ...settings,
      botStatus: 'stopped'
    });

    console.log('Bots stopped successfully');
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
      try {
        const nostrRelays = JSON.parse(settings.nostrRelays);
        this.nostrBot = new NostrBot({
          privateKey: settings.nostrPrivateKey
        }, nostrRelays);
      } catch (error) {
        console.error('Failed to configure Nostr bot:', error);
        this.nostrBot = null;
      }
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

      // Send message and get targetId
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
