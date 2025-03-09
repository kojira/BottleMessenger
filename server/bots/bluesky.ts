import { AtpAgent } from '@atproto/api';
import { commandHandler } from './command-handler';
import { storage } from '../storage';

interface BlueskyCredentials {
  identifier: string;
  password: string;
}

export class BlueskyBot {
  private agent: AtpAgent;
  private chatAgent: any;
  private credentials: BlueskyCredentials;
  private isWatching: boolean = false;
  private lastLoginAt: number = 0;
  private readonly LOGIN_COOLDOWN = 5 * 60 * 1000; // 5分

  constructor(credentials: BlueskyCredentials) {
    console.log('Initializing BlueskyBot with handle:', credentials.identifier);
    this.credentials = credentials;
    this.agent = new AtpAgent({ service: 'https://bsky.social' });
  }

  private async ensureSession() {
    if (!this.agent.session) {
      console.log('No active session, logging in...');
      await this.connect();
    } else if (Date.now() - this.lastLoginAt > this.LOGIN_COOLDOWN) {
      console.log('Session expired, refreshing...');
      await this.connect();
    }
  }

  async connect() {
    try {
      console.log('Connecting to Bluesky...', this.credentials.identifier);
      await this.agent.login({
        identifier: this.credentials.identifier,
        password: this.credentials.password
      });
      this.lastLoginAt = Date.now();

      // チャットサービスにプロキシを設定
      this.chatAgent = this.agent.withProxy('bsky_chat', 'did:web:api.bsky.chat');
      console.log('Successfully connected to Bluesky and chat service');
    } catch (error) {
      console.error('Failed to connect to Bluesky:', error);
      throw error;
    }
  }

  async sendDM(recipientDid: string, content: string): Promise<string | null> {
    try {
      await this.ensureSession();
      console.log(`Sending DM to ${recipientDid}: ${content}`);

      // 会話を取得または作成
      const convoResponse = await this.chatAgent.chat.bsky.convo.getConvoForMembers({ 
        members: [recipientDid] 
      });
      const convoId = convoResponse.data.convo.id;
      console.log('Conversation ID:', convoId);

      // メッセージを送信
      const response = await this.chatAgent.chat.bsky.convo.sendMessage({
        convoId,
        message: { text: content }
      });

      console.log('DM sent successfully:', response);
      return response?.data?.messageId || null;
    } catch (error) {
      console.error('Failed to send Bluesky DM:', error);
      return null;
    }
  }

  async checkNotifications() {
    try {
      await this.ensureSession();
      console.log('Checking Bluesky DMs...');

      // 前回の処理時刻を取得
      const state = await storage.getBotState('bluesky');
      if (state) {
        console.log('Last processed time:', state.lastProcessedAt.toISOString());
      } else {
        console.log('No previous state found, starting fresh');
      }

      // 会話リストを取得
      const response = await this.chatAgent.chat.bsky.convo.listConvos();
      console.log(`Found ${response.data.convos.length} conversations`);

      // 各会話のメッセージを処理
      for (const convo of response.data.convos) {
        try {
          console.log('Processing conversation:', {
            id: convo.id,
            participants: convo.participants
          });

          const messagesResponse = await this.chatAgent.chat.bsky.convo.getMessages({
            convoId: convo.id
          });

          for (const message of messagesResponse.data.messages) {
            // メッセージの詳細をログ出力
            console.log('Processing message:', {
              sender: message.sender,
              text: message.text,
              createdAt: message.sentAt // sentAtを使用
            });

            // 送信者情報の存在確認
            if (!message.sender?.did) {
              console.log('Skipping message with invalid sender');
              continue;
            }

            // 前回の処理時刻以降のメッセージのみを処理
            const messageCreatedAt = new Date(message.sentAt); // sentAtを使用
            if (state && messageCreatedAt <= state.lastProcessedAt) {
              console.log('Skipping already processed message:', message.sentAt);
              continue;
            }

            if (message.text.startsWith('/')) {
              console.log('Processing command from sender DID:', message.sender.did);
              const response = await commandHandler.handleCommand(
                'bluesky',
                message.sender.did,
                message.text
              );

              if (response.content) {
                console.log('Sending response:', response.content);
                await this.sendDM(message.sender.did, response.content);
              }
            }
          }
        } catch (error) {
          console.error('Error processing conversation:', error);
        }
      }

      // 最後の処理時刻を更新
      await storage.updateBotState('bluesky', new Date());
      console.log('Updated bot state timestamp');

    } catch (error) {
      console.error('Failed to check Bluesky DMs:', error);
      throw error;
    }
  }

  async watchDMs(): Promise<void> {
    if (this.isWatching) {
      console.log('Already watching Bluesky DMs');
      return;
    }

    try {
      await this.ensureSession();
      console.log('Starting Bluesky DM watch...');

      // 前回の処理時刻を取得
      try {
        const state = await storage.getBotState('bluesky');
        if (state) {
          console.log('Restored last processed time:', state.lastProcessedAt.toISOString());
        } else {
          console.log('No previous state found, starting fresh');
        }
      } catch (error) {
        console.error('Error retrieving bot state:', error);
      }

      // 初回の通知チェック
      await this.checkNotifications();
      console.log('Initial DM check completed');

      this.isWatching = true;
    } catch (error) {
      console.error('Failed to start Bluesky DM watch:', error);
      this.isWatching = false;
      throw error;
    }
  }

  cleanup() {
    console.log('Cleaning up Bluesky bot...');
    this.isWatching = false;
  }
}